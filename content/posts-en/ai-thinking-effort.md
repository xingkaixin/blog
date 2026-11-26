---
title: "Where Does the Extra Time Go When AI Thinks Harder?"
summary: "Raising effort in Claude Code turned a 1-minute menu redesign into a 28-minute run that made product calls on its own, while in debugging it went to reading source and fuzz testing. Explore on low effort, then bump it up once there are objective checks."
coverAlt: "Where Does the Extra Time Go When AI Thinks Harder?"
sourceHash: "4b9a8408b9820aa8"
---

When redesigning Claude Code's `/config` menu, the same Opus 5.5 model built a working prototype in about one minute on Low effort, while Max effort took roughly twenty-eight minutes.

The twenty-eight-minute version looked closer to Claude Code's existing UI and came with multiple interactive flow demos. Both versions used submenus and updated search. Yet in his September 25, 2026 [field note](https://claude.dev/blog/spending-your-effort/), author Thariq Shihipar preferred starting from the one-minute version.

Putting the two drafts side by side makes the reason clear. The Low version lined up concrete features like General, Display, and Input as top-level tabs; under General, Model sat right next to Theme, and the model description simply read "Used for future turns in this conversation."

The Max version reorganized it into a settings page, listing Model, Effort, and Fast Mode up front, followed by Behavior and Interface sections. It added a `/model` switching hint to the model description and introduced a "Changed from default" entry to group modified settings together.

Every one of those differences is a product call a human has to make. Whether Theme belongs on the first screen, whether settings split by "Display, Input" or "Behavior, Interface," and whether "Changed from default" deserves its own entry are not decisions a model can make for the product.

In an exploratory UI redesign, running Max for twenty-eight minutes lets the model lock in those groupings and entry points on its own, then build out interactive flow demos around its own choices. Looking at the one-minute draft first lets you adjust theme placement or section labels right away against the sketch, setting the direction for the next pass without waiting for every demo to finish.

![Adjust the first-screen layout on the menu sketch before deciding which interactions to build out](/posts/images/ai-thinking-effort/ai-thinking-effort-01.png)

## With higher effort, the extra time goes to verification

The setting being tuned here is `effort`. According to the [parameter docs](https://platform.claude.com/docs/en/build-with-claude/effort), it controls compute spent across thinking, responses, and tool calls. Raising `effort` only gives the model more compute; what those extra steps actually do depends on the task.

In UI design that needs human direction, extra time easily turns into unapproved autonomous changes. On coding tasks with clear pass-or-fail criteria, those extra steps go into checking source code and running tests.

In the same note, the HTML/JS security filter task (`html-js-filter`) from Terminal-Bench 3.0 is a good example. It used Fable 5.1 for an in-group comparison rather than comparing runtimes against the menu task, aiming to strip dangerous scripts while preserving tables, headings, and safe attributes.

A typical Low-effort run took about two minutes—the model wrote an HTML verification page and stopped. A higher-effort run took about thirty-three minutes, with the model reading the parser source, checking normal pages, running an XSS test suite, and writing a randomized document fuzzer.

Another task—fixing a storage engine crash from a bug report (`mvcc-lsm-compaction`) without breaking compaction—showed the same difference in verification order between effort levels.

The Low-effort run edited code before building or running the reproducer, and never checked whether its new test actually caught the old bug. The higher-effort run reproduced the crash first, used a non-compacting implementation as a reference oracle to write randomized tests, and verified that those tests caught incomplete fixes.

Filtering scripts risks breaking tables and normal text; fixing a storage crash risks regressing compaction. A couple of happy-path cases rarely cover the edge cases. The extra steps spent reading source, building a reference, and running randomized tests reduce the risk of missed regressions.

## Start low to set direction, then step up in stages

Raising effort still comes with conditions. If your existing test suite already covers the change, pushing the model to run another round of tests just adds wait time. If the model picks the wrong technical approach from the start, maxing out effort will not save it either.

The one-minute and twenty-eight-minute numbers are also just total wall-clock times from that single menu task, without breaking down model generation, tool execution, and external wait times; "deep thinking" in other AI products may not use the same `effort` mechanism either.

Claude Code lets you adjust effort mid-conversation with `/effort` instead of locking into one level from start to finish. **Keep the exploratory phase—where humans need to make trade-offs—on a low-effort first draft, and save high effort's source checks and randomized testing for implementation and debugging where correctness can be objectively verified.**

Next time you kick off a task in Claude Code, ask in the first turn for "a working sketch first so I can review the top-level layout before adding interactions," then step up `/effort` after confirming—it saves far more rework than waiting nearly half an hour upfront.
