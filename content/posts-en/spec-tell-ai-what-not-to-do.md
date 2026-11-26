---
title: "How to Write AI Coding Specs: Don't Tell AI How—Tell It What Not to Do"
summary: "Struggling with AI coding specs that are too vague or too detailed? A good upfront doc doesn't map out implementation paths—it draws a boundary circle with goals, non-goals, and acceptance criteria, leaves the inside to AI, and uses multi-model cross-review to catch traps early."
coverAlt: "How to Write AI Coding Specs: Don't Tell AI How—Tell It What Not to Do"
sourceHash: "640b00f86b62f655"
---

In my last post, I wrote about [the problem with SDD](/en/posts/spec-as-new-fig-leaf/): once a spec gets detailed enough, you're basically writing code in a different syntax. It doesn't eliminate engineering complexity—it just hides it somewhere else.

A reader asked: so are you saying we shouldn't write docs at all? Quite the opposite. What I'm against isn't documentation—it's the kind of doc that tries to spell out the entire implementation path in natural language. That costs too much and works poorly. In this post, I want to talk about what you *should* write, and how to write it, so your docs become fuel for AI-driven development instead of another burden.

---

## Constrain the Boundaries, Not the Path

![Constrain the Boundaries, Not the Path](/posts/images/spec-tell-ai-what-not-to-do/spec-tell-ai-what-not-to-do-01.png)

Most instructions people give AI are either too vague or too detailed.

Too vague—"build me a user management module." The AI improvises, and what it produces might look nothing like what you had in mind. Too detailed—writing pseudocode in natural language: "First create an array, then loop through the user list, check the permission field for each user..." You end up working harder than if you just wrote the code yourself, and the path you described probably isn't even optimal—it just boxes the AI in. That's the spec dilemma: write too little and AI drifts; write too much and you're doing more work than the AI.

There's a way out of this. The key isn't how much you write in a spec, but what you tell the AI—and what you leave out. The traditional spec mindset says: describe the implementation details as clearly as possible so the AI can just follow along. That works fine for simple tasks. But as soon as a requirement gets even slightly complex, precisely describing the implementation path in natural language becomes miserable. There are too many branches, the interactions are too granular, and the solution you spend all that effort describing is often worse than what the AI would come up with on its own—because it has seen far more code patterns than you have.

Try flipping the mindset: the point of writing a spec isn't to draw a road for AI to walk down. It's to draw a circle—anything inside is fair game, anything outside is off-limits. So how do you draw that circle? You only need to tell AI three things:

**What to do.** Clear goals. Not "build a good search feature," but "when a user enters a keyword, return results sorted by relevance within 500ms, with pagination support." The more concrete the goal, the more predictable the AI's output. This is the center of the circle.

**What not to do.** Most people skip this, yet it might be the single most effective way to keep AI from drifting. AI's default instinct is to do *more*. You ask for search, and it throws in search history, smart recommendations, and autocomplete. Every piece sounds reasonable, except you don't need any of it in this version. Or you ask for a data export endpoint, and it takes the liberty of adding scheduled jobs, email notifications, and automatic format detection—things you might want someday, but adding them now only complicates the code and makes testing harder. Explicitly marking what's out of scope draws the outer edge of the circle.

**What "done" looks like.** Acceptance criteria. Whether the final check is done by AI or a human, you need a set of verifiable conditions that define completion. A requirement without acceptance criteria is like a race without a finish line—the AI doesn't know when to stop, and you don't know when to wrap up. This is the exit of the circle.

Together, these three define the space where AI can exercise judgment on its own. Every implementation detail inside the circle—data structures, code organization, which library to call—is up to the AI. You don't do the part it's already good at; you focus on the things AI can't decide for itself: business intent, system constraints, and what's off-limits.

---

## What an Upfront Doc for AI Development Looks Like

![What an Upfront Doc for AI Development Looks Like](/posts/images/spec-tell-ai-what-not-to-do/spec-tell-ai-what-not-to-do-02.png)

Those three elements—goals, non-goals, and acceptance criteria—form the skeleton of the doc. But for AI to truly grasp your intent and make sound calls, you need two supporting pieces: background tells the AI *why* you're doing this so it has a basis for judgment in gray areas; prerequisites and constraints tell it which hard boundaries cannot be crossed.

Through my own projects, I've settled on a framework with five core fields:

**Background.** Why we're doing this. Not a project pitch for humans, but decision-making context for the AI. Knowing the "why" lets AI make better calls when it hits ambiguity during implementation. For example: "Search currently uses a full-table scan; as data has grown, response times now exceed 2 seconds and users are complaining." When AI sees that context, it knows performance is the primary concern and won't reach for a flashy solution that's even slower.

**Goals.** What this effort needs to achieve. Concrete, measurable—ideally something the AI can verify on its own.

**Non-Goals.** What we are explicitly *not* doing this time. Every non-goal you list narrows the AI's decision space and cuts down on unnecessary code. This is the highest-ROI section of the entire doc—spending two minutes thinking through what not to do saves hours of rework later.

