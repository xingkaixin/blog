---
title: "Can't Get AI Code Review to Stop? Drop \"Find Me a Bug\" First"
summary: "AI code review, Claude Code, Codex: a PR ran through over fifty review rounds overnight, and roughly 59% of the recurring comments pointed to code already there in round one. The culprit is often the \"find me a bug\" prompt itself. Switching to neutral framing, requiring an issue count upfront, and capping review rounds helps break the loop."
coverAlt: "Can't Get AI Code Review to Stop? Drop \"Find Me a Bug\" First"
sourceHash: "3684c03372f1c12a"
---

On the morning of March 28, I had Codex review a Python CLI I wrote. It ran from 7:49 to 10:18 across 10 rounds, using the exact same prompt every time: `review代码,模块拆分不合理,单体大文件,圈复杂度高` ("review the code, unreasonable module split, monolithic large file, high cyclomatic complexity").

At round 4, I asked why it kept finding new issues every round. It explained that each refactor redrew module boundaries, and new seams exposed old problems. I bought that explanation at the time, and wrote the same thing later in _"I Had AI Review My Own Code for 10 Rounds"_.

On October 15, the Claude Code team published a post on claude.dev about how they do code review. A CLI PR went through a review-fix-review loop over fifty times in one night before the author finally stopped it. When they ran git blame on the issues the reviewer kept flagging, roughly 59% landed on code that was already there the very first time the reviewer looked at it. Their takeaway: reviewers rarely find new bugs—each round, they just dig a few more out of old code.

I went back and checked my 10-round log. `config_store.py`, which was split out in round 7, hadn't been touched in the first 6 rounds. In round 8, it noticed three formatters each duplicating query summary logic; in that earlier post, I blamed it on the first few rounds focusing only on large files and missing cross-file duplication. Neither of those can be explained by "evolving structure": one file hadn't changed at all, and the other duplication simply hadn't been looked at yet.

Look at that prompt again. "Unreasonable module split, monolithic large file, high cyclomatic complexity"—I had already handed it three conclusions, leaving it with nothing to do but go find evidence. By round 9, it flagged that `where`/`cond` parsing was implemented separately in the command layer and the service layer. By that prompt's standard, you can always pick out some corner of a repo that looks a little bigger or more convoluted than the rest.

In March, systematicls published a long essay on agentic engineering. In the section on sycophancy, it noted: say "Find me a bug" and it will find you one, even if it has to invent one. My prompt asked the exact same kind of question, just swapping "bug" for "unreasonable split."

Things get worse when the PR author is also an agent. As the Claude Code team noted, a human glances at a nit and moves on in seconds, while an agent goes and fixes it—adding another commit and triggering yet another round of review. In my 10 rounds, Codex was the one editing the code too. In round 1, it added a timezone hook to stay compatible with tests; in round 2, splitting files tripped over that hook, breaking 1 out of 210 tests with a `RecursionError`, which then had to be fixed first.

The Claude Code team later added a few rules for re-reviews. The one I most want to copy is the first: by round three, the reviewer stops and asks the author to step back and rethink the approach. The other rules: after the first few rounds, only look at new diffs, flag similar issues all at once, and don't repost comments already made.

Before and after those rules shipped, the average number of review rounds for an internal PR to pass dropped from 2.08 to 1.32, and PRs needing five or more rounds fell from 8.9% to 1.5%. Those numbers came from a chart in the post without a stated time window or sample size, so I only take them as a directional signal. What the post made clear about priorities: catch real bugs first, reduce rounds second, and run the reviewer against PRs known to have no issues to count how often it pushes people into making harmful changes.

I plan to replace my task prompt with the neutral phrasing systematicls suggested: walk through the logic of each component and report everything you find. According to that post, asking this way sometimes surfaces a bug, and sometimes just yields an explanation of how a piece of code works.

The Claude Code team also mentioned that a well-written REVIEW.md asks the summary to lead with the issue count, say so plainly if nothing needs fixing, and back every item with a file path and line number. I'm going to append one line to the end of my prompt: **On the first line, state how many issues were found—write 0 if none—then list each with its file path and line number.**

![Code review needs a stopping condition](/posts/images/ai-review-find-bug-prompt/ai-review-find-bug-prompt-01.png)

I haven't settled on where to cap the rounds yet. They set the limit at three; when zhu327 built a loop on Pi, they also capped focused fixes at 3 rounds per cycle, pausing to report if it goes past that. I'll start with three rounds. After round three, I'll split whatever remains into two piles: issues introduced by edits in these rounds, and issues that were already there in round one. For the round-one pile, I won't let it keep fixing—I'll go back, rewrite the prompt, and start a fresh review.

I haven't re-run that CLI through this new setup yet, so I can't say how many rounds those 10 would shrink down to.
