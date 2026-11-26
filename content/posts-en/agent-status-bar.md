---
title: "Why Can't an Agent Even Count How Many Times It Called a Tool?"
summary: "A context window is a powerful retrieval engine, but it lacks a native aggregation layer. No matter how strict the prompt rules are, an LLM cannot reliably count its own tool calls. Here is how an Agent Status Bar uses deterministic code to project state and keep reasoning overhead constant."
coverAlt: "Why Can't an Agent Even Count How Many Times It Called a Tool?"
sourceHash: "ba73dde23420f132"
---

Last week, I was testing an Agent built for automated outbound calls and refund verification.

To avoid harassing users, we put a hard rule in the System Prompt: "Do not attempt to call the same merchant more than 3 times."

Once the session started, things went smoothly at first. The first 3 calls all hung up because the line was busy. In the context logs, the timestamps, return codes, and failure reasons for all 3 calls were recorded clearly.

Yet on the 4th iteration, the Agent called the dialing tool again without hesitation, and kept going until the 5th attempt, getting our test number blacklisted by the carrier's risk-control system.

The rule was written in black and white at the top, the facts were sitting right there in plain sight, and we were using a top-tier commercial LLM. Why couldn't it even count to three?

When developers run into this, their first instinct is to rewrite the prompt: "Make sure you count every call carefully," or "Never exceed three attempts."

Even after those edits, it still miscounts from time to time.

This isn't a matter of writing stricter prompts. It's a hard limit of the Transformer attention mechanism.

## Context Windows Lack a Native State Aggregation Layer

Many people treat the context window as the model's "working memory," assuming the model can compute over anything placed inside it on the fly.

At the mechanical level, however, **In-Context Learning is built for retrieval, not state maintenance.**

Attention excels at pulling relevant raw snippets out of tens of thousands of tokens. What it lacks natively is a layer for **state aggregation**.

The model does not automatically count information recorded in the context, nor does it accumulate totals in place.

A simple experiment illustrates the difference:

Stuff 100 inspection logs into the context, with 90 marked normal and 10 marked abnormal.

If you ask, "What is the inspection status of device #37?" attention locates it precisely, and the answer is spot-on.

But if you ask, "How many devices are normal and how many are abnormal?" without chain-of-thought reasoning to check each line one by one, the model easily miscounts.

Answering the first question only requires pattern-matching retrieval. Answering the second requires scanning all records and maintaining a running tally. **That is stateful computation.**

When a session reaches a dozen turns and the context is packed with code and tool outputs, asking the model to count how many times a tool was called in a single forward pass is like asking a search engine to balance a ledger in its head.

![Retrieving record #37 and aggregating a 90-to-10 status are two different tasks](/posts/images/agent-status-bar/agent-status-bar-01.png)

## Turning Implicit Computation into a Deterministic Status Bar

Since probabilistic models are bad at spontaneous counting, the engineering solution is straightforward: **never leave state tracking to the model.**

The most direct fix is for the harness to precompute high-level state with deterministic code on every interaction and append an **Agent Status Bar** to the end of the context.

In the outbound-calling scenario, once the harness explicitly injects a line at the end of each tool output—"This is call #3 to this merchant (limit reached: 3/3)"—the model hits the rule boundary immediately and stops dialing. The error rate drops to zero.

The status bar delivers two engineering benefits:

First, **higher signal-to-noise ratio**. Raw tool execution logs are full of low-value tokens. At the cost of a few dozen tokens, the status bar hands the model summary metrics that would otherwise require scanning thousands of tokens to extract.

Second, **shorter attention span**. In long sessions, attention is easily diluted by scrolling logs. Placing computed meta-state at the very end of the context, right next to the next token the model is about to generate, gives it the most reliable attention weight.

## Reasoning Overhead Converges from Linear Growth to Constant

The gains from the status bar show up dramatically in experimental data.

Researchers ran controlled experiments measuring attention distribution and reasoning tokens:

- **Without a status bar**: Attention scatters across historical tool-call snippets, and the reasoning trace is filled with repeated context scanning, counting, and reconciliation. The reasoning tokens required per query **grow linearly** with session turns and context length.
- **With a status bar**: Attention locks onto the distilled summary in the status bar, and the reasoning trace consumes those conclusions directly. Per-iteration reasoning tokens, response latency, and API cost **drop by nearly an order of magnitude**.

More importantly, with a status bar in place, per-step reasoning overhead **converges from linear growth with context length to roughly constant.**

This convergence is decisive. It means a long-horizon task won't bog down on turn 20 due to reasoning bloat. Even smaller open-source models, once paired with a status bar, can push their task completion rates close to frontier LLMs.

## The 3 Things Most Worth Putting in a Status Bar

When building a harness status bar, three types of information offer the highest engineering leverage:

![Tool logs aggregated into call counts, a TODO list, and structured errors](/posts/images/agent-status-bar/agent-status-bar-02.png)

### 1. Tool Call Counters

In each tool response, the harness maintains a counter stating "This is call #N to this tool."

When the same tool fails 2 or 3 times in a row within a short window, the counter quickly triggers pattern recognition in the model: on the first failure it checks the path, on the second it inspects the directory, and on the third it stops forcing the same approach and looks for an alternative.

### 2. An Explicit TODO List

Maintain a structured task checklist at the end of the context, refreshing each item's status (`pending` / `in_progress` / `completed`) every turn.

Tests show that enabling an explicit TODO list cuts the average number of iterations an Agent needs for long tasks from 21 down to 15, while virtually eliminating premature termination where the model finishes item one and forgets item two.

### 3. Structured Errors and Recovery Hints

Many systems simply dump raw stderr back to the model when a tool fails.

A well-designed status bar wraps errors in layers: error type, call arguments, stack trace, plus targeted recovery hints preset by the harness (such as "File not found; try searching for the filename with fffind").

In testing, this single change raised the Agent's success rate at finding the right workaround from **60% to 95%**.

## Two Implementation Boundaries You Must Respect

When implementing a status bar, two engineering boundaries are non-negotiable:

First, **always inject at the end**. The status bar should use a `user` message slot appended to the end of the conversation, or sit at the tail of the latest tool output. Never edit the System Prompt at the beginning just to "keep things tidy"—otherwise every state update will bust the prefix cache.

Second, **the model trusts the status bar almost blindly**. Experiments show that models place extreme trust in state projections at the end of the context. If your harness counter has a bug (for example, reporting 3 calls when only 2 happened), the model will act on that wrong count without question.

**Any statistics fed to the model must be backed by rock-solid deterministic code.**

---

LLMs specialize in semantic association and generation; they cannot replace an accurate counter.

Stop expecting the model to do mental math for everything. **Let deterministic code handle arithmetic and state projection, and let the LLM focus on logic and semantic reasoning**—that is the most reliable foundation for a production Agent system.
