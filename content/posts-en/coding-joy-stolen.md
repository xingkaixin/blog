---
title: "AI Fixed Your Week-Long Bug in Five Minutes, and Now You're Unhappy"
summary: "Fable reproduced a week-long bug in five minutes using dyld interpose and casually fixed a seven-year-old defect along the way. The joy of casting spells in code is being taken away—but what's being taken is the enemy of efficiency."
coverAlt: "AI Fixed Your Week-Long Bug in Five Minutes, and Now You're Unhappy"
sourceHash: "cbc6cf515b1b83ee"
---

A while ago, onevcat wrote a post titled "When Programming Stops Being Fun."

It started with an iOS crash. Kingfisher, the library he maintains, ran into a new kind of crash on iOS 26.5, dying deep inside a `Data` copy and tied to large memory allocation failures. Based on his experience, setting up a memory-pressure testbed, digging through crash logs, and reading assembly would have eaten up at least a weekend.

He handed the problem to Fable, intending only to have it brainstorm a few possibilities. Five minutes later, it came back with a short report: it had used dyld's `interpose` mechanism to hook the `malloc` family, compiled a dynamic library that rejected any allocation over 100MB, paired it with a mock server, and reproduced the exact crash stack trace, frame for frame.

It didn't list "possible causes" or a "debugging checklist." It skipped the guessing and went straight for the evidence.

What shook him even more was something else. He asked Fable to add a stats feature to the cache—a small task. Afterward, Fable casually mentioned: there's a bug here. `MemoryStorage` used a `Set` to track cache keys, and when `NSCache` evicted objects under memory pressure, it never notified the `Set`, leaving behind a batch of "ghost keys." He checked `git blame`—he had written that code himself in 2018. Seven years, thousands of issues, countless pairs of eyes scanning past it, and nobody noticed. Fable just happened to walk by and fixed it.

## The Joy of Casting Spells

onevcat used an apt metaphor: he had gone from a "wizard" to a "wish-maker."

The joy of programming comes from casting the spell itself. You understand the problem, break it down, write the solution with your own hands, and watch it run. That satisfaction of "I cracked a hard problem myself" is why many of us got into this field.

Now the Agent handles the spellcasting. You still have to understand the problem and break it down, but "writing the solution with your own hands" belongs to you less and less. What's left for you is figuring out what wish to make, and then verifying whether the Agent granted it properly.

I've felt something similar myself. Spending an entire afternoon tracking down a thorny issue feels completely different from having an Agent solve the same thing in three minutes. The latter is faster, yet something is missing—not the outcome, but the process, that feeling of wrestling with the problem.

![From casting spells to making wishes](/posts/images/coding-joy-stolen/coding-joy-stolen-01.png)

---

## It's Not a Bug, It's a Feature

Still, if we're honest with ourselves, the joy of that struggle is the enemy of efficiency.

Spending a weekend building a testbed, reading assembly, and reproducing a crash feels deeply rewarding. But your team and your users are waiting for a fix, not your sense of accomplishment. Confirming the root cause and shipping a fix in five minutes is the right answer for them.

**Stripping away the joy of programming isn't a side effect of AI—it's the main effect.** AI's core value is trading machine time for human time, and the most time-consuming parts of programming—debugging, investigating, trial and error—happen to be the most fun parts. Taking them away isn't an accident. It's the whole point.

Accepting this is hard. It means the skills you've been proud of are turning into something like typing speed—useful, but no longer scarce.

## The New Subject of Debugging

At the end of his post, onevcat mentioned that his focus had shifted from building user-facing features to helping his team set up Agent workflows. One line of his deserves to stand on its own:

"The subject of debugging has changed from memory and threads to processes, habits, and people."

An Agent can write code, fix bugs, and refactor, but it can't establish how a team should work with Agents. It can't decide which tasks belong to an Agent and which don't, how Agent output should be reviewed and accepted, or how to overcome psychological barriers like "teammates don't trust AI-written code." That work belongs to humans.

![The new subject of debugging: process, trust, and acceptance](/posts/images/coding-joy-stolen/coding-joy-stolen-02.png)

And the skills required for that work overlap heavily with what writing code taught us: breaking down problems, thinking in systems, making judgment calls under ambiguity. The difference is the subject—it moved from code to people and processes.

My own experience making this shift is that **a new kind of joy does exist, though it's nothing like the old one.** The old joy was like solving puzzles: clear feedback, and once it runs, you win. The new one is more like farming: long feedback loops, you plant something without knowing when it'll sprout, or even if you planted it right.

Not everyone can jump from the first kind of joy to the second. But if you dig your heels into the old spot, what you face isn't an Agent replacing you—it's a slower kind of burnout: watching an Agent finish your signature work in minutes every day, while your job is to grade its homework.

## A Quick Self-Check

If you also feel like "programming isn't fun anymore," ask yourself one question: when an Agent solves a problem in a way you didn't expect, what's your first reaction?

If it's "How did it do that? I need to understand this trick"—you're still learning, and the joy of casting spells will come back in a different form.

If it's "That should have been mine to solve"—you're not defending value, you're defending territory. And that feeling is only going to hurt more over time.

**Figuring out what wish to make is no easier than memorizing the spells.** Either way, it's the road our generation of programmers has to walk.
