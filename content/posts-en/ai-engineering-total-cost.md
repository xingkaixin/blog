---
title: "When AI Makes Coding Faster, Who Decides Between Building Pages and Building Templates"
summary: "AI coding can crank out individual campaign pages quickly, which can actually delay the decision to switch to templates. Using Taobao's shift from hand-coded pages to templates as an example, this post explains how to get AI to spot shared patterns, calculate total lifecycle cost, and validate the approach with new requirements."
coverAlt: "When AI makes coding faster, who decides between building pages and building templates"
sourceHash: "6cfcfe04696dccf0"
---

A few days ago, I saw a screenshot of a discussion where the author recalled Taobao's early promotional campaign pages. At first, frontend engineers hand-coded every single page, reaching only a few hundred pages over an entire Singles' Day campaign. Later, the team switched to a template builder and handed page configuration over to operations, pushing the count into the tens of thousands. Later still, pages were generated automatically from product and category rules, passing a hundred thousand.

I couldn't find the original post to verify those numbers, so I'm reading them strictly as the author's recollection. What made me pause was the turning point in the middle: when requests started pouring in by the batch, the team didn't just add headcount to keep writing pages one by one. They stopped and built a template system first.

If you hand that same workload to today's AI, its default move is to keep generating code page by page along the old path. What used to take a day per page now takes ten or fifteen minutes. Yet 100 pages still mean 100 separate codebases, followed by 100 rounds of integration testing, 100 rounds of edits, and 100 rounds of production debugging.

Making a single generation cheaper actually delays that turning point. When everything was hand-coded, by the fifth page an engineer would be fed up enough to start thinking about templates. With AI, generating one more page has almost zero friction. It is easy to pile up dozens of pages before realizing that changing one shared style means making the same edit dozens of times.

![The same page change has to be repeated across multiple independent campaign pages](/posts/images/ai-engineering-total-cost/ai-engineering-total-cost-01.png)

Templates change the nature of the work that follows. Within the scope a template covers, adding a new page becomes a configuration task for operations. Engineers spend time upfront handling what is shared, and a huge volume of repetitive implementation never enters the engineering pipeline again.

**Being able to write a page quickly and being able to judge when it is time to build a template system are two different capabilities.**

AI makes looking up docs, organizing requirements, and writing technical specs faster, yet a team can still end up repeating the same work on the old path. The real question is: when faced with a batch of seemingly independent tasks, can AI spot the shared structure worth converging on, propose a better approach, and calculate whether switching approaches actually pays off?

Printing "Consider building a templating system" in a chat window does not count as having that capability.

Deciding what a template should standardize and what differences it should leave open requires looking at boundaries in the real business. Some pages only swap out products and copy; others differ in interactions and layout. If you turn every variation into a configuration option, the admin console itself becomes hard to use and turns into another maintenance burden.

Timing matters too. For a handful of one-off promotions, hand-coding or having AI generate pages one by one is cheaper. A shared template only holds up when requests come in frequently and the core logic is stable enough. A template system carries development and maintenance costs, plus the ongoing work of handling edge cases.

Get those trade-offs wrong, and AI will only help you ship a platform nobody wants to use even faster. You end up with more code, the same production model, and a long-term piece of architectural debt to pay down.

If a human makes the call to build templates and then tells AI to write the code, that only proves AI lowers the execution bar for refactoring—the judgment was still human. You can only say AI participated in that judgment when, given raw, unorganized requirements, it identifies the shared patterns on its own, proposes sensible boundaries, and ships something that actually cuts down on repetitive work.

To get an Agent involved in that judgment, you first have to change how you assign the task. "Build another page in this style" and "How should we handle these recurring page requests?" leave completely different room for judgment. The first only asks it to execute; the second invites it to weigh options.

Once you open up that judgment, you have to supply enough evidence. Existing pages, recent edit history, how often future requests are likely to show up, and whether the people maintaining things day to day are technical—all of that needs to go into the context. Without it, the Agent doesn't know how long the repetition will last or whether operations can configure pages on their own, so it can only pick an approach from incomplete information.

Next, have it compare three paths: keep generating page by page, extract a few shared components for reuse, or build a full template system. For each path, weigh the build cost against the future repetitive work saved across the entire lifecycle: the coding time saved by templates has to cover building the system, migrating old pages, and maintaining it long term. If a shared component solves the problem, don't blow it up into a platform.

Before the approach is validated, don't let it build out the whole system. Pick a representative batch of pages, deliberately mix in a few outliers with big differences, and use a minimal runnable version to test whether the shared abstraction actually fits.

Then test it against a batch of new requirements that weren't part of the design: Does adding a new page still require frequent changes to underlying code? Can operations complete the setup on their own? When an exception doesn't fit the template, can you fall back cleanly to custom code instead of piling on more config flags? Those outcomes tell you far more than "high cohesion, easy to extend" in a design doc.

![Testing template boundaries with new page requirements while keeping an escape hatch for exceptions](/posts/images/ai-engineering-total-cost/ai-engineering-total-cost-02.png)

The next time I face a batch of repetitive requests, I'll start by asking AI three questions: which parts of the work are worth consolidating, what evidence supports that, and under what conditions would building a template not pay off. Then I'll test its proposal against a few real requirements before deciding whether to keep shipping page by page or invest the time in templates.
