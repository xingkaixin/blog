---
title: "From Writing Code to Reviewing Code: How Developer Skills Are Shifting in the AI Era"
summary: "Coding agents have shifted a developer's core job from writing code to reviewing it: AI can generate 200 lines in two minutes, leaving you 40 minutes to verify them. What really decides the outcome is your upfront planning and downstream judgment—architecture trade-offs, requirement breakdown, and code smell matter more than ever."
coverAlt: "From Writing Code to Reviewing Code: How Developer Skills Are Shifting in the AI Era"
sourceHash: "eaf1c451c9fa3484"
---

I started using Kimi K2 inside Claude Code in July 2025, and that was when one thing became clear to me: **coding agents didn't just speed up "writing code"—they rewrote the developer's job description.**

Later I kept switching models, and in October 2025 I started using Codex heavily; it quickly became my daily driver. Across all those tool changes, my conclusion stayed the same: **if you want AI to deliver reliable work, you have to think things through first.** How to slice the task, what the interfaces should look like, and how failures should fall back—if you aren't clear on those yourself, the AI's output drifts and becomes unpredictable.

A few days ago I asked Codex to write a data sync module, and it quickly spat out around 200 lines. At a glance it looked "good enough to ship," but getting it production-ready still took me nearly 40 minutes of pushing on edge cases and fixing logic. I ended up fixing three bugs, adding two exception handlers, and deleting a redundant transformation.

That slice cemented my view: **AI can generate 200 lines in two minutes, but what actually decides the outcome is your planning upfront and your gatekeeping afterward.**

Writing 200 lines of code used to take me two or three hours, with most of the effort spent on "writing": reading docs, wiring up APIs, and working out the logic. Now it's flipped. AI generates, and I judge.

It used to feel like building a house—laying a foundation and stacking floors one by one. Now it feels like molding clay—shaping a rough form first, then refining it bit by bit. **The developer's role has shifted from "author" to "editor."**

## The Skill of "Writing" Is Depreciating

Pure "writing" ability is depreciating fast.

Think back to when we first learned to code: memorizing APIs, syntax, and standard libraries was a core advantage. Knowing one extra `itertools.chain` meant taking three fewer detours than the next person.

Now? AI can produce any syntax or API call in seconds. CRUD endpoints, config files, test cases, Dockerfiles—for anything where you just need to "know how to write it," AI is faster, more consistent, and less error-prone than a human.

Writing code still matters, of course. It's just that "being able to write it" has become table stakes: having it isn't an edge, lacking it is just a liability.

## What "Reviewing" Actually Means

As "writing" fades, what grows in its place isn't just "reading diffs faster." Honestly, **I don't act like a human linter for every line AI outputs**: the volume is too high and too fast, and reading every line closely will burn you out. A more realistic approach is using **linting, unit tests, and E2E tests** to block low-level mistakes and regressions at the gate, while spending human attention on architecture trade-offs, whether the intent actually aligns, where to add test cases, and which files are worth opening for a close read.

On architecture, AI can give you three solutions that "all work," but choosing between them is still on you: optimize for shipping fast, or leave room for what comes next? That takes systems thinking, a read on where the business is heading, and making trade-offs among imperfect options. You hold the context and the goal—AI can't make that call for you.

Experienced developers often get a feeling that "something isn't right" without immediately knowing why. That's **code smell**, built up over years. Today it works more like a map: telling you which sections deserve a careful read and which ones can be left to the pipeline. AI-generated code often **looks right on the surface**: syntax, formatting, and naming are spotless, while the logic bug hides deeper down.

AI handles the happy path comfortably, yet **edge cases** are frequently missed: null values, concurrency, and error recovery—scenarios that "probably won't happen"—are the first things it skips. Much of "reviewing" ends up translating into one more test or one more assertion, rather than staring harder at a 200-line diff.

Breaking vague requirements into instructions an AI can execute has a huge impact on output quality. When you understand both the business and the implementation, the more concrete your **requirement translation** is, the closer the result gets to what you want—which is just the flip side of "thinking things through first."

## Old Skills vs. New Skills

Putting the old and new skills side by side makes the direction of this shift clear:

| Skill | Past | Present |
|---|---|---|
| Syntax fluency | Core advantage | Baseline requirement |
| Architecture design | Important | Even more important |
| Code review | Important | Core skill |
| Quality gate | Mostly manual CR | Linting / tests / E2E carry the load; humans watch intent and critical paths |
| Requirement breakdown | Important | One of the most critical skills |
| Debugging | Core advantage | Changed in form: from reading your own code to reading AI's code |

Pay attention to that last row. Debugging hasn't lost value, but its form has changed. Before, debugging meant reading code you wrote three weeks ago and guessing what you were thinking at the time. Now it means reading code AI wrote three seconds ago and guessing what it *thought* you were thinking. When a test turns red, you still have to read the code and figure out where it drifted.

## Where the Fatigue Moved

Writing code used to be slow, but you knew where you stood—you had thought through every line yourself and had a sense of where bugs might hide. Collaborating with AI, **the tiring part is rarely "struggling to produce code," but "keeping quality tight when output explodes."** If your pipeline isn't solid, you either let bugs slip through or burn yourself out patching things manually—neither is sustainable.

Worse, **reviewing someone else's code is inherently harder than writing your own.** You don't know why the AI wrote it that way, what it overlooked, or where it "misunderstood" your intent. That's why I try to spell out constraints upfront, let automation hold the floor, and save my eyes for the few high-risk spots.

AI code also has a deceptive trait: clean formatting, standard naming, and logic that "reads" smoothly, which makes it easy to let your guard down. That deep read on the sync module happened precisely because a quick skim wasn't enough. **Day to day, I rely on tests and linting as the first line of defense, and save deep reads for the places worth cutting into.**

## This Doesn't Mean Junior Developers Have No Value

At this point, some junior developers might feel anxious: does this mean I'm obsolete?

Quite the opposite. A junior developer's core value has changed, not disappeared. Previously, the value was "being able to write code that runs." Now, it's "being able to quickly understand AI output, read failure messages, and ask the right questions."

The path to learning programming is shifting too. It used to be: memorize syntax, build projects, then learn the underlying principles. Now it looks more like: learn to collaborate with AI first, build foundational understanding through practice, and then use that understanding to guide and verify what AI produces.

**One thing hasn't changed, though: you can't judge what you don't understand.**

If you have no grasp of HTTP, you can't tell whether the networking code AI wrote is right. If you don't understand database indexing, you can't evaluate the query plan AI suggests. When a test fails, you still need to know what is actually failing. AI can help you "write," but "reviewing" and "gatekeeping" ultimately rest on your own understanding.

Instead of worrying about whether AI will replace you, put that energy into judgment and engineering habits—the next section is my own baseline.

## Two Minutes and Forty Minutes

AI generated 200 lines of code in two minutes, and I spent 40 minutes reviewing and fixing them. Overall efficiency is definitely much higher than writing from scratch, but my role has completely changed—from a "writer" to someone who "sets the rules, watches the results, and makes the critical cuts."

**A developer's value isn't measured by how many lines of code they type, but by how many sound decisions they make.**

One last question to leave you with: the last time you caught a bug, did tests or linting sound the alarm first, or did you catch it yourself by reading the code?
