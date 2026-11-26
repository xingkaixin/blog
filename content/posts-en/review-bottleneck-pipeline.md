---
title: "If Every PR Needs a Human Approve, You Are the Slowest Step on the Line"
summary: "Code review is becoming the bottleneck in the era of agent-generated code. Turn review into a tiered merge pipeline: hard rules and sensitive paths get an instant veto, an independent agent looks for flaws, and the LLM only holds veto power. Replace static review with small PRs and real behavior verification, tracking rollback and miss rates before gradually opening up auto-approval."
coverAlt: "If Every PR Needs a Human Approve, You Are the Slowest Step on the Line"
sourceHash: "fa80c5d68f8cc489"
---

![Cover: A one-minute approval interrupts twenty minutes of focus](/posts/images/review-bottleneck-pipeline/review-bottleneck-pipeline-cover.png)

Last month, while I was halfway through writing some code, a Slack message popped up: "Hey, can you hit approve on this for me? Tiny change."

I opened the GitHub diff: an enum got renamed, and two call sites got type assertions. It really was tiny. I had no context, but it looked reasonable enough, so I clicked approve. The whole thing took less than a minute.

Back in my IDE, I stared at the half-written Goroutine state machine I had been working on. My train of thought was gone. I sat there blankly for twenty minutes before I could pick up where I left off.

Even worse, the QA channel blew up that afternoon: that "harmless" enum change threw a null pointer exception when deserializing old Redis cache entries.

That is what code review has looked like for many of us: **getting pulled in with zero context to act as a human rubber stamp, breaking our flow, letting real landmines slip through, and still ending up on the hook in git blame when that casual click causes an outage.**

Once someone on the team—or an agent—starts churning out PRs in bulk, this setup falls apart completely.

## Two Agents Reviewing Each Other Quickly Turns Into Mutual BS

Buried under a pile of PRs, most people reach for the same first move: fight magic with magic. Spin up a Review Agent dedicated to inspecting the code submitted by Coding Agents.

I tried this once on a Python CLI tool, letting two agents with different prompts argue with each other inside a PR.

The result was pretty ironic. In round 1, the Reviewer pointed out that the error handling wasn't clean enough, so the Coding Agent immediately added a global hook. In round 2, with a fresh Reviewer context, it complained that the hook hurt throughput, so the Coding Agent cleverly rewrote it as a recursive retry. By round 3, running it locally immediately threw a `RecursionError` stack overflow.

Over 10 rounds, for the first 9 rounds both agents praised each other and patched over issues using impeccably professional jargon. The PR description read like a well-argued paper, completely self-consistent—except the code didn't run at all.

![Two agents patching each other's code until it hits RecursionError](/posts/images/review-bottleneck-pipeline/review-bottleneck-pipeline-02.png)

LLMs are very good at inventing plausible explanations for their own changes, and those explanations often sound remarkably convincing. Having one LLM with no runtime environment statically review another LLM is, most of the time, just two people signing off on each other's hallucinations.

## Hard Rules Guard the Gate; the LLM Only Gets a Veto

Last year, PostHog's main repo was swallowing over a thousand PRs a month. Early on, they even had a `#dev-stamp-exchange` channel in Slack for trading manual stamps. When that became unsustainable, they built a bot called StampHog.

The most useful idea behind it isn't some fancy LLM—it's inverting the permissions: **deterministic hard rules decide what gets merged, and the LLM only has veto power from start to finish.**

![Hard rules filter first, and the LLM can only tighten the gate](/posts/images/review-bottleneck-pipeline/review-bottleneck-pipeline-01.png)

Before a PR can be auto-merged, it first gets checked against the tripwires:
* Does the path touch `auth`, `billing`, public APIs, environment variables, or migration scripts? Instant rejection—it has to be reviewed by a human listed in CODEOWNERS.
* Are there merge conflicts, CI failures, or a drop in test coverage? Instant rejection.
* Is the change too large? Based on 90 days of historical data in their main repo, StampHog caps the threshold at 800 lines (excluding test snapshots and generated files). Anything over that goes straight to a human.

Only when all of those hard rules are green does the review agent step in to nitpick. If the agent spots a code smell or a logical flaw, it holds the PR for human review. Only if it finds nothing wrong does the system stamp the change.

An LLM should never get to decide, "Sure, this touches payments, but the code looks solid enough to merge." It can tighten the gate inside a safe sandbox, but it cannot wave risky changes through.

## Don't Read What the Agent Says—Check What the Real Request Returns

When facing a large change, the easiest mistake a reviewer can make is reading prose. The agent writes a long architectural breakdown and pastes in ASCII diagrams, and suddenly you feel like it knows what it's doing.

Daniel from PostHog put it simply: **Observation scales better than review.**

![Small PRs and real request outputs are much easier to observe](/posts/images/review-bottleneck-pipeline/review-bottleneck-pipeline-03.png)

With a 3,000-line diff, your attention drifts after five minutes. Checking the response of a real request takes a few seconds.

Instead of forcing yourself to simulate complex data flows in your head, break big changes down into a stack of single-purpose PRs (Stacked PRs). Add a field at the bottom layer, run a curl request, and check if it returns 200. Add an endpoint in the middle layer, and check whether the latency distribution on Datadog looks normal.

When every layer can be verified and rolled back independently, early mistakes never get the chance to compound downstream.

## Copying Someone Else's Rules Mistakes Their Risk Appetite for Your Safety Line

If you read PostHog's `pr-approval-agent` source code, you'll see their auto-approval thresholds are actually quite generous (800 lines, 30 files).

Do not copy those numbers straight into your own repo.

PostHog can afford to do that because nearly every feature in their product sits behind a Feature Flag, backed by thorough Sentry monitoring and second-level canary rollouts. If something breaks in production, one toggle cuts off the traffic. Their team is willing to accept the trade-off of "merge and ship first, fix it if we hit a snag."

If a bad change in your system requires shipping a full update package, or every deployment takes a thirty-minute pipeline, an 800-line limit will send you straight to the ICU.

When building your own merge pipeline, don't start with a bunch of flashy agents:
1. Go back through the PRs rolled back in your repo over the last three months, see which directories caused the incidents, and put those paths straight onto a blocklist.
2. Start with a line limit of 30 or 50 lines, and only let the bot auto-approve docs-only edits, type fixes, and typos.
3. Stop tracking "how many PRs the bot merged for us today," and start tracking "how many emergency rollbacks were triggered after an auto-merge."

Automation without a rollback safety net just manufactures production incidents at higher speed. Hand the safe grunt work over to rules, and save your clear head for the architecture that actually matters.

---

I am continuing to document pipeline governance and defense-in-depth practices in AI-assisted engineering. Next up, I'll share hands-on notes on quality gates, automated merge pipelines, dependency slimming, and system observability. Follow along if you're interested.
