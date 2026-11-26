---
title: "Why One Wrong Note in Agent Cross-Session Memory Is Worse Than Having None"
summary: "Benchmarks on Pokémon Red and CL-Bench show that storing live state in cross-session memory slows tasks down, while a \"failures-only\" rule hurts scores too. Keep only verified strategies and constraints, and reconcile them against raw transcripts regularly to stay on track."
coverAlt: "Why One Wrong Note in Agent Cross-Session Memory Is Worse Than Having None"
sourceHash: "c5199572b4b8ca12"
---

In a [report](https://www.anthropic.com/research/components-of-agent-memory) published on November 6, 2026, Anthropic compared how two models played _Pokémon Red_ with a memory directory.

At around the 10,000-step mark, Sonnet 3.7 had written 413 files across 225 folders—totaling 977,930 characters—and earned only 1 badge. Fable 5 kept just 2 subdirectories and a top-level `global.md`, totaling 10 files and 43,406 characters, and earned 4 badges.

The difference was what they chose to write down. Sonnet 3.7 saved every battle, every item, and every NPC it encountered to disk, even though money and coordinates change on every step. Around step 10,000, it created a fourth master index directory, then spent the next 17 steps creating 6 files and deleting 9 without advancing the game a single step.

Fable 5 did not copy live state that was already visible on screen. It recorded only patterns the game never states explicitly. The top-level file held goals, gym plans, and memory rules, while the two subdirectories stored routes and trial-and-error lessons. After missing 7 Poké Balls in a row on a Magikarp, it wrote down a rule: after 3 or more consecutive misses, change the menu button-press timing. Following that rule, it caught the Magikarp right away.

## How One Wrong Note Keeps Derailing New Sessions

Piling up stale state only slows progress; writing down a wrong premise derails future sessions. In another experiment using Managed Agents with mounted memory at Mt. Moon, the cave enters from the west and exits to the east, with a Pokémon Center and a one-way ledge outside the west entrance that drops you back to where you started.

The model misrecorded the Pokémon Center as being "on the east side." Later, when it walked out of the Pokémon Center, it followed that note, declared "Mt. Moon is behind us," updated the note to "Mt. Moon completed," and promptly fell off the ledge a few steps later.

Because the navigation tool did not show terrain elevation drops, the model reasoned from its wrong note that it had "walked too far west," convinced its direction was right. After falling off the same ledge three times, it output a message preparing to stop to avoid looping. An automated system reply told it to keep going, so it retreated all the way back to the previous town, Pewter City, to resupply, and never reached Cerulean City before the run ended.

In the same comparison, the no-memory group also failed to reach Cerulean City. But the wrong note left behind a false premise that looked certain, causing the model to backtrack repeatedly in the wrong direction and rationalize falling off the ledge as overshooting.

Once context is cleared, a new session sees only the hardcoded conclusion, not the reasoning from earlier sessions that produced it. As the report points out, writing a fact into memory is a bet that future sessions will trust it without re-verifying.

In an October 3 [post](https://liao.gg/blog/agents-dont-need-memory) on the technical blog liao.gg, the author gave a similar example: a typical plugin chunks conversations into 1,000 snippets in a vector store and injects the top 5 by similarity into the prompt each time. While the codebase changes every day, old snippets continue to occupy the ground-truth slots.

Facing 10,000 vectors in SQLite, a human can barely audit which entries are stale, and the agent does not know what context it is missing, so it never thinks to look it up.

If memory files are auto-loaded at the start of every session, a wrong note keeps interfering with subsequent tasks. The report notes that Claude Code loads only the first 200 lines or 25 KB of `MEMORY.md` as a startup index, and warns that longer instructions lead to lower adherence.

## Store Only Patterns, and Reconcile Against Transcripts

Using rigid rules to restrict what gets written can also hurt performance. In Anthropic's CL-Bench 1.0 database tasks, models answered questions one by one in fresh sessions with cleared context, sharing only a memory directory. With no restrictions, Opus 5's average score rose from a no-memory baseline of 0.564 to 0.828, a net gain of 0.264, because it recorded rules, verification evidence, past answers, and pitfall warnings together.

When a "failures-only" rule was added, Opus 5's memory gain dropped by 0.234, Opus 4.7's dropped by 0.150, and Sonnet 4.6's dropped by 0.020. Forcing the model to record only failures prevents it from keeping approaches and premises that were proven to work, leaving learned patterns with nothing to build on.

Before writing file-based cross-session memory, strip out live state that tools can look up on demand, such as source files and the current branch. Keep only strategies and constraint premises that the environment does not make explicit, and cap the auto-loaded top-level index under 200 lines.

For notes written in readable Markdown, have the agent revise them in place at the end of a task while the context is still fresh, then run offline Dreaming every few rounds to reconcile them against raw session transcripts and clear out errors. In the Mt. Moon experiment, it was Dreaming checking the transcript and correcting the location that brought the model back to the cave entrance, allowing it to reach Cerulean City on action 1,935.

![Reconciling against raw session transcripts to fix a wrong route in cross-session memory](/posts/images/agent-memory-poisoning/agent-memory-poisoning-01.png)

**Leave live, queryable state out of cross-session notes, keep only verified strategies and constraints, and reconcile them against raw transcripts regularly—that is how memory stops leading new sessions astray.**
