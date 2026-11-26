---
title: "I Only Clicked Merge: Why I Shut Down My Fully Automated Agent Loop After Two Weeks"
summary: "The agent opened worktrees and PRs on its own; all I did was click merge. Two weeks later, the code still ran, but the product had lost its direction. Before automating, separate execution judgment from product judgment."
coverAlt: "I Only Clicked Merge: Why I Shut Down My Fully Automated Agent Loop After Two Weeks"
sourceHash: "189eb52a6bd7c36e"
---

For two weeks, the only thing I did on that project was click merge.

I would wake up to three or four PRs sitting on GitHub. The agent had spun up its own worktrees, written the code, reviewed it, and put together neat descriptions. I glanced at the titles, thought "looks fine," and clicked merge. Green. Next.

Then one day I went in to add a small feature and froze when I opened the codebase. The code ran, but it was scattered in every direction—full of features I couldn't explain and didn't remember approving. **It hadn't crashed. It had just grown into something I no longer recognized.**

## What I Was Thinking

The tool started as a small CLI product built by a colleague. After taking it over, I had an idea: could I let it grow on its own?

I gave the agent a product baseline and a few guardrails, along with a list of comparable tools. Every day, it checked GitHub to see what those projects had shipped. When it spotted a feature worth following, it created an epic, broke it down into stories, and ran a review. Once the review passed, it opened a worktree, wrote the code, and submitted a PR.

The only role I kept for myself was clicking merge.

For a while, I felt pretty smug about it. The human steps back to the final gate while the machine runs the entire loop—wasn't that the dream everyone talked about?

![Fully automated PR pipeline](/posts/images/only-click-merge/only-click-merge-01.png)

## Every Step Made Sense, Yet the Product Drifted

It took two weeks to realize I hadn't just handed off the coding. I had handed off the power to decide where the product was going.

Every single day, it managed to "discover" new features. If a competitor added something, it wanted to match it. If an issue was filed, it could always find a reason to build it. Each change looked reasonable in isolation, yet together they had no backbone. The person who was supposed to decide what was worth building had reduced that choice to a button on a merge page.

Replit had a far more extreme incident in 2025: even after the user explicitly ordered a freeze on changes, the agent ran database operations and wiped production data. That was a failure of permissions and production isolation, different in kind from my product drift, but both shared the same weak spot: the agent was given decision-making power beyond what could be verified.

What really lulls you to sleep is that every step looks right. The syntax is clean, the formatting is consistent, and the PR descriptions are tidier than what I write myself. You can't point to a single diff and say, "the direction is wrong." As _Trust Doesn't Live in Code Review_ puts it, when an agent writes code faster than a human can carefully read it, review degrades into rubber-stamping. You're still stamping approvals, and you still feel like you know what you're shipping—even after real control has already slipped away.

## Separate Two Kinds of Judgment Before Automating

Now I split judgment into two categories.

The first is execution judgment—bounded and verifiable: does the code pass tests, follow project conventions, and meet the written acceptance criteria? Within those bounds, the agent can implement and verify on its own while I look at exceptions and final outcomes.

The second is product judgment: does this feature deserve to exist, will it pull the product in a different direction, and is the added complexity worth it? The agent can gather context and propose options, but final sign-off has to stay with a human, because no test suite can answer that question.

Previously, I handed off both together and only checked at the end whether the code was safe to merge. Once a feature is already built and the PR is sitting there, the psychological cost of rejecting it is much higher. "We've already come this far" ends up making the product decision for you.

Code still needs review, of course. But code review can't answer an earlier question: whether that code should have been written in the first place.

![Execution judgment vs. product judgment](/posts/images/only-click-merge/only-click-merge-02.png)

## How I Work Now

I shut down the full automation loop.

Before any feature starts, I write down three things: why we're building it, what we're explicitly not doing, and what "done" looks like. The agent breaks down tasks and writes code inside that box; whenever a decision touches product direction, it stops and waits for my confirmation. Once the implementation is done, I walk through the acceptance criteria myself instead of taking its "I checked everything" self-review as proof.

It's slower than just clicking merge, but the product looks like mine again. I still rely on the agent—I just don't let a tidy-looking PR make product decisions for me anymore.

**The real gate isn't the merge button. It's the moment a feature enters the backlog.**

![New workflow: human sets boundaries in the backlog](/posts/images/only-click-merge/only-click-merge-03.png)