**Prerequisites & Constraints.** Existing interfaces that must stay compatible, modules you can't touch, tech stack limits, performance requirements. These are hard boundaries. AI has free rein inside them, but it cannot cross them. Also check for those [unwritten assumptions you thought didn't need spelling out](/en/posts/spec-unwritten-assumptions/), so different modules don't end up picking incompatible defaults.

**Acceptance Criteria.** What counts as finished. These can be concrete test cases or behavioral descriptions, as long as they're verifiable—not "search works well," but "entering a keyword returns results within 500ms, an empty keyword shows the default list, and results are sorted by relevance descending."

That's it. Notice there is zero mention of *how* to implement anything. You didn't tell AI which algorithm to use, how to structure the files, or how the call chain should flow. You just drew a circle: goals at the center, non-goals and constraints as the boundary, acceptance criteria as the finish line. Everything inside is AI's call.

This doc doesn't need to be long. For a medium-complexity feature, half a page to a page is plenty. Yet its information density is high, because every sentence conveys what AI actually needs: context, boundaries, and expectations.

---

## The Doc Itself Is a Human-AI Collaboration

![The Doc Itself Is a Human-AI Collaboration](/posts/images/spec-tell-ai-what-not-to-do/spec-tell-ai-what-not-to-do-03.png)

So don't I still have to spend time writing the doc?

Yes, but far less than you think—because the doc itself is a product of human-AI collaboration, with a clear division of labor. You fill in the parts only you know: what the core goal is, where the red lines are, which existing interfaces must stay compatible. Those are business judgments AI can't guess, so you set them. Usually that's just a few bullet points—under ten minutes.

Then you hand the rough draft to AI to flesh out. AI is great at taking your background and goals and expanding edge cases you might have missed, translating vague intent into sharper acceptance criteria, and spotting potential conflicts between your listed constraints. Those are its strengths—it's better than you at exhaustive enumeration and consistency checks.

The final step, and the one most easily skipped: review. If you use a multi-model workflow, here's a practice I rely on: don't use the same model to review the doc that you used to expand it.

It's not about which model is smarter. Different models have different training and internal biases—one model's blind spot is often another model's sensitive spot. If you have the same model write a doc and then review its own work, it will likely miss its own flaws—just like asking a developer to review their own code catches far fewer bugs than having someone else read it.

My usual setup: Claude Code expands the doc from my framework, then I feed that doc to Codex for review. The review focuses on just three things: do the goals and non-goals contradict each other, do the constraints miss any obvious boundaries, and can the acceptance criteria actually determine "done"?

Here's a real example. While building a data export feature, Claude Code expanded my doc to include "support CSV and JSON formats" with the constraint "single export capped at 100,000 rows." During review, Codex pointed out that my acceptance criteria only said "export succeeds," without covering the boundary case: how big is a 100,000-row CSV file? What happens if it exceeds the memory limit? Does it need streaming writes? If you only discover that after the code is running, you might have to scrap the whole implementation. Adding one acceptance criterion—"exporting 100,000 rows to CSV uses no more than 256MB of memory"—patched that trap before a single line of code was written.

This review isn't about nitpicking. It's about catching holes in the doc before execution—holes that cost many times more to fix once you're halfway through writing the code.

Only after passing review does the doc become the official input for development. When a model writes code from it—with clear goals, explicit boundaries, and verifiable criteria—the odds of drifting drop sharply. Even if adjustments are needed, you know exactly which field to tweak: was the goal too imprecise? Was a constraint missing? Did the acceptance criteria leave out a scenario?

---

## Not Every Task Needs This Doc

To be clear: this workflow isn't a silver bullet, and you shouldn't force it onto every situation. Fixing a simple bug? Just tell AI where the problem is—no doc needed. A small feature you can knock out in ten minutes? Skip it too.

But when you're facing a requirement that spans multiple modules, has external interfaces that must stay compatible, and you have clear expectations in your head that take more than a couple of sentences to explain—spending ten or fifteen minutes on an upfront doc often saves hours of rework later.

The rule of thumb is simple: **if you catch yourself going back and forth with AI—"not like that," "that's not what I meant," "we don't need this feature"—that's your sign you should have written this doc before starting.** Every round of back-and-forth is really just filling in information missing from an upfront doc. Instead of steering the AI back on course turn by turn after the fact, draw the boundaries upfront in one shot.

---

## Put Your Attention Where the Leverage Is

Look at the whole flow: the human sets the framework and hard constraints, AI fills in the details, another model cross-reviews, the reviewed doc drives execution, and the human handles final acceptance. From start to finish, your role in this chain is the decision-maker—judging whether the goals are right, whether the boundaries make sense, and whether the result meets expectations. Everything in between—expanding, checking, executing—can go to AI.

That's where engineers in the Agentic era should put their attention: not watching every line of code AI writes, but focusing on the points with the highest leverage—defining constraints upfront, and judging acceptance at the end. Get those two right, and AI can run the long execution chain in the middle reliably on its own. You don't need to become a faster coder; you need to become a better judge. And a good upfront doc is the translator that turns your judgment into instructions AI can execute.

---

*In my last post, I wrote about the illusion of SDD: a spec precise enough is just code. This post is the other side of that coin: you don't need to write with that level of precision, you just need to write in the right places. If you're using AI to build, and you have your own habits for upfront docs, feel free to share them in the comments.*
