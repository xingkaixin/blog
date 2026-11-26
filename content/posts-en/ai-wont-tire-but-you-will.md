---
title: "You Think You're Reviewing Code, You're Just Clicking Merge"
summary: "AI splits the output curve from the judgment curve—the agent stays at full speed while your review capacity drops off in the afternoon. Your body no longer acts as a brake, so discipline has to: stop once you're only rubber-stamping, and leave the rest for tomorrow."
coverAlt: "You Think You're Reviewing Code, You're Just Clicking Merge"
sourceHash: "b0796c95ba835930"
---

By four o'clock last Friday afternoon, I had already merged twelve PRs.

Two years ago, that number would have been unthinkable. Back then, shipping two or three in an afternoon was a productive day. With Claude Code writing for me, though, each PR took an average of twenty minutes from generation to review to merge. The throughput was genuinely high.

By the thirteenth one, my mind started to drift. The agent had finished refactoring a piece of caching logic. I opened the diff; my eyes were scanning, but my brain wasn't really turning. I skimmed through it, thought "looks fine," saw all the tests were green, and hit merge. On Monday morning after deploy, our cache hit rate dropped 40%. When I dug in, I found a branch where the code bypassed the cache and hit the database directly. It was right there in the diff—if I had actually been reading.

Looking back, I did something pretty stupid that afternoon: I kept "working," but after a certain point, I wasn't reviewing anymore. I was just going through the motions.

---

## Two Curves, Split Apart by AI

When we used to write code by hand, a simple reality protected us: once you got tired, your output slowed down. Around three or four in the afternoon, your typing speed dropped, typos crept in, and the logic stopped clicking. You'd stand up to grab water, or switch to an easier task. Your body was telling you: "Take a break. Push any harder and quality will slip."

Output speed and judgment used to move together. When your output slowed down, you had fewer chances to make mistakes. The two curves dropped in lockstep, keeping each other in check.

AI split those two curves apart.

![Output curve and judgment curve](/posts/images/ai-wont-tire-but-you-will/ai-wont-tire-but-you-will-01.png)

The agent doesn't get tired. It's just as fast and just as confident at four in the afternoon as at ten in the morning. Ask it to write the thirteenth module, and its output looks no different from the first. The output curve is a flat line.

Your judgment curve, however, still slopes downward the way it always has. In the morning, you read every line of a diff, think through edge cases, and question the AI's design choices. By the afternoon, review turns into a quick glance, a check of the test results, and a merge.

**Output keeps accelerating while judgment is already slowing down. The gap between those two curves is where risk hides.**

The problem is that you don't feel the gap widening.

In an agentic workflow, you spend most of your time "looking," not "writing." Looking at agent output, looking at diffs, looking at test results. It feels much lighter than writing code by hand. Your hands don't ache, and you never hit that physical "I can't type another line" wall.

But judgment really does get depleted. Every PR you review forces a string of small decisions: Is this variable name right? Is error handling covered? Does this fit the existing architecture? None of those decisions are hard on their own, but they add up. By the thirteenth PR, my brain had stopped judging—it was only approving.

My body hadn't complained yet, but my judgment had already checked out.

That's why I could merge thirteen PRs in a row without stopping. If I were writing the code myself, I would have hit a wall by the seventh or eighth. Because I was only "watching" AI write code, it felt fine—after all, I wasn't doing any heavy lifting.

That illusion is dangerous. You're already on autopilot.

![Feels effortless, actually draining](/posts/images/ai-wont-tire-but-you-will/ai-wont-tire-but-you-will-02.png)

---

## Who Hits the Brakes for You

![Hitting the brakes](/posts/images/ai-wont-tire-but-you-will/ai-wont-tire-but-you-will-03.png)

You never needed anyone else to hit the brakes before. Your body was the braking system. When you couldn't keep writing, you slowed down; slowing down meant fewer mistakes. The whole system was self-regulating.

AI dismantled that self-regulation. Your hands don't get tired because AI is doing the typing. Your eyes don't get tired because you're skimming, not staring at a single line for ten minutes. Your output never slows down because the agent is always running at full speed. Every signal that used to make you stop has been bypassed.

So you have to do it yourself.

At first, I tried setting a time limit—say, no more than two hours of PR reviews a day. I quickly realized that metric was off. Sometimes an hour of reviewing three complex PRs pushed me to my limit; other times I could breeze through eight simple ones in an afternoon and still have energy left. Counting hours misses the point.

So I changed my approach. The metric that actually works isn't time—it's depth. After finishing each PR, ask yourself one question: Was I reviewing just now, or just confirming? If you were only confirming—seeing green tests and clicking merge—your review capacity for the day is spent.

**Stop as soon as you're "just confirming."**

Once it's spent, stop. Leave the rest for tomorrow.

Code quality used to be backstopped by typing speed: when you couldn't write anymore, you stopped. Now code quality is backstopped by discipline: you have to call it quits while you still feel "fine." Because by the time you realize you're "not fine," you've already waved through several bugs you should have caught.

AI isn't in a hurry. It can wait.
