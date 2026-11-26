---
title: "Before Handing Work to an Agent, Ask for a Blindspot Pass"
summary: "Run a blindspot pass before your agent starts coding: surface only the questions that would change the design, backed by codebase evidence to separate what needs a human decision from what can follow existing conventions."
coverAlt: "Before handing work to an agent, ask for a blindspot pass"
sourceHash: "5f892d2e0e8967e9"
---

In a Fable session note, Thariq Shihipar shared a prompt he actually uses: when he is about to add a new login method to an unfamiliar codebase, he does not tell Claude to start building right away. Instead, he tells it he does not know the project's auth module and asks for a `blindspot pass`.

![Thariq Shihipar's Fable note](/posts/images/agent-blindspot-pass/source-thariq-fable.png)

That request is much narrower than "put together a plan for me." Claude only looks for what he does not yet know that would shape what he asks next: which providers the project already supports, where callbacks are handled, whether accounts merge by email or stay separate, and how tests are run.

Anyone who has built something similar knows that writing the OAuth code is rarely what takes the longest. What burns time is getting halfway through and realizing the user model does not allow two providers on the same email, forcing you to rework both the schema and the flow.

A long spec will not prevent that kind of rework. At that moment, the problem simply is not on your radar yet.

![Even the longest spec cannot account for what you do not know](/posts/images/agent-blindspot-pass/agent-blindspot-pass-01.png)

## Find the Gaps Before Designing the Solution

When we give an agent extra context, we are usually supplying things we already know. Where the page goes, what a field is named, which table must not be touched—all of that can be written down upfront. But the first time you step into an auth module, you do not even know which decisions will ripple through the architecture, so you cannot write them down.

That is exactly what an agent can do first. It can search neighboring implementations, tests, and commit history, grounding "what usually matters here" in the actual repository. The order matters: let it expose the gaps first, have a human make the calls that could change direction, and only then move into implementation.

You can translate a blindspot pass into a much more direct prompt:

> Don't implement anything yet. Looking at the current codebase and these requirements, find up to 5 questions I haven't mentioned whose answers would change the implementation plan. Show where in the code each question comes from, and whether it needs my decision or can follow the project's existing conventions.

A blindspot pass does not need to return much—just a small set of gaps worth confirming.

"Up to 5" blocks generic checklists. Without a cap, the response easily turns into a boilerplate sweep of security, performance, compatibility, and maintainability. It looks thorough, and none of it moves the task forward.

"Whose answers would change the implementation plan" filters the list. A button icon can be swapped later, while whether accounts can merge changes the data model; an error message can be tweaked later, while whether callbacks need multi-tenant support changes the API boundary. Set the first kind aside, and ask the second kind now.

![Narrow the questions down to the five worth answering now](/posts/images/agent-blindspot-pass/agent-blindspot-pass-02.png)

## Evidence Beats Reminders

A review note on an earlier draft pointed out that the phrase "codebase evidence" sounded like a token concrete detail dropped in for effect. That criticism is half right: writing just "check the codebase" really does read like an empty slogan. It has to land in output you can actually verify.

Suppose the agent says, "We need to confirm how tokens are stored." That should be followed by a fact from the project: the existing Google login in `auth/callback.ts` encrypts the refresh token and writes it to `oauth_accounts`, so a human needs to confirm whether the new provider should share that table. That is a prompt worth stopping for.

If the agent cannot find any call sites and is only guessing at risks from general experience, it can still say so—as long as it separates "repo facts" from "outside experience." When you see the former, you check the existing convention; when you see the latter, you only have to decide whether it applies this time.

This pass is not trying to eliminate every unknown. Out of five questions, some can simply follow the existing implementation, and others can wait until the next version. If it catches even one decision early that would otherwise overturn your data model, permissions, or user flow, those two minutes were well spent.

## When It Is Worth Asking

Changing a line of copy or tweaking a known parameter does not need an extra step. A blindspot pass fits three situations: touching a module for the first time, working on permissions or data migrations, or knowing the outcome you want without knowing the constraints inside the project.

The rule of thumb is even simpler: if the agent only asked this question halfway through, would much of the code it already wrote have to be thrown away? If yes, check for gaps first.

The value of Thariq's prompt is not in the word `blindspot`. Any phrasing works. What matters is using the agent's first search to surface the right questions instead of rushing straight to a plan.

Next time you step into an unfamiliar module, read the five questions it brings back first. Chances are one of them would otherwise have stayed hidden until the code was already written.
