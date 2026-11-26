---
title: "SDD's Biggest Illusion: You Think You're Writing a Spec, You're Just Writing Code the Long Way"
summary: "Spec-Driven Development hasn't solved software engineering's hard problems—a sufficiently detailed spec is just code in another syntax. It also pulls teams back toward waterfall, hiding uncertainty behind an illusion of complete documentation, while everything the spec misses becomes the system's blind spot."
coverAlt: "SDD's Biggest Illusion: You Think You're Writing a Spec, You're Just Writing Code the Long Way"
sourceHash: "e871258fc5876cd0"
---

Spec-Driven Development has been everywhere over the past six months.
A lot of people buy into a simple promise: write a detailed enough spec first, hand it to a coding agent, and both quality and speed will go up together.

I almost believed it myself. Then I read Gabriella Gonzalez's _A sufficiently detailed spec is code_ alongside STRRL's thoughts on Spec-Driven Development, and it became increasingly clear: SDD hasn't eliminated the hard problems of software engineering. It just disguises them and pushes the explosion further down the road.

I'm not against writing specs. What I have a problem with is treating specs as a silver bullet—a shortcut around engineering judgment, iterative feedback, and the realities of maintenance.

## A Sufficiently Precise Spec Is Just Code

In her post, Gabriella breaks down OpenAI Symphony's `SPEC.md`. She points out that much of this so-called "specification" is already pseudocode, structured algorithms, field definition lists, or text literally shaped like code.

You see data structure fields listed one by one with detailed type constraints and states, concurrency controls and retry policies given as explicit formulas and thresholds, and even a dedicated "Cheat Sheet" added so the model can "implement faster."

To get an agent to reliably generate working code, you have to write the spec at nearly the precision of code itself. Once you're at that level of precision, you're no longer writing a "lighter-weight upfront description." You're just programming in a different syntax.

This echoes something Dijkstra pointed out long ago: collaboration in complex systems relies on narrow interfaces, and loose, conversational phrasing doesn't reduce the work—it just shifts it into higher communication overhead and more ambiguity. You cannot lower expressive precision and expect implementation reliability to go up.

## SDD Often Pulls Teams Back to Waterfall

One point in STRRL's post really resonated with me: after using SpecKit for a while, the workflow turns into "design upfront + simulate in your head + ship a massive batch all at once," leaving huge PRs sitting around that nobody dares to merge.

That runs directly counter to the hard-won consensus of modern software engineering. Software isn't designed once and for all; it grows through continuous change. Requirements change, boundaries change, constraints change, and our understanding changes.

What happens most often in SDD practice is that "exploration in the middle of change" gets prematurely frozen into "certainty on paper." To keep the agent from making mistakes, you force yourself to think through tons of details before writing a single line of code. It looks more "disciplined," but mostly it just hides the uncertainty.

Before long, the cadence quietly degrades into: spend a huge amount of time writing a spec, generate a huge amount of code in one shot, watch it blow up together at the end, and then manually clean up the mess. At its core, that's just waterfall with a modern coat of paint.

## Where the Spec Ends, the Blind Spots Begin

SDD proponents often say: as long as the spec is good enough, the agent will deliver reliably.

The catch is that the hardest parts of engineering are usually the parts you didn't anticipate. STRRL put it bluntly: the parts covered by the spec run okay, and everything outside it is a pile of garbage. Gabriella tested this too—she had Claude Code generate a Haskell version of Symphony from its spec, and the result was unreliable, with unexpected behavior persisting even after multiple rounds of fixes.

This isn't an isolated case. Even for a standard like YAML, which has an extraordinarily detailed spec and a conformance test suite, plenty of real-world implementations still don't fully match the specification.

So the real question isn't "do you have a spec?" It's: do you accept that a spec can never be complete, have you built fast feedback and correction loops for everything outside the spec, and is your engineering quality grounded in verifiable loops rather than the illusion of complete documentation?

A spec defines boundaries, which means it also creates boundaries. Everything beyond those boundaries is a blind spot.

## When Specs Chase Speed, They Become "Spec-Shaped Slop"

In theory, writing a spec should be slower, more deliberate, and more abstract than writing code. In reality, under the pressure to "ship fast," specs often turn into another assembly-line artifact: full of sentences, packed with terminology, professional-looking in structure, yet lacking real design judgment and coherence.

Gabriella criticized parts of Symphony as reading like "specification-shaped sentences," and I think that's spot-on—it looks like a spec, without the density of thought a spec actually requires.

If you use AI to quickly generate a "decent-looking spec," and then ask AI to generate code from that spec, you're putting the intent through two rounds of lossy compression and two rounds of semantic drift. Each layer looks like "refinement," while the actual information is leaking away.

In the end, what you get isn't "Spec-Driven Development." It's prompt-driven docs, doc-driven prompts, and a human left holding the bag at the end.

## Stop Treating Specs as a Silver Bullet—Put Them Back in the Toolbox

My own approach now is more conservative, and more pragmatic:

I still write design docs for critical systems, but only for key decisions and key constraints. I don't aim for upfront completeness; I aim for small, verifiable steps. I let agents produce output quickly, while grounding quality in tests, regressions, and review loops. Documentation exists to serve communication and decisions, not the fantasy of getting it right in one shot.

I'm not against specs. I just think treating them as a silver bullet that can replace engineering judgment, iterative feedback, and long-term maintenance experience is naive.

The highest cost in software engineering has never been typing out code. It has always been understanding the problem, making trade-offs, and owning the consequences. And SDD hasn't solved that part.

---

When you're writing a spec, pause and ask yourself: is this actually helping you clarify your thinking, or just helping you pad out a longer prompt? There's a big difference between the two.
