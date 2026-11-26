---
title: "When You Can't Articulate What You Want, Have AI Build Three Throwaway Prototypes"
summary: "When requirements are hard to put into words, have AI build three throwaway prototypes with mock data first. Compare them to surface your preferences before committing to real implementation, instead of iterating endlessly in the wrong direction."
coverAlt: "When You Can't Articulate What You Want, Have AI Build Three Throwaway Prototypes"
sourceHash: "ed82ba3a4a7d0362"
---

When Thariq Shihipar edited the Fable launch video with Claude Code, his toolkit was concrete: Whisper for transcription, ffmpeg to cut pauses based on timestamps, and Remotion to stitch subtitles and visuals together.

![Thariq Shihipar's notes on using Fable](/posts/images/three-small-prototypes/source-thariq-fable.png)

When he got to color grading, he hit a wall. The footage looked washed out. He knew the problem had to do with color grading, yet he had no idea what "good" was supposed to look like. His first instinct was to have Claude generate a few versions for him to pick from. Halfway through, he realized he didn't even have criteria to compare them against—so he stopped and asked Claude to teach him color grading first.

That detail is telling. Prototypes solve the "I can't describe it, but I'll know it when I see it" problem, not a complete lack of domain knowledge. The boundary between when to ask for three versions and when to study up first sits right there.

![Use a short clip to verify the pipeline first](/posts/images/three-small-prototypes/three-small-prototypes-01.png)

## Three Versions to Surface Preferences

Page information density, the opening tone of an article, whether a chart leads with trends or anomalies—these are hard to specify accurately in the abstract. Once concrete options are in front of you, your reaction is usually immediate: this one feels too cramped, that one buries the lead, and the third looks clean but hides the most important numbers at the bottom.

That kind of feedback isn't nitpicking. It turns unspoken judgment into explicit rules.

The real job of a prototype runs in the opposite direction of production work: it turns vague preferences into criteria you can actually state. It is not a half-finished product. Once it has served its purpose, you should throw it away.

That is why prototypes need deliberate contrast. Three dark-mode cards that only swap border radius and drop shadows give you nothing to compare. A better split is one compact layout, one focused on exception handling, and one that reorders the information. Keep the content and mock data identical; only vary the parts you haven't decided on yet.

Don't treat the number three as dogma either. Sometimes two versions are enough, and four is fine. "Three" is simply a comfortable starting point: enough to compare, without leaving you staring at ten screens wanting to mash them all together.

![Each of the three versions must represent a real choice](/posts/images/three-small-prototypes/three-small-prototypes-02.png)

## Keep the Real Project Out of Reach First

Thariq gave a very practical example in his write-up: when deciding how to arrange an editor toolbar, he first had Claude build a single-file HTML page using mock data—no backend, no real state management. Only after locking in the direction did he touch the actual app.

When editing the launch video, he also started with Remotion and a short transcript snippet as a prototype to verify that visuals could sync with spoken timestamps. Before polishing a single frame of the full video, the riskiest technical link had already been tested in isolation. That sequence is far cheaper than having an Agent edit the whole video only to find out the subtitles drift.

This is the constraint people overlook most often with prototypes. Because an Agent writes code so fast, it's tempting to say, "Go ahead and wire up the API while you're at it." Once state management, tests, and data structures are in place, that version becomes hard to discard. The conversation shifts from "Is this the right direction?" to "We've built so much already—how do we salvage it with minimal changes?"

A prototype should be small enough that throwing all of it away hurts zero percent. Use mock data for a page, write just three paragraphs for an article, or wire only the two core steps of a workflow. If all three miss the mark, delete them and start over.

A short prompt is enough to enforce this: "Don't touch the main project yet. Using the same data, build three distinctly different single-file versions. I'll pick a direction before we implement." Add one sentence specifying where the differences should live based on what you're unsure about—no generic checklist required.

If the Agent comes back with three versions that only change the color palette, send them back. That means the prompt didn't point out whether you were undecided on information hierarchy, interaction flow, or visual tone. Differences between prototypes have to represent real choices; otherwise, you're just running an expensive color lottery.

## After Choosing, Write Down Why

Saying "Let's go with number two" isn't enough. What actually made number two right will still get lost the next time you add a page.

Once you pick, ask the Agent to write down three to five reasons why. For example: show anomalous orders before totals; collapse filters by default; reserve color for status, never decoration. Those rules are the real output of the comparison.

If none of the three options work, look for the shared flaw. Maybe all three assume the user wants an overview first, while you care about today's anomalies; maybe all three openings spend too long setting up background context when you want to start with a specific failure. Name the common issue, or the next round will just be another roll of the dice.

Back to the Fable video example. No number of color-graded variants can help someone who knows nothing about color grading judge skin tones, contrast, or saturation. Thariq went and learned the basics first, then came back to the options. That pivot makes the "three prototypes" method less of a silver bullet—and more trustworthy. When you can't articulate what you want yet can tell good from bad, use three versions to force your preferences out into the open. When you can't even tell good from bad, learn the fundamentals first, then look at the options again.

You don't need to translate every requirement into technical jargon before seeing anything on screen. Build a few cheap versions first, and your preferences will usually surface on their own. Whatever refuses to surface is the part you need to study.
