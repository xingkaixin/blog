---
title: "Testing TypeSafe Jev: Don't Make an LLM Spit Out 800 Tokens Just for a Boolean"
summary: "Using a general-purpose LLM with Structured Outputs for classification routing often takes nearly two seconds just to return a single boolean. After testing TypeSafe Jev—which drops autoregressive generation in favor of outputting only choices and calibrated probabilities—this post breaks down its 80ms latency, probability calibration, and the real boundaries behind the claimed 193x speedup."
coverAlt: "Testing TypeSafe Jev: Don't Make an LLM Spit Out 800 Tokens Just for a Boolean"
sourceHash: "e8cd0128a0d2f08a"
---

If you have ever profiled LLM API latency in an APM trace, you have probably seen a call stack that makes your blood pressure spike.

A customer complaint goes into the endpoint, and the downstream code is really only waiting on a single boolean: is the user asking for a refund or not?

To get that one field, the standard play is calling GPT-4o with Structured Outputs. The round trip finishes in 1.8 seconds.

Expanding that 1.8-second trace makes it worse: the Prefill phase, where the model reads the entire input, only took 220 milliseconds. For the remaining 1.6 seconds, the GPU was just autoregressively typing one character at a time: an opening brace, a newline, four spaces of indentation, a quote, `is_refund`, a colon, a space, `true`, and finally a closing brace.

It is like asking someone for directions at an intersection, and they have to recite an entire dictionary from A to Z before they are allowed to say "turn left." Tens of billions of parameters spin through dozens of forward passes on the GPU, purely to assemble syntactically valid JSON sugar for downstream code.

Once concurrency ticks up even slightly, tail latency across the entire gateway gets clogged by these business-useless curly braces.

## Smaller Models Won't Save an Autoregressive Typewriter

Someone will inevitably say: why not just run a lightweight 1B or 3B open-source model locally?

It won't be much faster.

Before LLMs came along, nobody put up with this. Every team maintained dedicated small models in production—a few-megabyte classification head for customer support intent, or a custom small BERT for risk moderation. Those got thrown out purely because labeling data and repeatedly fine-tuning was exhausting, and the moment users typed typos or internet slang, classification accuracy fell off a cliff. General-purpose LLMs could understand casual phrasing and slang zero-shot, which is why everyone rushed to switch.

But the physics of generative models are welded in place: predict one token, append it to VRAM, then predict the next.

Even when the API layer enforces strict JSON constraints via a finite-state machine (FSM), all it does under the hood is mask out invalid token probabilities at each decoding step. Not a single forward pass is spared.

If a single request needs to classify the department, check for a refund, and score urgency, cramming three fields into one prompt triples the decoding time. Splitting them into separate requests multiplies network round trips and forward passes instead.

Downstream only wants the discrete result of a multiple-choice question, yet a generative model has to write an expository essay in strict sequential order.

## Hands-On With Jev: Ditch the Typewriter, Keep the Scantron

TypeSafe's recently launched Jev claims to be 193x faster and 444x cheaper than an LLM.

I followed its docs and took the API for a spin.

What it does is straightforward: it keeps the prompt-based questioning interface, but completely strips out autoregressive generation.

The API schema is simple: pass the text you want evaluated in `state`, and attach a `questions` array underneath. It supports three judgment types:
- `choice`: single-choice selection from a list of options (up to 255);
- `score`: a weighted continuous score across discrete levels;
- `noul`: a yes/no question that directly returns a probability between 0 and 1.

I threw together a quick script, passed in a typical refund message, and stacked 5 questions in one go (department, whether it is a refund request, emotional intensity, complaint escalation threat, and duplicate charge).

Hit enter, and the response time printed in the terminal was startling: under 80 milliseconds.

The returned payload required zero JSON string parsing—it came back as a raw object with fields, probabilities, and selected options cleanly populated. Because it skips token-by-token decoding under the hood, all 5 questions are sampled in parallel and resolved in a single forward pass.

![Illustration comparing token-by-token generation and parallel judgment output](/posts/images/typesafe-jev/typesafe-jev-01.png)

