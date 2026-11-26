---
title: "You Think Your Agent Is Debugging—It's Actually Guessing"
summary: "When an agent keeps failing to fix a bug, it usually isn't lacking intelligence—it's lacking runtime evidence. Given only source code, it can only do static reasoning, which is just guessing. The fix isn't a stronger model; it's making the program speak first through logs and building observability into the system so agents can investigate and improve it autonomously."
coverAlt: "You Think Your Agent Is Debugging—It's Actually Guessing"
sourceHash: "993155e4b44959d3"
---

I asked the agent to fix the same bug for the fifth time.

Every round, it sounded completely certain: root cause found, this should fix it. Then I ran the app, and the exact same error came back.

Its loop was always the same: read the code, construct an explanation, write a new patch, wait for the result. When that failed, construct a new explanation, write another patch. Watching it spin through those rounds, I realized it was trapped in a source-code loop—imagining a dynamic system from static text. Put plainly, it wasn't debugging. It was guessing.

Lately I've been building a small local tool: a worker collects sessions left behind by several coding agents on the same machine, and a frontend aggregates them for review. While tracking down bugs in that tool, I noticed a consistent pattern. Whenever I withheld runtime output, the agent started inventing hypotheses from the source code. The moment I pasted a few lines of logs, it usually pinpointed the problem right away.

**What determines debugging quality isn't how smart the agent is—it's whether it has evidence from the program actually running.**

---

## A Classic "Wrong Layer" Fix

Take something that just happened.

The frontend kept rendering an empty list. For the first few rounds, the agent kept changing the rendering logic: first suspecting state wasn't updating, then suspecting missing effect dependencies. Three patches later, the list was still empty.

I told it to stop changing logic and add logs in three places: how many sessions the worker received, what the API returned, and what went into and came out of the frontend filter function. I reproduced the issue once and pasted the output back.

The diagnosis flipped immediately: the worker had collected 12 sessions, the API returned all 12, and a mistyped condition in a frontend filter dropped every single one of them. The bug had been in the filtering layer all along—it had nothing to do with rendering. The first three patches all landed on the wrong layer.

It wasn't stupid. For those first three rounds, it only had code, so it couldn't see that those 12 records had already reached the frontend. **It kept patching around a false assumption that a single line of logs would have disproved.**

![Data flow and misdiagnosis: Worker → API → Filter → Display, with the agent's first three patches hitting the wrong layer](/posts/images/agent-guesses-not-debug/agent-guesses-not-debug-01.png)

---

## Given Only Source Code, It Can Only Reason Statically

To see why this happens, look at the agent's situation.

When you ask it to fix a bug, what it gets is mostly code: functions, call chains, type definitions. It reads them and mentally simulates how the code "should" run. Notice the word "should"—that's static reasoning, imagining a moving program by staring at text that doesn't move.

Humans do this too. The difference is that an experienced engineer stops when stuck and calibrates against reality: set a breakpoint, print an intermediate value, glance at a log, and check whether the mental execution model is wrong.

An agent with only source code has no such step. It treats "imagined execution" as "actual execution," pushing deeper round after round on an unverified assumption. When the assumption is wrong, the harder it reasons, the further off track it goes.

![Static reasoning vs. runtime observation: the world in source code vs. the world at runtime](/posts/images/agent-guesses-not-debug/agent-guesses-not-debug-02.png)

---

## A Stronger Model Just Guesses Slightly Better

Before noticing this, I tried a few approaches that felt more thorough.

Passing all related files, switching to a stronger model, writing more detailed instructions—I gave it all the context, which is just table stakes anyway. Those help it "think harder," not "see what actually happened."

A stronger model does guess better and picks up more clues from the code. But "slightly closer" and "actually seeing it" are two different things. A race condition, a cache that only goes stale on the third call, an upstream field that quietly turns `null` under a certain input—none of that lives in the literal text of the code. It only happens when the program runs. No matter how strong the model is, it can't read a fact that isn't written in the source.

When a bug fix heads in the wrong direction, what's missing usually isn't brainpower—it's the crime scene.

---

## Who Observes Doesn't Matter; Whether You Can Observe Does

So I changed the order: observe first, then touch the code.

When a bug shows up, instead of saying "fix this," I ask the agent to break out an observation step first—list the most likely hypotheses, design a minimal probe for each (which variable to print, in which branch, what output is expected, what output would falsify it), and add only logs without changing behavior. I reproduce the bug once, paste the output back, and then let it fix the code against real output. That patch usually works on the first try.

One detail that's easy to miss: logs have to answer a question, not just say "got here." A good probe makes things explicit—what the input was, which branch ran, where state went dirty, and which layer the output diverged at. In that empty-list bug, it was "what went in and out of the frontend filter" that snapped the investigation back onto the right track.

You might say an agent with execution permissions can run the app, add `print` statements, and read logs itself—why should a human copy-paste them? Fair point. My "human reproduces, human pastes back" workflow was an artifact of the tools and habits at the time, not something agents are incapable of.

That only proves the bottleneck was never "who feeds the evidence." Even when the agent runs everything itself, if critical paths have no logs and state transitions leave no trace, all it sees is a bare stack trace. It's still guessing—just in a different loop. **Whether a bug can be debugged doesn't depend on whether a human or an agent supplies the evidence; it depends on whether the system is willing to expose what happened at runtime.**

---

## Observability Is the Prerequisite for Automation

So the real fix isn't sprinkling temporary `print` statements during a debug session. It's making the system observable by default. When critical paths, state transitions, and external calls leave a trail, the starting point changes completely—the evidence is already there, without waiting for something to break before you instrument it.

The payoff goes far beyond helping humans track down bugs faster. Once a system is observable enough, an agent can read the output, isolate the cause, and propose a fix on its own, while you step back into a reviewer role. It no longer waits on you to reproduce the issue and paste logs, because it can pull the runtime facts directly.

I later applied this same idea to [Daily Cloudflare Log Patrol with an Agent](/en/posts/agent-daily-log-patrol/): read logs, compare against a baseline, compile anomaly evidence, and let a human decide whether to ship a fix.

That's the real point: observability isn't just a post-mortem tool for humans cleaning up after an outage. It's the infrastructure that lets agents investigate autonomously and improve an application on their own. Every probe you build into a system paves the way for future automation. Conversely, plug even the strongest agent into an unobservable system and it can only spin in the source-code layer—you think you hired a debugger, when you really just hired a guesser.

![The observability pyramid: from infrastructure to agent automation, with humans stepping back into review](/posts/images/agent-guesses-not-debug/agent-guesses-not-debug-03.png)

---

## Wrapping Up

So the division of labor isn't as simple as "humans supply evidence, agents reason." A better rule is: make the system observable first, and whoever investigates next will have an easy time.

The next time an agent starts writing a second or third patch for the same bug, pause and ask three questions: What is this patch's hypothesis? What runtime evidence supports it? What log output would falsify it?

If it can't answer, don't let it touch the implementation yet—make the program speak first. And if the program can't speak at all, what needs fixing isn't your prompt. It's your system's observability.
