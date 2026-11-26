---
title: "\"Just Run It\" Is the Most Expensive Verification Method in the AI Era"
summary: "AI generates code far faster than you can read it, and \"just running it\" only tests the scenarios you thought to check. Effective verification takes two layers: writing acceptance criteria upfront so AI generates tests, then having a different model review for technical debt from a maintainer's perspective—spending ten minutes now saves you from a \"all tests passed, production broke\" nightmare three months later."
coverAlt: "\"Just Run It\" Is the Most Expensive Verification Method in the AI Era"
sourceHash: "6cc088d78bee47d1"
---

AI wrote a date-formatting function for me. All tests passed, I glanced over it, and I merged it.

Three months later, I needed to change the date-formatting logic. I updated it, shipped it, and the data broke. After digging for a while, I found out there was already a nearly identical function in the project's `utils`, just under a different name. The AI hadn't reused it—it wrote a new one from scratch. I only updated the one in `utils` and never touched the AI's function, because I didn't even know it existed.

The bug was planted the day I merged it. Every test passed, and "running it" caught nothing.

---

## Speed Widens the Verification Gap

![Speed widens the verification gap](/posts/images/ai-code-review-expensive-testing/ai-code-review-expensive-testing-01.png)

Back when we wrote code by hand, "just run it and see" barely got by—because you knew what you wrote, you knew where things might break, and your manual testing was at least somewhat targeted.

AI-written code is different. It generates far faster than you can read, takes implementation paths you didn't necessarily expect, and makes its own judgment calls wherever requirements aren't explicit. Most of those calls are reasonable, but they don't always match your business logic.

What you cover when you "just run it" are the scenarios you thought of. The scenarios you didn't think of are where the bugs hide.

Even trickier, agentic development moves at a much faster pace than hand-coding. In a single afternoon, you might have AI build three modules, "run" each one, and feel like everything works. Only when those three modules are wired together, along some path you never walked, do things fall apart.

The faster you move, the bigger the holes in "just running it" become.

---

## Write Acceptance Criteria Before Asking AI to Code

![Write acceptance criteria before asking AI to code](/posts/images/ai-code-review-expensive-testing/ai-code-review-expensive-testing-02.png)


The idea isn't new: before writing code, describe what "correct" looks like in plain language. For example: "If a user enters the wrong password 5 times in a row, lock the account for 15 minutes." That sentence is the acceptance criterion—product managers can read it, and AI can read it too.

This practice (BDD, Behavior-Driven Development) never really took off when writing code by hand, because engineers found it tedious to write behavior specs before implementation. Agentic development flips the cost structure: you write the behavior spec, AI turns it into executable test cases, then writes the implementation to make those tests pass and verifies it on its own. The only judgment call left for you is whether the behavior spec is right.

There's also a counterintuitive truth here: **having AI write tests is more reliable than having AI write feature code.** It's much easier for a human to judge whether a test is right than whether an implementation is right. One glance at a test case tells you whether it checks the behavior you actually want; one glance at implementation code rarely tells you whether it holds up under every edge case.

My own habit is to spend a few minutes scanning the list of test cases after AI generates them. I don't even need to read the test code itself—just reading what behavior each test describes makes missing edge cases jump right out. Those few minutes pay off massively: catching a gap at the acceptance-criteria level costs almost nothing to fix, whereas catching the same gap after the code is written might mean throwing out the whole implementation.

Putting acceptance criteria upfront gives AI a track with a clear finish line. That's the core of the first verification layer.

---

## The Problems Tests Can't Catch

Functional verification answers "does it work," but leaves another question unanswered: quality.

AI optimizes for making the current tests pass. Whether that code will be easy to change three months from now isn't on its radar. If a similar utility function already exists in the project, it'll write a new one anyway. As long as error handling doesn't throw an uncaught exception, it calls it a day. Whether the code style matches the rest of the repo isn't something it worries about either.

None of these look like big deals on their own. Together, they pile up into technical debt. Everything runs fine today; six months from now, changing a single line feels like walking on thin ice.

That date function from the beginning is a textbook example. Each function was fine in isolation, and every test passed. Yet having two duplicate functions side by side meant updating one and forgetting the other—and that's how the bug slipped in. Tests can't catch that.

The trouble is, code quality has no single right answer and no score you can compute. You can't run a command that prints "Quality: 87/100."

But one thing does work: **have a different model read the code.**

Functional bugs should be caught by tests. Here, you're asking the second model to do something else: read the code from the perspective of an engineer taking over this project three months from now. What parts are confusing? Where was unnecessary complexity introduced? Where does this duplicate something the codebase already has?

Why switch to a different model? The model that wrote the code has momentum around its own output, focused on "can it work." A fresh model with no history of generating that code is much better at spotting things that look fine locally but cause problems overall.

The role prompt I usually give the review model is: you're taking over this project; read this code and point out three things—duplication or inconsistency with existing code, swallowed exceptions in error handling, and anything that makes you pause to figure out what it's doing. That focused lens works far better than a vague "please review this code," and it won't waste space telling you a variable name could be nicer.

It won't catch everything, but it spots technical debt while it's still a seed. Catch it early and it's a quick fix; catch it late and you might have to rewrite it from scratch.

---

## Ten Minutes vs. Two Weeks

![What verification is really about](/posts/images/ai-code-review-expensive-testing/ai-code-review-expensive-testing-03.png)

Going back to that date function: if the acceptance criteria had said "reuse existing utility functions in the project," the AI wouldn't have built a separate one. And even if I'd missed that line, having another model scan the diff would likely have flagged the duplication with existing code.

Both layers of verification add up to ten extra minutes. What they save is spending days three months later hunting down a bug where "every test was passing."

**Writing code has become cheap. Knowing what code deserves to exist is the skill getting more expensive.**
