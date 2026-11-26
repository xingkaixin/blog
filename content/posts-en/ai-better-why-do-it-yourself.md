---
title: "If AI Can Do It Better, Why Do It Yourself?"
summary: "AI coding tools can get a feature working, but the developer still might not know how to fix it. 3Blue1Brown's video and Anthropic's Trio study clarify the value of practice and enjoyment—yet whether you can practice on the clock depends on who owns that time."
coverAlt: "If AI Can Do It Better, Why Do It Yourself?"
sourceHash: "e1e6f1ea3ec9ce7f"
---

"A math PhD here, just tell me what to do tomorrow."

In October, Grant Sanderson of 3Blue1Brown opened his video ["There's never been a better time to go into math"](https://www.youtube.com/watch?v=LKrwhjOI8Nc) with that viewer comment. He had posted a call for questions the week before, and many of the replies came from current or prospective math students asking what they should do next—a question even many of the professors he spoke with couldn't answer.

Two months ago, I published a post titled *AI Solved Your Week-Long Bug in Five Minutes, and Now You're Unhappy*. I ended it by saying that if AI crushes a hard problem and you still think "I was supposed to be the one to solve that," you're just guarding your turf. Putting that math PhD's question next to it, I made that judgment too quickly.

In the video, Grant uses a gym analogy. Machines can lift much heavier barbells than humans can, yet that doesn't stop you from going to the gym to lift weights and build strength.

He pushes the analogy to the extreme. Even if machines eventually outperform humans across the board—proving theorems, choosing conjectures, building theories, and finding applications—to the point where even "humans ask the questions" no longer holds, the scientific and engineering utility of math really should belong to machines.

Even then, most math graduates never planned to become research mathematicians anyway; they take the problem-solving skills they built into other fields. As long as those skills remain useful, stronger machines don't cancel out the value of the training itself.

He also points to an often underestimated kind of satisfaction: when you finally follow a clever solution and something clicks into place in your head.

The same goes for writing code. Even after AI writes the patch, you still want to trace the whole causal chain yourself—figuring out why two requests deadlocked on each other or why a certain state is unreachable. Dismissing all of that curiosity as clinging to the past misses half the picture.

Grant acknowledges that in that hypothetical future, the thrill of being the first to step into a new theory would be diminished. When I wrote about "guarding your turf" in my earlier post, I only counted the pride of "who solved it first," and left out both the skill-building and the joy of understanding the problem itself.

Enjoyment is personal, but building skill is a concrete ledger. In January, Anthropic published a [randomized study](https://www.anthropic.com/research/AI-assistance-coding-skills) that separated "shipping the task" from "learning it yourself." Fifty-two mostly junior engineers implemented two features using Trio, an unfamiliar Python async library, and took a quiz right afterward.

Both groups finished at roughly the same speed—the AI group was only about two minutes faster on average, a difference that wasn't statistically significant. On the quiz immediately after, however, the no-AI group averaged 67% while the AI group scored 50%, with the largest gap on debugging questions.

The researchers later grouped participants by how they used AI. Those who asked follow-up questions about principles and concepts scored relatively well, whereas groups that handed off entire chunks of coding or debugging averaged under 40%. Still, that was a post-hoc breakdown with only two to seven people per group. The study also didn't test whether the gap persists months later or across different libraries, so it doesn't prove any single usage pattern is definitively better.

What the data already separates cleanly is this: **getting a feature to pass doesn't mean the developer knows how to fix it.** Acceptance checks only tell you whether the tests are green, not whether you can debug the code on your own when conditions change.

Following those results, you don't need to turn AI off when practicing. Let it answer why something works and point out edge cases, while you write the core logic yourself.

![AI offers prompts while the developer works out the core logic in a notebook](/posts/images/ai-better-why-do-it-yourself/ai-better-why-do-it-yourself-01.png)

When you read through a complete implementation from AI and understand every line, it's easy to stop there. To check whether you actually learned it, move the code off your screen and rewrite the state transitions and branch conditions on paper or in a blank file.

The spots where everything looked obvious a moment ago—yet you get stuck without the answer in front of you—expose the exact questions you still have. Take those specific questions back to the docs or a minimal repro, instead of trying to learn the entire library from scratch.

This practice loop hasn't been tested in a controlled trial, and it wasn't part of Anthropic's study. Still, compared to nodding along line by line to a finished answer, being able to derive it again the next day under a different call order gives you a real sanity check.

That said, the gym analogy leaves out one premise. You lift weights on your own time, with nobody waiting for that barbell to ship. Coding mostly happens inside a team, so deciding between writing it yourself and letting AI handle it starts with who owns that time.

If production is down and release freeze is today, the bug reproduces, and tests cover it, you should take the fix AI gives you in a few minutes. Turning off your tools to reason through it for hours just for personal satisfaction puts the delay on the whole team.

On a weekend with no schedule pressure, if you're writing a small interpreter in C for fun, nobody is waiting on a deployment—how much you use AI and how much you write by hand is entirely up to you.

The place people actually get stuck is trying to sneak practice into a team sprint. **Before mixing practice into a delivery schedule, check with your lead on whether that time counts as learning time.**

If it does, take the time to understand the whole picture before shipping. If it doesn't, let AI fix the issue and get it deployed, then save the part you wanted to understand for a moment without delivery pressure and rewrite the same problem by hand. If every sprint only recognizes delivery and never leaves room for learning, all skill-building gets pushed into personal time—and that's a ledger an individual can't balance alone.
