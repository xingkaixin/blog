---
title: "Reading Through OpenAI's Early Internal Emails: Nobody Saw GPT Coming"
summary: "Reading through the thousand pages of internal emails released in Musk v. Altman, OpenAI's sharpest early minds spent three straight years betting on Dota, robotic hands, and self-play—language models got three lines in Sam's year-end update, framed as a \"hope.\" Nine months later, GPT-2 shipped."
coverAlt: "Reading Through OpenAI's Early Internal Emails: Nobody Saw GPT Coming"
sourceHash: "9ac032ed4c5f23d1"
---

On June 12, 2017, at 10:39 p.m., Ilya Sutskever sent a biweekly update email to Greg Brockman and Elon Musk.

It was OpenAI's first formal internal biweekly update. Ilya listed five areas of progress: compute usage, Dota 1v1, rapid learning on new games, the robotic hand, and self-play. Each section had concrete numbers and YouTube links to prove the experiments were real. In the Dota section, he wrote: "This is a pretty clever play." And attached a video link—so the backer might actually click and watch.

The entire email was over four thousand words long. Language models were not mentioned once.

Read that email alongside every update, fundraising memo, and roadmap from the next two years, and you arrive at a counterintuitive conclusion: **the path that actually changed the world was never in their field of vision.**

![The first email in the archive](/posts/images/musk-vs-altman/Musk-vs-Altman-01.png)

## They Were Betting on Robotics and Dota

![Betting on robotics and Dota](/posts/images/musk-vs-altman/Musk-vs-Altman-02.png)

On July 12, 2017, Ilya wrote another long memo titled *The Business of Building AGI*. It is one of OpenAI's most important early strategy documents—and a textbook fundraising pitch.

Ilya started with the history: the past five years had proved that the earliest, simplest idea behind neural networks was right all along; only the hardware had been missing. Then came the numbers: Google Brain had around 100,000 GPUs, FAIR had 15,000 to 20,000, and DeepMind allocated 50 GPUs per researcher. OpenAI had 600.

Next, he laid out his predictions for the next three years:

> Within 3 years, robotics should be completely solved, AI should prove an open mathematical theorem, programming competitions should be reliably crushed by AI, and convincing chatbots should exist (though none that can pass the Turing test).

Within four years, he wrote, each overnight experiment would use enough compute that you might wake up to AGI—provided they also found the right algorithm (which he estimated would take another 2 to 4 years).

Then came the ask: expand the GPU cluster from 600 to 5,000, with $12 million in capex and $5–6 million a year in opex. Grow headcount from 55 to 200.

Across the entire email, the word "language" appeared zero times. "Chatbot" appeared once, in the prediction about "convincing chatbots"—listed alongside "robotics completely solved," and placed after it.

## The Stakes Kept Rising

![Rising stakes — Musk's pressure emails](/posts/images/musk-vs-altman/Musk-vs-Altman-03.png)

On January 31, 2018, Andrej Karpathy forwarded Musk a chart of ICLR submission stats. Google had 83 papers; OpenAI barely registered.

Musk replied that same day to Greg, Ilya, and Sam: "OpenAI is on a path of certain failure relative to Google. Either immediate, dramatic action is taken, or everyone except Google will become irrelevant."

That pressure shows up repeatedly across the emails. In February 2016, Musk wrote: "The probability of DeepMind creating AGI is rising every year. Probably not 50% in two or three years, but likely over 10%." He gave the team a 6-to-9-month deadline to deliver something "sufficiently important." By December 26, 2018, Musk put it even more bluntly:

> My assessment of the probability of OpenAI being relevant to DeepMind/Google without a dramatic change in execution and resources is 0%. Not 1%, 0%.

And where did OpenAI put its resources during those two years?

Dota 5v5. A robotic hand solving a Rubik's cube. Self-play.

In April 2018, Shivon Zilis wrote in an update to Musk that Dota 5v5 was going better than expected, and that "some people internally are starting to worry the AGI timeline is closer than previously thought"—because the Dota bots were improving so fast.

Then on December 17, 2018, Sam Altman wrote a year-end update to Musk. The first three paragraphs were all Dota, the robotic hand, and multi-agent environments.

Then, in the fourth paragraph, he dropped a line in an almost polite, passing tone:

> We're also making fast progress on language. I hope next year we can generate short stories and a decent dialogue bot.

Hope. Short stories. A decent dialogue bot.

Nine months later, GPT-2 shipped.

## The Real Breakthrough Was Mentioned in Passing

![The main character mentioned in passing](/posts/images/musk-vs-altman/Musk-vs-Altman-04.png)

Put Sam's sentence back in context: it sat in the fourth paragraph, three lines long, with no resource request, no milestones, and no competitor comparisons attached. In that very same email, the Dota tournament was planned down to the details—"hold a final tournament in Q1, a grand prix open to any pro team willing to show up, and after that declare model-free RL solved."

In other words, **OpenAI's own CEO treated language models as a side project in his own year-end update.** His words were "hope" and "decent," not "the most important thing we're working on."

Even more telling was Musk's reply. A single line:

> Sounds good

No follow-up questions, no excitement, no "should we put more resources into language?" Because to Musk, OpenAI's core problem was losing to Google, and the answer was Tesla AI and compute. Language models didn't even qualify for the agenda.

Stack all the roadmaps from those two years together: Ilya's three-year milestones from July 2017, Sam's project list at the end of 2018, Musk's December 2018 verdict on the odds of failure, and the March 2019 capped-profit announcement highlighting "breakthroughs in reinforcement learning, robotics, and language"—language was always last, always an afterthought.

And GPT-2 was released in February 2019. Less than two months after Sam wrote that he hoped next year they could generate short stories.

## Nobody Saw It Coming

Reading through all thousand-plus pages of emails, what surprised me most wasn't the falling-out between Musk and Sam, or how the capped-profit structure was engineered, or Ian Goodfellow's and Andrew Tulloch's salaries on the early payroll.

It was this: **OpenAI's sharpest early minds wrote updates every two weeks and strategy memos every year for three straight years, and not a single document treated language models as the main thread.**

Their bets weren't foolish—self-play, multi-agent systems, robotic manipulation, adversarial robustness were all reasonable paths for deep learning in 2017. Ilya wrote in *The Business of Building AGI* that hardware decides everything, and that call turned out to be completely right. He just expected that hardware to go into simulated multi-agent arenas, where competing agents would play their way to superhuman intelligence.

Instead, the hardware went into stuffing Wikipedia into a Transformer.

Innovation always happens at the margins. Madness always arrives outside the plan.

![Innovation at the margins](/posts/images/musk-vs-altman/Musk-vs-Altman-05.png)
