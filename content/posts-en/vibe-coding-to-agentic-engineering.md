---
title: "Vibe Coding Is Dead: What Karpathy's Agentic Engineering Actually Changes"
summary: "Exactly one year after coining Vibe Coding, Karpathy retired it and introduced Agentic Engineering—where you spend 99% of your time orchestrating agents and supervising output rather than writing code directly. The core workflow shifts from casual prompting to Plan→Execute→Verify, making spec writing, code review, and system design the new differentiators."
coverAlt: "Vibe Coding Is Dead: What Karpathy's Agentic Engineering Actually Changes"
sourceHash: "03c0d8278ad19075"
---

On February 2, 2025, Andrej Karpathy posted on X. He later said he wrote it off the cuff in the shower.

The post defined a new way of programming: Vibe Coding—where you fully give in to the vibes, embrace exponentials, and forget that the code even exists.

The post blew up. Within a year, "Vibe Coding" was in every Slack channel, every tech conference keynote, and every VC pitch deck. Collins Dictionary named it Word of the Year. Search volume surged 6,700%. In Y Combinator's Spring 2025 batch, 25% of startups claimed 95% of their code was AI-generated.

Then, on February 4, 2026, Karpathy posted again.

The gist: Vibe Coding is obsolete.

He noted that a year later, programming via LLM agents is becoming the default workflow for professionals, but with far more oversight and scrutiny than the early "forget the code exists" days. He gave this new way of working a name: **Agentic Engineering**.

A term went from birth to being retired by its own creator in just 365 days.

Behind the name change is a fundamental redefinition of the developer's role.

---

## 1. What Actually Went Wrong with Vibe Coding

Let me be clear up front: this post isn't here to dismiss Vibe Coding.

Even today, when I'm prototyping, building weekend projects, or validating a new idea, I still "vibe." Open Cursor or Claude Code, describe what I want in natural language, let AI generate the code, run it to see how it looks, and prompt again if it's off. In under an hour, you can have a decent demo. For scenarios where you can tell at a glance whether the result works, that efficiency is revolutionary.

The problem shows up in the next step—**when you try to ship Vibe Coding output to production.**

Starting in the second half of 2025, some ugly incidents surfaced across the industry. Amazon instituted a 90-day reset on code deployment controls after at least one incident linked to an AI coding assistant. An Amazon executive cited "high blast radius changes" in an internal memo—software updates spreading widely due to a lack of control-plane safeguards.

The issue isn't Vibe Coding itself; it's skipping design thinking.

Think about it: Vibe Coding essentially solves a "creation problem"—making code effortless to produce. But it exposes a deeper "confidence problem"—you have no real certainty about that code's quality, security, or maintainability.

That uncertainty doesn't mean you're a bad engineer; it's because you never read the code. By Karpathy's original definition, the defining trait of Vibe Coding is not reading diffs. You prompt, you accept, you run it, you see if it works. If it breaks, you paste the error back in and go another round.

That's fine for a weekend project. But when you bring the same habit into a system with real users, real data, and real security threats, "not reading diffs" stops being a stylistic choice—it becomes an exposed risk.

There's also a subtler issue: **the word "Vibe" itself became a liability.**

Google engineer Addy Osmani wrote a line in a widely shared blog post that's funny because it's true: "When you tell a CTO that you're vibe engineering their payment system, you can see the concern on their face."

"Vibe" conveys casualness, experimentation, and winging it. That clashes completely with the reliability, control, and auditability professional software engineering demands. The industry needed a new term for a workflow that captures AI's productivity while keeping engineering discipline intact.

---

## 2. What Agentic Engineering Actually Means

Karpathy's definition is precise and worth unpacking word for word.

He said: **"agentic" because the new default is that you are not writing the code directly 99% of the time, you are orchestrating agents who do and acting as oversight. "engineering" to emphasize that there is an art & science and expertise to it.**

Put more plainly: **your role shifts from "code author" to "agent architect + code reviewer."**

This doesn't literally mean you stop writing code. You still need to understand code, and you still need to read every line an agent produces. The difference is that your center of gravity moves from "hand-writing implementation" to "designing intent + reviewing output."

![Casual Vibe Coding flow vs. structured Agentic Engineering flow](/posts/images/vibe-coding-to-agentic-engineering/illustration-01.png)

We can contrast the two workflows directly:

**Vibe Coding workflow:** Have an idea → prompt directly → accept AI output → run it → paste errors and retry if it fails. No planning step, no review step. Blazingly fast; quality is up to luck.

**Agentic Engineering workflow:** Write a spec or design doc first (you can have AI help draft it, but you review it) → break the work into clearly defined tasks → hand each task to an agent → review the agent's code like you would a human teammate's PR → run tests, and merge only when they pass.

Three differences stand out between the two.

**Planning first.** Before touching anything, you spell out what you actually want. It reminds me of an earlier post I wrote—"You think you're writing a spec, you're actually taking a detour to write code." Back then, my point was that many developers saw specs as a waste of time. In the Agentic Engineering era, though, the spec's consumer has changed from humans to agents. Agents don't read between the lines, don't grasp your product context, and won't proactively ask, "Are you sure you want to do it this way?" The vaguer your spec, the more random the code it writes. A spec is no longer a formality; it is the input quality for your agent.

