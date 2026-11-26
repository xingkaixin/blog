---
title: "The Faster an Agent Runs, the Sooner You Need to Tell It When to Stop"
summary: "For long-running agent tasks, define three stop conditions alongside the goal: consecutive attempts with no improvement, missing key facts, and an upcoming scope boundary. Stopping to report saves more time than letting it keep guessing."
coverAlt: "The Faster an Agent Runs, the Sooner You Need to Tell It When to Stop"
sourceHash: "bc87976f188de2c7"
---

Eric Zakariasson runs three to five long-running agents in parallel. Model experiments watch the score, frontend tasks run Playwright and inspect screenshots, backend refactors run tests, and performance tasks track p95. The agents keep working in the cloud, and ping him on Slack when they finish or need a decision.

![Eric Zakariasson's Human-in-the-Loop workflow](/posts/images/agent-stop-conditions/source-eric-human-in-loop.png)

The easiest part of this workflow to notice is "running five at once." What caught my eye instead were two lines he wrote into the loop: stop if there is no improvement after a few consecutive tries; stop and ask when you are out of ideas, blocked, or uncertain.

Once a stop condition triggers, a human steps back in to decide the next move.

Without those two lines, parallelism only produces a bigger mess faster.

![Parallel tasks each watching an observable metric](/posts/images/agent-stop-conditions/agent-stop-conditions-01.png)

## A Test That Stayed Red for Two Hours

Suppose the task is to fix a flaky test. The agent adds a wait—still failing. It tweaks retries—still red. Then it suspects the test framework, upgrades a dependency, and spends another round fixing type errors. What started as a single-file change ends up as a diff across more than twenty files.

None of those steps is absurd. Each one has a rationale, and the agent is genuinely "trying to solve the problem." But after three consecutive edits fail to lower the failure rate, what it needs is new evidence: the CI logs from that run, a data sample that only reproduces in production, or a human decision on whether the test is worth keeping at all.

Many long-running tasks only specify the completion criteria: "Keep going until all tests are green." The goal is clear, while how to handle blockers is left blank. An agent will not glance at the clock like a coworker and walk over to ask, "Is this still worth pursuing?" It has tokens, it has tools, and it can always try one more version.

That is why stop conditions need to be written in before the run starts.

## Three Stop Conditions Are Enough

Eric's original phrasing is short: hit the target metric; no improvement after several tries; out of ideas; ask when blocked or uncertain. For everyday engineering tasks, add a scope check as well.

Stop conditions have nothing to do with failure. They define the checkpoints where the agent hands control back to you.

First, results stop getting better. Do not write "after several tries"—give a concrete number tied to something the task can observe. Three consecutive runs without reducing the failing test count, three UI iterations still stuck on the same interaction, or two rounds with no performance gain all count.

Second, key facts are missing. Without access to logs, permissions, or a product decision, continuing means guessing. At that point, the agent should report what is missing instead of filling the gap with a plausible assumption.

Third, the next step crosses a boundary. Fixing a component requires changing a public interface, optimizing a query requires migrating a data schema, or resolving an error requires upgrading a core dependency. Those solutions might be right, but they require a human to re-confirm the cost.

You do not need a long contract in the task prompt. One paragraph is enough: "Work until the acceptance criteria are met; stop editing if three consecutive attempts show no improvement, key facts are missing, or the next step modifies shared code outside the task scope. Tell me what you have verified, what you have tried, and what you need me to decide."

This works much better than "let me know if you run into issues," because the agent does not have to guess what counts as an issue.

Thresholds also need to be paired with metrics. A performance task can stop if p95 fails to drop for three straight rounds; a test-fixing task can watch the failure count; a UI task can check whether the same user flow is still blocked. Writing "if things aren't going well" is useless—agents and humans do not share the same patience for "not going well."

![Three checkpoints where an agent should stop](/posts/images/agent-stop-conditions/agent-stop-conditions-02.png)

## When It Stops, Don't Hand Back the Raw Session

A bare "I'm blocked" saves no human time. Whoever takes over still has to read the logs from scratch to figure out what was tried.

An effective stop report looks like an incident note: the facts established so far, the directions ruled out, the last result that showed movement, and the specific decision needed next. That is also why Eric has agents ping him on Slack. What he receives is a decision point, not a live stream of ongoing work.

Set the stop conditions too sensitively, and the agent asks for permission every two steps; leave them out entirely, and you end up babysitting the run. Adjust thresholds to the task. A ten-minute change does not need these rules; work that runs past half an hour, loops through trial and error, or touches shared modules does.

Eric can send three to five agents out at once not just because they run in the cloud, but because each task knows when to hand control back. Speed governs execution; stop conditions govern runaway drift. Without the latter, every extra agent you launch will come back with a new set of problems.
