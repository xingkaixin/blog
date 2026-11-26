---
title: "Why Does the Same Claude Act Dumb for Me? Agent Capability Is Multiplication, Not Addition"
summary: "The same Claude model can perform wildly differently across different applications. The model sets the ceiling, while the harness supplies context, tools, and a feedback loop. What you should actually build yourself is the business layer, not a runtime from scratch."
coverAlt: "Why Does the Same Claude Act Dumb for Me? Agent Capability Is Multiplication, Not Addition"
sourceHash: "43312ff08e6e9b47"
---

After wiring my own MCP tool into a project-management API, a bigger idea hit me: Claude Code can read files, run tests, inspect errors, and go back to fix bugs—isn't it just Claude underneath? I had an API key in hand. Building my own agent to run business workflows shouldn't be hard.

Two weeks later, I had something that barely stumbled forward. Sometimes it called tools; sometimes it stalled. After a few turns, the information it needed to keep was gone, while irrelevant junk kept piling up in the context. The exact same Claude that worked steadily inside Claude Code felt like it had swapped brains inside my app.

At first, I blamed the prompt. I spent a week tweaking prompts, added vector search, and bounced between different models, only to see marginal gains. What was missing had never been in the prompt.

**An agent's capability is closer to multiplication: Model × Harness. If either side is too weak, the other can't save it.**

![Agent capability formula: Model × Harness](/posts/images/agent-harness-not-model/agent-harness-not-model-01.png)

## What I Missed Was the Feedback Loop

A model doesn't touch files or run commands on its own. Based on the current input, it can only decide which tool to call next. What actually reads files, applies edits, runs tests, and feeds the results into the next turn is the harness around it.

My earliest version only did "let the model call APIs." Deciding which files and history to include meant stuffing everything into the prompt at once. When a tool failed, I only returned a raw error string. As the conversation grew, nothing cleared out stale information. On every turn, the model had to re-guess the current state from a pile of noise.

A mature coding agent handles at least a few things for the model: pulling relevant context for the task, executing and validating tool calls, feeding back test and compiler output, editing files in a controlled way, and running verification before finishing. The model didn't get smarter—it could finally see what its previous step had done.

For those two weeks, I kept tuning "how it should answer," when what I actually lacked was "how it gets reliable consequences after taking a step." Without consequences, an agent loop is just guessing many times in a row.

![Harness feedback loop](/posts/images/agent-harness-not-model/agent-harness-not-model-02.png)

## Models and Harnesses Also Affect Each Other

"Model × Harness" isn't an exact formula, and the two sides aren't independent either.

Armin Ronacher recently documented a concrete example: when the new Claude model called an edit tool inside Pi, the file changes were right, yet it kept adding fields to nested parameters that the schema didn't allow. Older models didn't have this quirk, and turning on strict tool invocation made the issue disappear.

This shows that models can adapt to a specific set of common tool shapes and error-handling conventions. Move to a different harness, and even a valid schema can fall outside the distribution the model is used to. A harness can't just expose tools; it has to validate arguments, preserve failure traces, and continuously test whether the model and tools actually fit each other on real tasks.

So "the same model" doesn't guarantee the same behavior. What context it receives, how its tools are shaped, and whether it gets accurate feedback after a failure all change the outcome.

## Don't Rewrite the Layer That Doesn't Belong to You

I eventually dropped the plan to build a general-purpose agent runtime from scratch and plugged my workflows into a mature runtime instead. Flows I hadn't gotten working in two weeks started working in an afternoon.

That doesn't mean a team shouldn't build anything itself. What's worth owning is the layer close to the business: where tasks come from, what data can be read, which actions require confirmation, how results are accepted, and how sessions and tool failures are replayed. These rules determine whether an agent can enter real workflows, and no off-the-shelf product will figure them out for you.

As for the agent loop, file tools, permission prompts, and session management, foundations like Agent SDK, Managed Agents, Pi, and OpenCode already exist. Unless your product is selling a harness, rebuilding everything from a `while` loop over the API usually just delays the real work.

What a team needs is control, not every line of runtime code. Replace or self-host the relevant parts when an existing harness can't meet your data-isolation or audit requirements—don't default to starting from zero just because it's a "team scenario."

![Build from scratch vs. mature harness + custom business layer](/posts/images/agent-harness-not-model/agent-harness-not-model-03.png)

## Don't Lock Yourself Into One Model Tier Either

I also used to jump to another extreme: if the model is a multiplier, always pick the strongest one and never downgrade to save tokens.

In practice, it depends on the task. For batch renaming or filling in fields under clear rules, a smaller model is usually faster and cheaper. Architectural trade-offs, unfamiliar domains, and subtle bugs are what call for stronger capability. When a task fails, look at which kind of failure it is first: skipping files or failing to run tests is an execution-depth and harness problem; if the context is complete and verification ran, yet it still consistently makes the wrong call, that's when you step up to a stronger model.

Now, whenever an agent looks "not smart enough," I inspect the whole chain first: what it received, what it can call, how failures come back, and who verifies completion. The prompt is just one piece of it.

**The model determines how good it can possibly be; the harness determines whether that capability ever lands on the task at hand.**
