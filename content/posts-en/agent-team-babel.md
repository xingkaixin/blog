---
title: "Agents Gave Everyone a Translator, but Teams Stopped Speaking the Same Language"
summary: "Agents can explain old code, but they cannot recover the trade-offs behind it. Not understanding my own module led me to bring design rationale out of the session and back into the codebase."
coverAlt: "Agents Gave Everyone a Translator, but Teams Stopped Speaking the Same Language"
sourceHash: "162fd91dccb13acf"
---

A little while ago, I went to add a small feature to an old project. When I opened a module I had written three months earlier, the code ran and the tests were all there—yet I could not explain why one layer of abstraction existed at all.

The naming was fine. The structure was clean. The comments left by the agent were even more thorough than what I usually write. What I lacked was the context from when the decision was made: why we went with this approach, and where the other two options fell short.

I had no choice but to dig through the session history. Three months ago, the agent and I spent twenty minutes comparing three designs, with all the trade-offs recorded in that chat. Reading it again today felt like reviewing someone else's design doc. All I had left behind at the time was "the agent is right, let's go with this," without ever restating the reasoning.

I am the only person in this codebase. Three months later, I had become the new maintainer of my own project.

## The Code Stayed; the Choices Didn't

[In "The Tower Keeps Rising," Armin Ronacher](https://lucumr.pocoo.org/2026/7/13/the-tower-keeps-rising/) uses the Tower of Babel to explain collaboration in the age of agents: people can still make bricks and lay walls, yet they lose the shared language that makes engineering collaboration possible. In a software project, that language is the team's shared understanding of module boundaries, constraints, and design rationale.

What I ran into was a single-person version of that same problem. Agents are great at reconstructing explanations from existing code. Ask what a function does, and it walks through it line by line. Ask it to modify an old module, and it comes up with a coherent justification.

Some information cannot be fully reverse-engineered from the finished artifact: what was ruled out at the time, which piece of complexity was left in on purpose, and what changing condition should trigger a re-evaluation. Those belong to the situation in which the decision was made. Once the session closes, that context starts to slip away. Open a new session and ask again, and the agent may deduce a different path that sounds just as plausible.

In a team, the impact is even quieter. One person tweaks the cache for throughput; another updates storage for consistency. Each person's agent can make its local piece work. The two changes may not even conflict, yet the assumptions they rely on have already diverged. The cost only surfaces when a future requirement touches both areas at once.

![Translators exist, while shared understanding slips through the cracks of the tower](/posts/images/agent-team-babel/agent-team-babel-01.png)

## Consensus Still Erodes When Tests Pass

Compile errors show up right away; the loss of shared understanding does not. Tests check the expectations a team has already written down, not whether everyone still holds the same mental model of the system. As long as local behavior passes assertions, code keeps getting merged and features keep shipping.

The first thing to go is intuition for the system: which modules a change here will ripple through, and which boundary has broken before and shouldn't be crossed casually. That rarely lives inside any single function, yet it decides whether people can change the system safely.

By the time a small change sets off a chain reaction, everyone realizes each module looks reasonable on its own, yet no one can explain the whole picture. Code review doesn't save you either, because an agent can generate a polished change description on demand. A thorough-looking summary doesn't mean the author actually grasps the judgment inside it.

## Adding Friction Only to Judgment

After that experience, I don't plan to use agents any less. Formatting and looking up APIs were never worth burning human brainpower on anyway. I just want to put a bit of friction back wherever a design trade-off happens.

Whenever an agent is involved in choosing an approach, I leave a short note before closing the session: what we picked, what we gave up, and what condition would require revisiting the call. Small changes go into the commit message; cross-module decisions go into project docs. Length doesn't matter—what matters is that I write those few sentences myself.

When code is ready to merge, I also need to be able to explain the intent without relying on an agent. For personal projects, I explain it to myself three months from now; for team projects, to whoever the change will affect. If I can't explain it clearly, I don't let the agent write the summary yet—it means I haven't finished understanding it.

This adds a few minutes of articulation cost, without forcing anyone to rewrite the implementation by hand. Putting that small check between the session and the codebase gives the next person a chance to actually inherit the reasoning.

![Write the rationale from the session in words your future self can still understand](/posts/images/agent-team-babel/agent-team-babel-02.png)

## Leaving Notes for Yourself Three Months Later

In the end, that small change cost me half a day, mostly spent digging through old sessions and re-evaluating the three options. More detailed code comments wouldn't have solved it, because the only line I really needed was: "Chose A because of X; B doesn't hold under condition Y."

**Agents can speed up implementation, but the reasoning behind a decision still has to pass through a person before it lands in the codebase. Otherwise, three months from now, the person inheriting that code might still be you.**
