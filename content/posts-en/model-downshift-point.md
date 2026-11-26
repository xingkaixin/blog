---
title: "For a Big Refactor, I Only Used Fable on the First Two Steps"
summary: "Running a top-tier model like Claude Fable across an entire large refactor burns hundreds of dollars in equivalent quota and hits the 5-hour rate limit mid-job. The real engineering leverage is knowing when to downshift: use Fable for top-level planning and locking in the template, then hand bulk implementation to Opus or Sonnet to preserve quality without tripping rate limits."
coverAlt: "For a Big Refactor, I Only Used Fable on the First Two Steps"
sourceHash: "3b5de0fa3320f3d2"
---

Last month, I refactored the error-handling layer of a service across 14 files. The goal was to replace scattered string errors with structured errors carrying error codes, call context, and cause chains.

On my first attempt, I ran Fable with high reasoning effort from start to finish. All 14 files were updated and every test passed, but the cost was brutal: the run burned nearly $700 in equivalent token usage. Worse, right around the seventh file, the combination of dense long context and high reasoning consumption hit my subscription's 5-hour usage cap. The task stalled, and I had to sit around waiting for the next 5-hour window to reset. A half-day job stretched into a full day.

Two weeks later, a similar task came up, and I swung to the opposite extreme: I ran a cheap, smaller model the whole way through. It got the direction wrong on step one, stuffing error conversion directly into every low-level database call site instead of consolidating it at the API boundary. By the time I caught it, more than a dozen files had already been modified, and tearing it down to redo cost another half day.

Both approaches missed the mark. The real engineering leverage is finding the exact downshift point: **use Fable for top-level design and setting the template, then hand bulk implementation to Opus or Sonnet.**

## What a Top-Tier Model Buys Is the First Right Shape

Use the flagship model for the upfront architecture design, and have it modify the first file by hand. Once the code pattern is locked in, hand the task off right away.

The key to this approach is "modifying the first file by hand."

A refactoring doc that says "consolidate error handling at the business boundary" will never constrain the actual implementation down the line. What truly sets the shape of the code are those few dozen concrete lines in the first file: how error code enums are named, how underlying raw errors are wrapped into `cause`, where HTTP status code mappings live, and how assertions are structured in unit tests.

These engineering conventions are hard to spell out exhaustively in a prompt, yet the remaining 13 files will follow that first sample to the letter.

Top-tier models excel at boundary abstractions and architectural trade-offs in complex systems. Running them on the first two steps buys you the first genuinely right code shape. Those two steps take very few turns—enough to lock down the core rules without ever coming close to the 5-hour rate-limit red line.

## Downshift to a Cost-Effective Model for Implementation

Once the template holds, the rest of the work is essentially high-quality imitation and adaptation.

Handing the task off to Opus or Sonnet at that point cuts consumption by an order of magnitude. More importantly, their rate limits are much more generous. In a 14-file refactor, downshifting for the remaining 10 modules keeps the job from draining a week's worth of top-tier quota and lets you run straight through to the end—no forced "halftime break" in front of a 5-hour cap.

The same logic applies to day-to-day development: give mechanical edits to cost-effective models, and save the top-tier model budget for exploring new architectures or tackling large refactors.

Only after you separate tasks into clear tiers can model spend and development pace reach a real balance.

## One Criterion for Downshifting: Are You Making New Decisions?

When I first started tiering models, I picked them based on "how hard is this task?" That rule turned out to be unreliable. Difficulty is subjective—the same task can feel tricky today and straightforward tomorrow once you think it through.

The objective criterion is simpler: **Does this step require making new decisions?**

Break the refactoring plan into explicit task nodes, then evaluate each one: is this node introducing a new design, or is it applying the pattern established earlier to the next module?

Back to that error-handling refactor. The first endpoint touched global architecture, so it ran on Fable. The remaining dozen-plus endpoints just swapped in different data structures and method names, so I dropped straight down to Sonnet or Opus and only needed to glance at the diff to check whether the code shape had drifted. Whenever a special module with retry and backoff logic popped up—something outside the original template—I bumped that single step back up to the higher tier.

Over a full refactor, the top-tier model usually shows up twice: once for upfront planning, and once to lock in the first template file. The rest of the time, it stays on standby.

![Set the template to cover major variants, and upshift only when bulk implementation hits an exception](/posts/images/model-downshift-point/model-downshift-point-01.png)

## Downshifting Before the Pattern Stabilizes Costs More in Rework

Downshifting has a trap: dropping down too early, before the template is fully settled.

I learned this the hard way while refactoring an API module. The first node only covered a plain synchronous CRUD handler. I assumed the pattern was solid and handed the rest of the task to a cheaper model.

What I missed was that the system also had streaming endpoints with long-lived connections and async pushes. The cheaper model took the synchronous template and forced it onto the streaming endpoints, swallowing context cancellation signals and timeout controls. Because the mocks in the test suite weren't granular enough, the tests even passed—until integration load testing exposed a connection leak.

To avoid that kind of rework, the first node must cover all major variants. If the system has synchronous calls, async streams, and retry-backed chains, have the top-tier model produce a standard solution for each of those three shapes during the template phase before farming out the repetitive work.

## Downshift at Task Boundaries to Protect the Prompt Cache

There is one more practical detail when putting this into practice: **switch model tiers at task boundaries, not mid-conversation.**

Changing the model configuration halfway through a single session often invalidates the existing prompt cache. Trying to save a few tokens ends up forcing the entire long context to be recomputed, making the run both slower and more expensive.

A smoother workflow is to cut context cleanly between steps:
1. **Template phase**: Start a fresh session with Fable to plan the approach and land the code for the first file. Once verified, make a `git commit`.
2. **Implementation phase**: Open a new session using Sonnet or Opus, passing only the committed diff and guidelines as reference input so it can focus on updating the remaining files to match the template.
3. **Verification phase**: After all implementation is done, spin up a clean session for a final review and edge-case testing.

A mature refactoring workflow looks like this: use the top tier for planning and templating, hand bulk implementation to a cost-effective model, and make clean handoffs and verifications at task boundaries.

Next time your subscription quota hits bottom or you keep slamming into rate limits, don't switch the whole pipeline over to a cheap model. **First figure out which steps are defining the rules, and which ones are just executing them.**
