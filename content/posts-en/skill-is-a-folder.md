---
title: "The Longer the Skill, the Worse the Agent Follows It"
summary: "An agent skill isn't a manual; it's a folder. Only after I cut an agent-generated SKILL.md from 312 lines down to 40 did it finally work right: keep the judgment criteria at the entry point, split examples and templates into separate files, and write the description as trigger phrases. Plus three questions to ask before accepting a new skill."
coverAlt: "The Longer the Skill, the Worse the Agent Follows It"
sourceHash: "6d429487f2451578"
---

On Sunday night, I opened the `SKILL.md` that manages my topic selection, ready to add a few more rules. I scrolled to the bottom: 312 lines. When Claude first generated it three weeks ago, I remember clearly, it was 87 lines.

Every single one of those extra two hundred lines had a story. When it didn't trigger when it should, I added a "When to Use" section. When it mashed topic judgment and formatting rules together, I added a "Notes" section. When its output format drifted, I pasted in four full positive and negative examples. Every time something broke, I came back and fed it a few more sentences. Every time I did, the file grew longer—and the next time I used it, it drifted even further off track.

That night I stopped adding to it. I had just finished reading the Claude Code team's skill retrospective, and their diagnosis hit this file dead center: the problem isn't that the rules aren't detailed enough, it's that there are too many of them. And when an agent generates a skill for you, "too much" is almost the default outcome. What it does best is cover every base; what a good skill needs is the exact opposite.

## A skill is a folder, not a manual

If you think of a skill as "a manual written for AI," your instinct is to pile words into it: every rule, every boundary, every exception, all stuffed into one `SKILL.md`. When an agent writes it for you, that's doubly true—covering everything is its path of least resistance. The longer the file gets, the more you feel like *now* it should finally get it.

But the real unit of a skill is a folder. Inside it, you can put scripts, templates, reference docs, and sample data that the agent can discover, read, and invoke. `SKILL.md` is just the entry point. Its job is to tell the agent what files live here and when to look up which one—not to dump everything in front of it all at once.

Behind this is an idea called progressive disclosure: context is a scarce resource and shouldn't be filled up upfront. Keep a table of contents in `SKILL.md`, put detailed function signatures in `references/api.md`, put output templates in `assets/`, and let the agent read only what it needs, when it needs it. A three-hundred-line markdown file forces the agent to swallow every rule into context on every run. Every time my topic skill triggered, it had to read the formatting rules along with four full examples first. By the time it actually started evaluating a topic, half its attention was already diluted.

What I did next was split it up. I cut `SKILL.md` back to forty-something lines: a one-sentence judgment criterion plus a file index. The positive and negative examples moved to `references/examples.md`, and the output format moved to `assets/template.md`. Not a word of content was lost—it just lived in separate rooms. The next day, for the first time, it kept topic judgment separate from formatting. Not because the writing got clearer, but because I stopped forcing it to swallow everything in one bite.

![Progressive disclosure: SKILL.md as the entry point, with details split out and read on demand](/posts/images/skill-is-a-folder/skill-is-a-folder-01.png)

## Write what the AI wouldn't do by default

The Claude Code team had an even sharper line: Claude already knows how to write code and read your codebase, so a skill that only restates its default behavior adds context without adding value.

Looking back at those 312 lines with that in mind, at least half of them were "true but useless" filler. "Keep the output concise and clear." "Base your judgment on the core theme of the post." Delete those lines, and Claude will still do all of that. They're not just useless—they take up space and dilute the real signal. When an agent generates a skill, restating common sense is its easiest filler. So the human's job at that step isn't writing; it's deleting.

The highest-signal part of a skill is what the Claude Code team calls Gotchas: the traps only you have stepped into that the model could never guess. Things like, "This table is append-only; you want the row with the largest `version`, not the latest `created_at`," or "This field is called `request_id` in the gateway and `trace_id` in the billing service—they're the same value." In my topic skill, the only lines worth keeping were things like which topics collide with already-published posts, and which sources can only serve as leads rather than direct candidates. What the model can't deduce on its own is the only thing that earns its place.

There is one test for whether a sentence stays: if Claude would do the same thing without reading it, that sentence is noise.

![Cut the "true but useless" filler and keep the Gotchas the model can't guess](/posts/images/skill-is-a-folder/skill-is-a-folder-02.png)

## The description is a trigger for the model

When a skill fails to trigger when it should, the root cause isn't in the body—it's in the `description`.

When Claude Code starts up, it compiles each skill's `description` into a list and scans that list to decide which skill to attach to the current request. So the job of `description` is to answer "when should you call me?" My original line—"a skill for writing topic selection"—answered "what am I?" Standard bio phrasing, and the model scanned right past it without reacting.

I rewrote it using the exact phrases I actually say out loud: "topic ideas, find a topic, can I write about this, take a look at this idea." That same day, the trigger rate went back to normal.

A counterintuitive corollary: once the `description` is sharp, the body should actually stay loose. A skill is meant to be reused across contexts; the more the body reads like a rigid railroad track, the stiffer the agent gets in new situations. Give it enough information, and leave room for it to adapt.

![The description is a trigger: the model scans the list to decide which skill to attach](/posts/images/skill-is-a-folder/skill-is-a-folder-03.png)

## One skill, one job

The Claude Code team grouped hundreds of internal skills into nine categories, from library references and product verification to CI/CD and troubleshooting runbooks. You don't need to memorize the nine categories; what matters is the takeaway they pulled from them: the best skills belong cleanly to one category, while skills that try to do too much straddle several and confuse the agent.

That brings us right back to the root cause of those 312 lines. My topic skill tried to handle both topic judgment and layout formatting—straddling two categories—so when the agent picked it up, it naturally didn't know which half to use. Growing too long is just the symptom; trying to do too much is the disease. The more jobs a skill tries to cover, the longer it has to grow, and the more likely it is to misfire.

That `SKILL.md` now sits at forty-something lines and hasn't crept back up. Not out of willpower, but because every time I want to add something, I run it past three questions first: Does this belong to only one category? Would Claude do this anyway without reading it? Does the `description` include the exact phrase I would actually say?

Next time an agent generates a skill for you, don't skim it and accept it. The more it writes, the harder you have to cut—that's the only way the agent will actually use it right.

Once you're done writing, you can [use negative test cases to check whether a skill misfires](/en/posts/evaluating-agent-skills/) and verify that your `description` boundaries hold; if you reuse skills across repos, you can also organize and sync them with [Agent Skills](https://skills.xingkaixin.me).
