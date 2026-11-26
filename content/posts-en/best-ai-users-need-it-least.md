---
title: "The Best AI Users Need AI the Least"
summary: "With the exact same tool, senior engineers ship fast and steady while junior developers leave hidden landmines that explode three months later. AI is an amplifier—it magnifies the judgment you already have, so put in the slow, unglamorous work where AI can't help."
coverAlt: "The Best AI Users Need AI the Least"
sourceHash: "f4b79ffc2829a92f"
---

A while back in a tech group chat, someone asked: how many lines of code can you write in a day with Codex?

The replies were telling. A few senior engineers threw out 10,000 to 20,000—they were using AI for large-scale refactors, touching dozens of files in one go. A few folks with one or two years of experience quoted numbers that weren't much lower, 5,000 to 8,000, though they added a caveat: it took several rounds, and a lot got thrown away.

At first, I thought it came down to prompting. Then I looked at the code both groups actually submitted, and realized that wasn't it at all.

Out of the seniors' 10,000 lines, most were generated in one pass, skimmed in a diff, and merged. Their instructions were precise—which auth methods to support, what status codes to return on expired tokens, how to wire into the existing user model. With those constraints in the prompt, the AI followed through and produced something usable right out of the gate.

Of the juniors' 5,000 lines, more than half came from a loop of "generate, fail to run, delete, re-describe, regenerate." The code eventually worked, sure, but they couldn't explain why it worked.

Same tool, a tenfold gap in quality.

---

## You Have to Know What the Answer Looks Like First

Ask AI to write an auth middleware, and a senior engineer will tell it: support both JWT and sessions, put refresh logic in the middleware rather than the route layer, and reuse the existing user model. None of those constraints come from some prompt engineering playbook—every single one comes from getting burned on authentication before. They know that if they leave those out, the AI will improvise.

And a junior? Their prompt might just be "write me an auth middleware." The AI hands back a version—it runs, uses JWT, ignores refresh tokens, and invents its own user model. The junior looks at it and thinks it's great, because they don't know what else they were supposed to account for.

**You have to know roughly what the answer looks like before you can judge whether the AI got it right.** The better you know a domain, the sharper your instructions and the faster your review. The less you know, the more you accept whatever the AI hands you, unable to even spot where it went wrong.

The people who get the most out of AI are the ones who could still do the job if you took AI away. To them, AI is an accelerator, not a crutch.

![You have to know what the answer looks like first](/posts/images/best-ai-users-need-it-least/best-ai-users-need-it-least-01.png)

## An Amplifier Has No Sense of Direction

I once mentored an intern who was sharp and better with AI tools than I was. In a single afternoon, he built a file upload service with Codex—feature-complete, all tests green.

The day it went live, two things broke. Large files weren't chunked, so anything over 100 MB blew up memory. And the file storage path was hardcoded as an absolute path, so moving it to another machine broke every lookup.

AI won't bring up either of those on its own. Chunking and path handling are easy for AI to implement—it just doesn't know what you don't know.

AI is an amplifier, and an amplifier has no sense of direction. Give it a solid set of constraints, and it wipes out 80% of the grunt work with steady output. Give it a vague description, and it will still confidently hand you something that looks complete—runs fine, passes tests, clean structure—while hiding assumptions you don't even know to look for.

I told that intern afterward: AI brought your production speed up to a senior engineer's level, but your judgment speed is still your own. Output got faster; your ability to gatekeep didn't grow with it.

![An amplifier has no sense of direction](/posts/images/best-ai-users-need-it-least/best-ai-users-need-it-least-02.png)

## The Gap Is Widening, and the Old Path Is Narrowing

AI isn't leveling the playing field; it's widening the gap.

With the exact same tool, seniors ship fast and steady while juniors leave hidden landmines that explode three months later. The gap isn't in the tool—it's in the judgment behind it.

And that's not even the hardest part.

You used to spend two or three years writing code slowly, stepping on rakes, and growing judgment organically through the act of building. Coding was the vehicle; judgment was the byproduct. Now AI takes over most of the implementation layer, which means far fewer chances to build intuition just by grinding out code. Half the old path is blocked off, and a new one won't build itself.

## There's No Shortcut to Judgment, Just Deliberate Habits

If you're early in your career, reading this might feel discouraging. Weak fundamentals mean you can't wield AI well, and not wielding it well makes it harder to build fundamentals—a catch-22?

Not quite. But you do need to be honest about one thing: how you use AI determines whether you're building skill or burning opportunities.

If every time you toss AI a one-liner, run what it gives you, and paste back stack traces when it breaks—you can repeat that loop a thousand times and only ever practice "how to talk to AI," never "how to understand the problem."

A friend of mine recently got a requirement to build a recommendation system. His first instinct was to ask AI for code, and AI gave him a thorough-looking plan: collaborative filtering, cold-start handling, offline compute pipelines, the works. Then he spent an afternoon talking to the product manager and discovered the real bottleneck wasn't "what to recommend," it was "we have no data"—the system had just launched, user event logs weren't even wired up yet, so collaborative filtering couldn't run at all. The final plan became simple rule-based ranking plus event tracking, with models to follow two months later.

That call—fix data first or build the algorithm first—is something AI can't make, because it doesn't know the state of your system. Yet that call decides the direction of the entire project.

Here's one thing worth trying: before you let AI propose a solution, spend five minutes sketching your own. It doesn't have to be complete or right—even three rough lines on paper saying "here's how I'd approach it." Once you have that, you read AI's output differently. Where does it match your thinking, where does it diverge, and which one makes more sense? That comparison is where the real learning happens.

Another habit: after AI gives you a solution, force yourself to ask "why" once. Not to hunt for a textbook answer, but to train yourself to care about design trade-offs.

![There is no shortcut to judgment, just deliberate habits](/posts/images/best-ai-users-need-it-least/best-ai-users-need-it-least-03.png)

**AI amplifies what you already have; it won't fill in what you're missing.** So the strategy is simple: use AI to move faster, while putting in the slow, unglamorous work where it can't help you. Domain knowledge, systems thinking, problem decomposition—those take time to build, and once you have them, AI makes them worth even more.

*Next time someone asks "how many lines can you write in a day with AI," try asking yourself instead: without AI, which parts of this code could I have written on my own?*
