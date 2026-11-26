---
title: "Why Four AI-Generated Landing Pages All Got Scrapped"
summary: "Why did an indie developer reject every high-scoring landing page produced by AI design tools? When generation costs drop to zero, generic big-tech polish and eye-catching visuals are cheap. What actually decides whether a product survives are two hard physical constraints set before starting: visitors must understand it in five seconds, and a solo maintainer must be able to afford keeping it up."
coverAlt: "Why four AI-generated landing pages all got scrapped"
sourceHash: "97ef8ab93065a4ba"
---

A few days ago, I watched a video by indie developer Takuya Matsuyama. He was redesigning the landing page for his Markdown note-taking app, Inkdrop, and tried just about every well-known AI tool on the market.

After a full round of experiments, each model gave him a high-scoring option. One looked like a standardized Silicon Valley big-tech homepage, another blended Mount Fuji with the product UI in a visually stunning composition, another leaned into Japanese minimalism, and one more combined Apple and Stripe styles using a 110k-star prompt library from GitHub.

Most developers would pick any one of them, ship it, and collect plenty of likes on social media.

Instead, he closed all four tabs and used none of them.

The version he ended up shipping pulled real React components straight out of his desktop client and turned them into an interactive demo where visitors can type right in the browser.

What struck me most about the video is this: we tend to assume the hard part of designing UI with AI is tuning the model's aesthetic taste. In this case, however, rejecting those four high-scoring options had nothing to do with beauty or ugliness from start to finish.

Takuya's first round was with v0. After a few prompt iterations, it spat out a SaaS page so standard it felt formulaic. Gray-and-white background, multi-column feature cards—no obvious bugs, yet one glance left him completely unmoved, and he closed it.

In the second round, he switched to an image-generation model to produce concept mockups directly. The result floored him at first sight: a majestic Mount Fuji in the background, a dark-themed editor cleanly framed in the foreground, and four thoughtfully arranged info blocks underneath. In terms of visual impact and first-impression wow factor, it was nearly flawless.

But he quickly spotted a serious problem: if Mount Fuji in the background steals all of a first-time visitor's attention, they will never have the patience to figure out what the note-taking app in the foreground actually does.

To illustrate this, he brought up Oğuz Yağız Kara, a designer he has long admired. Oğuz is famous for lavish 3D animations and WebGL interactions, and his work has won countless design awards. Yet looking back closely, Takuya realized that when browsing those award-winning sites, his attention only chased the dazzling motion—afterward, he couldn't even remember what problem the product solved.

A landing page is not an art gallery. If a visitor cannot tell what your software does within five seconds, no matter how breathtaking the artwork is, it becomes a liability for a solo indie product.

![Background stealing attention from the product](/posts/images/ai-design-options-taste/ai-design-options-taste-01.png)

For the third round, he used Claude to generate web code, deliberately weaving in the traditional Japanese _ichiju-issai_ ("one soup, one side") philosophy to convey a restrained sense of less is more.

The layout was genuinely fresh, but the Japanese characters in the body text turned into garbled encoding, and the layout broke on small screens. More importantly, Claude's CSS carried a stubborn template smell. Anyone who regularly browses AI-generated indie projects can spot those identical gradients and drop shadows in a second. He didn't mince words: he couldn't stand that kind of "slop of taste."

In the fourth round, he turned to `awesome-design-md`, an open-source repo on GitHub with 115k stars that distills the design rules of top brands like Apple, BMW, Stripe, and ClickHouse into system prompts. The resulting page again had no obvious flaws, yet at its core it had the average face of major tech companies, with zero personality of its own.

Beyond cognitive load, the second hard blocker that killed these options was maintenance cost.

Inkdrop is a desktop client maintained by a single developer year-round, and its UI changes every month or two based on user feedback.

If a landing page relies on AI-generated high-res hero renders, hand-polished UI mockups, and pre-recorded promo animations, moving a single button in the app means re-rendering, re-recording, and re-slicing the entire set of assets. For a one-person project, that maintenance overhead is simply unsustainable.

After rejecting all four options, his final solution was remarkably down-to-earth:

Rather than using static images and animations to explain how good a note-taking app feels, he extracted the client's real React components into a standalone UIKit library and mounted a CodeMirror editor directly in the browser. Visitors land on the page and, without reading a pitch, can immediately type code and write Markdown right there.

![The same component serving both ends](/posts/images/ai-design-options-taste/ai-design-options-taste-02.png)

That single move resolved both hard blockers at once.

For visitors, the cognitive barrier drops to zero: you don't have to read copy in five seconds. Tap a few keys, and the input latency, syntax highlighting, and typographic feel speak for themselves.

For a solo maintainer, the heavy asset-maintenance tax disappears completely: the landing page imports the exact same components as the client. Whenever the client's layout or styling changes, updating the core package keeps the landing page in sync automatically—no more spending half a day retaking screenshots.

Looking back at those four high-scoring options tossed in the trash, none of them were wasted.

In the shortest possible time, they let the author feel out every boundary on a real screen: Mount Fuji marked the upper limit where spectacle hijacks attention, v0 marked the lower bound of mediocrity, Claude's defaults showed the LLM mean of taste, and big-tech design systems showed soulless polish.

Had he stayed in a room just thinking in the abstract, it might have taken weeks to figure out what he didn't want.

People used to think the biggest anxiety in designing with AI was that models lacked good aesthetics, or that they themselves lacked a top designer's taste. But when compute pushes the marginal cost of "looking decent" close to zero, an LLM can throw dozens of passable, technically sound options in your face within minutes.

The cheaper it becomes to generate options, the less real taste is about picking which picture looks prettiest.

**What decides whether a product holds up is never how dazzling an interface a model can draw, but what hard physical constraints you are willing to use to throw away an ocean of decent options.**

Before opening any design tool, write two non-negotiable lines on paper: visitors must understand it in five seconds, and one person must be able to maintain it after a redesign. Once those two cards are firmly on the table, you can close tab after tab of polished, flashy options without blinking.
