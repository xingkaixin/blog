---
title: "Why Cheaper AI Code Means More Unnecessary Features"
summary: "When coding agents drive the marginal cost of writing code toward zero, the weakest link in the system becomes human mental bandwidth to say no. Edge requests that hand-coding costs once filtered out flood in, multiplying review and comprehension debt. What is scarce now is not code output, but the resolve to run git reset on spotless code."
coverAlt: "Why cheaper AI code means more unnecessary features"
sourceHash: "dd5dd353a7fb594c"
---

Last week I was maintaining a small CLI tool I built for myself. All I wanted was a `--json` flag so other scripts could parse its output.

I already had a coding agent open in my terminal, so I typed a quick line: "Add a --json option to the export command, matching the existing fields."

If I had written it myself, it would have been dead simple: touch two files, add a boolean flag, branch at the print site, serialize the struct, and be done in twenty minutes.

By the time I came back with a glass of water, the agent had built a whole architecture. It decided the existing output logic wasn't modular enough, extracted a Formatter interface on its own, implemented JSON, YAML, and plain-text formatters underneath it, and added a simple factory method. Along the way, it updated three caller modules, created 5 new files, and modified 11 places.

At the bottom of the terminal, all unit tests passed.

Back when I first started using AI for coding, I probably would have thought this tool was magic—ask for one thing, get three. Sitting in front of the screen looking at those hundreds of neat diff lines, though, I felt no relief, only sharp irritation. I hadn't planned on reviewing an 11-file architectural refactor today, and I certainly didn't want to maintain a factory class I would never use.

Still, I spent nearly half an hour reviewing that diff. Because the code itself was spotless, all the unit tests were green, and the logic flowed cleanly, it was hard to bring myself to just close it. In the end, I hit merge.

I regretted it the next day. A tool that used to fit in a 300-line script had somehow doubled in complexity.

![A small flag expanded into a full architecture](/posts/images/free-capacity-creates-demand/free-capacity-creates-demand-01.png)

In the past, the physical cost of implementation acted as a hard gate on whether a feature got built.

Whenever a slightly complex idea popped up, your brain instinctively ran the numbers: is this worth two days of coding plus half a day of testing and debugging? Any hesitation at all, and the idea got tossed aside.

Writing code by hand is tiring, and debugging is worse. Human engineers come with a built-in laziness, and most of the time that laziness is healthy—it blocks eighty percent of unnecessary whims from ever entering the system.

Today's coding agents have flattened the marginal cost of typing out code. Toss in two lines of prompt, and a few minutes later you have a presentable PR.

That physical gate that used to cut scope for you shattered on the spot.

Once the gate is gone, what floods into the codebase first isn't core architecture. It's all the edge requests you would have casually thrown out after doing the math. Since they seem "free anyway," not building them feels like leaving money on the table, so they march right into the repository.

When you let an agent run unsupervised, this bloat can spiral out of control.

Armin Ronacher once ran an experiment where an agent ran an unattended software factory for 35 hours, aiming to add virtual threads to CPython. It burned roughly 1 billion tokens, produced 79 commits and 75,000 lines of code, and delivered zero usable output.

Looking through the logs, the most absurd detail was the task list the agent maintained: it started out orderly with 1, 2, 3, 5, 5a, and by the end had spawned 8a, 8a1, 8b2c2b3, and even something called "8b2c2b2b checkpoint1".

With nobody hitting the brakes in between, it treated the half-baked output from its previous round as the new reality and kept assigning itself endless follow-up work.

Many people assume the biggest bottleneck after adopting agents is generation quality, but in practice, the biggest bottleneck is human mental bandwidth to say no.

Ben Vinegar shared how this felt on a podcast. He said his actual output hadn't improved recently, and his GitHub commit activity was even lower than before. The underlying bind was realizing he simply couldn't hold the quality bar he wanted.

Armin added a sharp observation: when a machine keeps opening PRs, saying no becomes materially harder.

Before, your output was capped by your typing speed. Write two PRs a day, and you or a teammate could review them in half an hour—the mental load stayed manageable. Now an agent can push ten PRs into your queue from the background in a single day.

Yet the human brain's bandwidth for digesting code hasn't grown by even 1% this past year.

Rejecting AI-written code often takes more energy than writing it yourself.

You have to figure out the intent behind it, check what unstated context it touched, and trace the logic through in your head. That comprehension pass burns just as much cognitive fuel as writing it from scratch. Worse is the cost of shattered attention: agents generate changes continuously, popping up a completion notification every half hour and breaking whatever main thread of thought you were holding.

Individual typing speed has been amplified, but everyone ends up paying the bill for code someone else generated on a whim.

Since physical cost can no longer stop code bloat, we have to build a few manual brakes back into our workflow.

After stepping on a few rakes over the past few months, I forced a few changes into my own workflow.

Before starting anything, answer an uncomfortable question: "If I don't make this change, who is going to bother me about it tomorrow?"

We used to ask, "How long will this take to build?" In the agent era, that question is useless, because the answer is always "five minutes." Now I only ask about consequences: is a production metric dropping, or is some high-frequency task genuinely blocking me? If I can't answer that—if it just feels "nice to have while I'm at it"—I move my cursor out of the prompt box immediately and don't send a single word to the agent.

Second, switch from on-demand interaction to offline batching.

Don't keep a terminal window open watching the agent spit out code turn by turn, and definitely don't jump over to review every time it opens a branch. That's trading your most expensive resource—attention—to babysit cheap compute.

Now I only review code once a day during a fixed time block. The rest of the time, I let it work in an isolated worktree or container. If it goes off track within that window, or touches a dozen unrelated files for a tiny feature, I don't review it, and I certainly don't try to steer it back in the chat box.

The most effective move—and the one that takes the most discipline against human inertia—is simply hitting `git reset --hard`.

Looking at neatly formatted code with all green tests, most people feel a twinge of reluctance to throw it away. It feels like keeping something that already exists has to be better than deleting it.

But the harshest truth in software engineering is that code is not an asset; code is a liability. Every line sitting in a repository charges you maintenance tax every single day into the future.

Whenever an agent's output crosses the physical boundary I set at the start, no matter how textbook-clean it looks, I don't read it and I don't accept it—I roll it back on the spot. Rewriting two tighter constraints and regenerating usually takes a tenth of the effort of accommodating its approach during a review.

![Rejecting out-of-scope changes](/posts/images/free-capacity-creates-demand/free-capacity-creates-demand-02.png)

People who keep their codebases lean and usable in the AI era don't get there by making models write faster.

**What actually separates people is how much code that looks completely fine you're willing to throw straight into the trash when it's pouring out without limit.**