Just as I started thinking this thing might actually solve the problem, I fed it a real customer complaint with a bit of a twist:

> "Your support team's speed is truly miraculous—three follow-ups and not a single reply. Forget the refund, see you at 12315."

Guess what it returned?

The probability for `is_refund` dropped straight to 0.08. It concluded with total confidence that the user was not asking for a refund.

That is the fatal blind spot of constrained output.

Mechanically, it guarantees the model will never spit out garbage outside your options or break JSON formatting over the wire (which is genuinely nice—downstream code doesn't need a single line of defensive regex).

But that only controls its mouth, not its brain.

![Even with constrained options, the model can still misread refund intent in a complaint](/posts/images/typesafe-jev/typesafe-jev-02.png)

Underneath, it is still a statistical probability model. Faced with sarcasm, inverted syntax, or emotionally charged phrasing, it can still pick a completely wrong answer with full confidence. If your option list omits "none of the above" or "insufficient information," it has no choice but to pick whichever wrong option looks closest.

Looking back at its advertised RLCD (probability calibration), it becomes clear why the team pitches this as a core selling point. If a model's 0.8 probability does not statistically correspond to an 80% real-world occurrence rate, downstream systems cannot safely do tiered routing—only when probabilities are calibrated can you write code that auto-approves above 0.95 and routes 0.4 to 0.7 to a human review queue.

## How Much Hype Is in the Claimed 200x Speedup?

Now look back at the official claim: "193.6x faster and 444.6x cheaper."

Dig into the benchmark scripts published on their GitHub and evaluation site (evals.typesafe.ai), and you will see how stacked that baseline is.

The general-purpose LLM used as the control group was forced to output a full structured probability distribution matching Jev's format.

To write out floating-point strings for every single candidate option's probability, the LLM had to churn through hundreds of tokens during the Decode phase, while Jev finished in a single forward pass and handed in the answer. Measuring a nearly 200x gap this way only proves that forcing an LLM to autoregressively print floats is absurdly inefficient—not that real-world workloads actually run 200x faster. In production, if you only ask the LLM to output a short enum, the gap is nowhere near that dramatic.

![Difference between requiring a full probability distribution versus a short enum; values shown are illustrative](/posts/images/typesafe-jev/typesafe-jev-03.png)

Mike Taylor from Every tested a batch earlier: running 21 concurrent questions across 37 documents (777 judgments total), Jev finished in 0.7 seconds at a cost of roughly $0.0025. Yet in another test checking 12 synthetic passages for subtle writing flaws, out of 7 planted defects, Jev caught 6 and missed 1, while the high-reasoning LLM baseline caught all of them.

It really is fast and cheap, but when it comes to tricky edge-case details, its miss rate is very real.

## Reality Check: When Should You Actually Use It?

There is also one cold splash of reality to keep in mind: Jev is not open source, and no paper has been published disclosing its underlying network architecture.

The team markets it as a "System One decision model," which sounds like a lofty cognitive psychology concept, but in practice it is currently a closed-source hosted API priced at $42 per billion tokens ($0.042 per million tokens). Until they publish the actual technical implementation, don't project it into some Transformer-killing miracle.

If your system happens to have these kinds of workloads, switching to a dedicated decision mechanism brings clear gains:
parsing target rooms and device enums in milliseconds inside a smart-home gateway, scoring candidate chunks and filtering prompt injections right after RAG vector retrieval, or running fast assertions on input argument enums before an Agent invokes a high-risk tool.

Those places only need discrete state gating within tens of milliseconds—making a generative LLM autoregressively spit out JSON in front of them is pure throughput waste.

But the moment a task involves drafting a warm, multi-paragraph reply, performing multi-step chain reasoning, or extracting non-standard entities mentioned casually by a user, it is completely out of its depth.

In system design, you don't need to expect a general-purpose LLM to do everything. Separate whether an endpoint needs free-form text or a control-flow branch. Leave text generation to LLMs, hand conditional branching back to a pure decision mechanism, and your pipeline's latency will finally settle back into a comfortable range.
