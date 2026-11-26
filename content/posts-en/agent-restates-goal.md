---
title: "We Discussed the Requirements for Ages, and the Agent Still Built Just an MVP"
summary: "Before an agent starts coding, have it restate the goal: what it will deliver, how deep it will go, what is out of scope, and how it will verify completion—surfacing scope mismatches in ten lines."
coverAlt: "We discussed the requirements for ages, and the agent still built just an MVP"
sourceHash: "39c7bfed0ae6fc94"
---

"Let's build an MVP first and get the main sign-up flow working."

Hand that sentence to an agent, and it will likely nod. Right before it starts coding, ask it to restate the goal in its own words, and you might hear: build a clickable sign-up page with mock data, no email integration, and no account persistence.

Meanwhile, the MVP in your head is something else entirely: real users can sign up, receive a verification code, and log in on staging—just without third-party login or password reset.

Neither side misunderstood the word "MVP." The term itself simply never specified which layer to stop at. Even after twenty minutes of discussing requirements, if you don't verify the destination at the end, both sides can still be talking past each other.

![Same MVP, two different endpoints](/posts/images/agent-restates-goal/agent-restates-goal-01.png)

## "Got It" Adds No New Information

In systematicls's long-form essay on Agentic Engineering, there is a sharp contrast. If you only say "build an authentication system," the agent has to research what authentication is, what options exist, and which one to pick. Once the task pins down JWT, `bcrypt-12`, refresh token rotation, and a 7-day expiration, it can spend its time on implementation.

![systematicls's Agentic Engineering essay](/posts/images/agent-restates-goal/source-systematicls-agentic-engineering.png)

In practice, of course, we rarely know every detail upfront. Often we rely on the agent to help us make those choices. The trouble begins after the choices are made, when research and implementation are still mixed in the same conversation: all three earlier options remain in the context window, while which one was chosen—and how far to build it—exists only in the human's head.

So the agent says "got it," and you feel like you've explained yourself clearly. That "got it" cannot be verified.

Having the agent restate the goal forces both sides to produce a short, checkable shared version. The restatement only needs four things: the deliverable, the depth of completion, what is explicitly out of scope, and how completion will be verified.

A useful restatement is not polishing prose. Its job is to expose depth and boundaries.

## Don't Paraphrase Word for Word

If you only ask the agent to "repeat the requirements," it will compress the conversation into smoother wording while leaving all the original ambiguities intact.

Take the sign-up MVP. A useful restatement looks like this:

> This delivery provides a working email sign-up flow usable on staging. Verification codes are sent via the existing email service, accounts are written to the current users table, and users can log in after signing up. Third-party login, password reset, and production deployment are out of scope. On completion, provide test results and walk through an actual sign-up and login.

There is nothing clever about this paragraph, but it turns "get it working" from a vague impression into a concrete position. Mock data vs. real database writes, prototype vs. usable on staging, sending emails or not—you can verify all of it at a glance.

If the project already has legacy accounts, another practical question surfaces right away: should this only ensure new users can sign up, or do existing users need to be migrated to the same auth logic? If the agent writes "handles new sign-ups only, does not migrate existing accounts" in its restatement, you can confirm it on the spot. Waiting until after the database schema is altered to discover the mismatch costs an order of magnitude more.

The same goes in the other direction. If you only wanted to validate a page layout, and the agent's restatement mentions database migrations, analytics tracking, and an admin panel, cut them immediately. Most scope creep doesn't happen halfway through implementation—it is already sitting in the initial plan, just never checked against the goal.

![Verify the goal with a four-line shared version](/posts/images/agent-restates-goal/agent-restates-goal-02.png)

## Confirm Before Coding

The best time for this check is right after research wraps up and before implementation begins. Restate too early, and key decisions haven't been made yet; check after half the code is written, and it's already too late.

One instruction is enough: "First, state in your own words which layer this delivery stops at, what's out of scope, and how you'll prove it's done. Wait for my confirmation before editing code." You don't need to generate a ten-page spec, and you don't need to invent a fancy name for this habit.

What you are checking isn't whether the phrasing looks nice—you are only looking for anything that differs from what you have in mind. When you spot a divergence, edit that line directly and let the agent start. If the goal shifts mid-execution, update this short block as well, so the agent doesn't have to scan the entire conversation to guess the latest decision.

You don't need a restatement on every turn. It pays off most when the discussion uses uncalibrated phrases like "build it first," "keep it simple," "get it working," or "full support," or whenever a task transitions from research to implementation.

Agents are very good at charging toward a goal. The catch is, it might be charging toward an endpoint you never approved.

Next time it says "got it," don't agree just yet. Make it lay that "got it" out in front of you.
