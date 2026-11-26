---
title: "Why Does Asking an Agent to Self-Review Code Often Make It Worse?"
summary: "In a closed context, asking an agent to self-review code breaks right answers far more often than it fixes wrong ones. Multi-agent collaboration only works when it introduces new external information. Here is a breakdown of the Proposer-Reviewer architecture, the rule that models cannot approve their own completion, and how context isolation prevents token explosion."
coverAlt: "An agent passes self-review only for external evidence to uncover two new errors"
sourceHash: "4ef11a389308d20e"
---

Last month, I added a "safety net" to our internal refactoring agent.

To keep it from missing edge cases, I appended a line to the end of the prompt: "Carefully review the code you just generated for potential logic flaws; if you find any, fix them directly."

The logic seemed straightforward: reviewing code after writing it is a basic habit for human engineers.

But on the sixth file—one handling a concurrent Map—something bizarre happened. Unit tests that had been passing were broken by this "self-review," which introduced two new type errors and even swapped out a working read-write lock for a long-deprecated global Mutex.

This kind of self-review rarely catches deep bugs. Instead, it often mangles code that was already right, or introduces brand-new syntax errors into working logic.

It wasn't that the prompt wasn't strict enough.

An ICLR 2024 study testing GPT-4 found that without external environment feedback, asking an LLM to self-review and revise code **causes it to break correct answers far more often than it fixes wrong ones.**

A review that introduces no new information is essentially just forcing the model to guess again on top of its previous hallucinations.

## The Only Physical Criterion for Effective Review

Under what conditions does multi-agent collaboration or review actually work?

There is only one criterion: **Does the review process introduce new external information that a single agent could not obtain during generation?**

| Review Pattern | Introduces New Info? | Actual Effect |
|---|---|---|
| Same model self-review (re-reading its own output) | No | **Usually useless or harmful** (breaks right answers) |
| Two agents debating in a shared context | No | Doubles token cost with near-zero capability gain |
| Reviewer reads **unit tests and compiler errors** | Yes (execution feedback) | **Significant improvement** |
| Reviewer reads **rendered UI screenshots** | Yes (visual feedback) | **Significant improvement** |
| Reviewer calls **external tools to verify facts** | Yes (tool feedback) | **Significant improvement** |

Look at row two: **simply splitting one model into two personas to debate each other cannot break through the single model's reasoning ceiling.**

Academic papers often conclude that "multi-agent debate doesn't help much," while frontline industry engineering widely embraces multi-agent architectures. The reason these two conclusions seem contradictory comes down to what they are evaluating:

Academia mostly tests text-only mutual critique inside a closed context, where information entropy doesn't increase. By contrast, every production multi-agent system that actually works attaches external environment channels to the review step—running real test suites, executing static type checks, and capturing rendered DOM screenshots.

This objective feedback from the outside world did not exist when the model first generated the code. Only with this injection of new information does review gain the physical ability to correct course.

![Closed-loop mutual critique adds no new information, while tests, compilers, and screenshots provide external evidence](/posts/images/agent-proposer-reviewer/agent-proposer-reviewer-01.png)

## Models Can Propose Completion, Never Approve It

Asking an agent to self-check without hard external feedback easily triggers three classic system failure modes:

1. **Lazy false completion**: Right after writing the code—without running unit tests or trying a build—the model confidently outputs "Task completed successfully" at the end;
2. **Premature surrender**: After a single tool call fails while resolving a complex dependency, it immediately declares "this approach is not feasible" and hands back to the human;
3. **False success**: The environment returns a 500 error, but because the returned JSON payload contains a `success` field, the model misreads it as a pass and closes the ticket.

The root cause of all three is identical: **until independent verification steps in, "done" is just a subjective claim by the model, never objective proof.**

A production-grade harness must enforce one ironclad system invariant:

> **A model can propose "completion," but it must never approve its own "completion."**

The true bottleneck of an agent loop is always the Verifier, never the generator model. If the verifier cannot provide deterministic pass/fail signals, running the loop faster only marks bad output as passing at higher concurrency.

## Architectural Boundaries of Proposer-Reviewer

To implement this mechanism in engineering code, the standard solution is the **Proposer-Reviewer** architecture.

It enforces three hard engineering disciplines:

### 1. Physical Context Isolation Between Producer and Judge

The Reviewer's context must never include the Proposer's thousands of words of reasoning (Thinking Block).

If a Reviewer inspects code while carrying the Proposer's reasoning trace, it will inevitably be steered by that same line of thought. The Reviewer should receive only two things: **the final generated artifact itself**, and **the execution evidence returned by the external environment** (test output, linter reports, rendered screenshots).

### 2. Reviews Must Consume Executable, Objective Evidence

In coding scenarios, having a Reviewer "eyeball the code" is still inefficient.

The right pipeline is: Proposer generates code -> Harness automatically runs the test suite -> failing stack traces and error messages are passed to the Reviewer as execution evidence -> Reviewer issues targeted revision instructions to the Proposer based on those objective errors.

### 3. Rejections Must Provide Structured, Actionable Fix Conditions

The Reviewer cannot just throw back a vague "logic is not rigorous." It must output machine-parseable, structured findings (such as issue type, failing line number, and expected boundary output), and the entire retry loop must enforce a strict budget cap to prevent infinite spinning.

![Output, testing, review, and fixes are handed off across isolated boundaries](/posts/images/agent-proposer-reviewer/agent-proposer-reviewer-02.png)

## Bonus Payoff: Ending Context Explosion in Long Sessions

Separating review into an isolated step yields a huge hidden engineering benefit: **protecting the context purity of the main pipeline.**

Take generating complex slides or frontend interfaces as an example:

In a single-agent setup, every revision round requires stuffing 1080p high-res rendered screenshots back into the context for the model to inspect. After two or three rounds, massive image tokens blow out the context window, driving up billing and causing severe attention decay.

In a Proposer-Reviewer architecture:

The Reviewer loads the screenshots independently, evaluates them in a vision model, and produces a lightweight structured text summary of just a few dozen tokens (e.g., "Slide 3 is too dense; Slide 7 button is occluded"). The Proposer only needs to consume that minimal text feedback for targeted fixes.

Bulky multimodal intermediate evidence stays physically isolated inside the Reviewer's ephemeral lifecycle, keeping the main task pipeline's context at a consistently high signal-to-noise ratio.

---

The bottom line for multi-agent collaboration is letting code be verified against real compilers, test suites, and browser screenshots.

Stop spending double the tokens to have a model play two roles debating inside a closed text box. **Build your review pipeline on objective execution evidence.**

Self-review without real external feedback is nothing more than re-confirming the previous hallucination.