**Reviewing code.** I've talked about this in earlier posts too—in the AI era, a developer's core skill is shifting from writing code to reviewing code. Agentic Engineering locks that trend into a formal process. You aren't doing an optional code review; you're working like a senior editor reviewing a junior writer's draft. If you can't explain what a module does, it shouldn't be merged.

**Testing is king.** Osmani put it bluntly in his post: testing is the biggest differentiator between Agentic Engineering and Vibe Coding. Vibe Coding's test strategy is "run it and see if it works." Agentic Engineering requires systematic automated testing, because when agents are opening dozens of PRs a day for you, you cannot inspect every line by eye—you need tests as your safety net.

---

## 3. What This Looks Like in Practice

Enough theory—let's talk about how it works on the ground.

Mainstream Agentic Engineering workflows have converged on a core loop: **PEV—Plan → Execute → Verify.**

**Plan phase:** You write design docs, define the architecture, and break down tasks. AI can assist here (for instance, having Claude draft an initial architecture proposal from your requirements), but the final architectural calls must be yours. Agents are good at solving local problems under given constraints, not at making global trade-offs across multiple modules.

**Execute phase:** Hand the scoped tasks to an agent. You can run Claude Code in the terminal or Cursor in the IDE—the tool matters less than task granularity. A good task is "add an email-change feature to the user settings page with validation rules X, Y, Z, and run existing tests when done," not "build out the user system for me."

**Verify phase:** Review the code, run tests, and run security scans. How strict this phase is directly determines whether you can ship agent output to production. Stripe has an internal system called Minions where agents produce over 1,000 merged PRs per week. Without a systematic automated verification pipeline backing it up, operating safely at that scale would be impossible.

![Plan → Execute → Verify](/posts/images/vibe-coding-to-agentic-engineering/illustration-02.png)

PEV isn't proprietary to any single company; it's an industry consensus forming organically. Implementations vary across teams, but the core logic is the same: **think it through first, let the agent execute, then verify rigorously.**

---

## 4. What This Means for You and Me

With the concepts out of the way, let's bring it down to the individual level.

### If you write code every day

![For people who write code every day](/posts/images/vibe-coding-to-agentic-engineering/illustration-03.png)

In the Agentic Engineering era, the skills worth investing in are shifting.

Previously, you spent huge amounts of time building "typing speed for code"—memorizing APIs, recalling design patterns, and implementing features quickly on the keyboard. Those skills still have value (you have to understand what an agent writes to review it), but they are no longer the decisive differentiator.

The new differentiators include:

**Writing clear intent.** That means specs, PRDs, and design docs. Many engineers used to see this as "the PM's job," but in a world where agents are the executors, the more precise your instructions, the higher the output quality. At its core, this is a technical writing skill.

**Judging code quality fast.** You don't need to read every line slowly, but you do need to scan a diff in 30 seconds and tell whether "this change is going to blow up." That intuition comes from experience—from seeing enough good and bad code over time.

**Big-picture system design.** Agents are strong at local implementation—tell them to build a function, a component, or an endpoint, and they'll do a solid job. But for cross-module architectural decisions like "should this data live in cache or the database?" or "should these two services communicate synchronously or via async messaging?", agents can barely decide for you. Those calls require understanding business context, performance constraints, and your team's operational capacity. The stronger AI gets, the more valuable architects become.

### If you're an engineering manager

There's a new concept worth paying attention to: **Cognitive Debt.**

![Cognitive Debt](/posts/images/vibe-coding-to-agentic-engineering/illustration-04.png)

We all know technical debt—quick hacks in code that compound into future maintenance costs. Cognitive debt is similar, except it accumulates at the AI interaction layer: poorly managed agent runs, lost context, and unreliable agent behavior all pile up over time.

For example: your team starts using agents to write code, but without shared spec templates, agent usage guidelines, or automated review pipelines. Three months later, your codebase is full of code that "works, but nobody can explain why it was written that way." That's cognitive debt.

In 2025, technical debt was the biggest headache for engineering teams. In 2026, cognitive debt may take its place.

---

## Wrapping Up

Back to Karpathy's timeline.

In February 2025, he thought up Vibe Coding in the shower. In February 2026, he retired it on X.

Over those 365 days, the AI coding tools market reached $12.8 billion, Claude Code crossed $2.5 billion in annualized revenue for Anthropic less than a year after launch, and Cursor surpassed $2 billion in annualized revenue.

To me, though, the most important shift isn't the numbers—it's the industry's mindset maturing: **from "AI is so cool, let it write my code" to "AI is so powerful, how do I manage the code it writes for me."**

Karpathy closed with a line that captures Agentic Engineering better than anything else:

**The developers who perform best in the future won't be the ones who prompt the fastest—they'll be the ones who think most clearly about what to build and why.**

AI is getting stronger at an exponential pace. But "thinking clearly"—for now—hasn't been solved by any model. That may be the most durable moat our generation of developers has.

---

*Does your daily workflow look more like Vibe Coding or Agentic Engineering right now, or are you still stuck somewhere in between? Let's talk in the comments.*

*If you found this useful, hit Like so more engineers can see it.*
