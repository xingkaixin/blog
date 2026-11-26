---
title: "The AI Slop Debate: Same Bad Code, Weapon to Some, Poison to Others"
summary: "Mitchell Hashimoto uses AI-generated low-quality code as scaffolding to iterate faster, an Anthropic engineer says coding is solved, and another essay documents novices shipping AI output beyond their judgment—slop isn't the problem; not knowing you're drinking it is."
coverAlt: "The AI Slop Debate: Same Bad Code, Weapon to Some, Poison to Others"
sourceHash: "f22fa73d89b1bb55"
---

On the same day last week, two completely contradictory posts showed up in my feed.

The author of one post wrote about a colleague who used AI for two months to build a data system, producing mountains of code, mountains of docs, and mountains of things that looked like progress. The problem was that this colleague isn't an engineer—the schema was wrong from day one, and the direction was wrong too. People pointed it out, even a VP said so, and it didn't matter: management had already bet on "momentum" and didn't want to hear it. The whole thing will probably keep chugging along until the day it's shown to a customer and blows up.

That same day, Mitchell Hashimoto—founder of HashiCorp and creator of Terraform—posted a tweet saying, roughly, that AI slop is great. He said the frontend of the system he's currently building is "unapologetically slop," terrible quality, but it works. He lets agents run overnight to generate dozens of plugins—also terrible quality—and now he can test the full product experience. He said if he'd had this capability ten years ago when building Terraform, he would have generated 100 providers straight away instead of only having time to build three.

One person says slop is poisoning his team. Another says slop is the best tool he's ever seen.

They're talking about the exact same thing.

---

Just a few days earlier, there was a third voice. Boris Cherny, creator of Claude Code at Anthropic, said at Sequoia's AI Ascent conference that there's no longer any handwritten code inside Anthropic. All SQL and all product code are model-generated. He himself hasn't written a single line of code in 2026 and has merged 150 PRs in a single day. Hundreds of agents run during the day, thousands overnight. Employees' Claude instances ask each other questions over Slack.

Three people, three stances, one phenomenon: massive volumes of uneven AI-generated output—let's call it "AI slop" for now—are flooding every engineering organization. The only difference is that some see it as a weapon, some see it as poison, and some see it as the future itself.

## Same Slop, Three Ways to Eat It

![Three ways to eat it](/posts/images/ai-slop-battle/ai-slop-battle-01.png)

First, look at Mitchell's logic. His approach rests on several strict preconditions: he knows what good looks like. He built Terraform; he knows what a plugin SDK ought to be, which is why he's comfortable letting an agent generate terrible plugins overnight—he can tell what to throw away and what to keep. He's also transparent about the boundaries of slop: he doesn't PR it straight into someone else's repo, and he doesn't hand it to customers unreviewed. In his hands, slop is scaffolding, not a deliverable.

Put differently, **slop is good—if you know what the finished product should look like.**

Now look at the case in that essay. On the surface, what that colleague did looks identical to Mitchell: using AI tools to crank out huge amounts of output, iterating fast, producing artifacts that look professional. Where's the difference? He doesn't know what the finished product should look like. He has no training in data architecture and can't judge whether a schema is right or wrong, or whether the direction makes sense. Worse, the AI won't tell him. Research from Stanford this year confirmed that major models are roughly 50% more sycophantic toward users than real humans are—it's not going to say, "You've been building the wrong thing since day one."

The author of that essay gave this phenomenon a name: output-competence decoupling. Before AI, a novice's work looked like a novice's work. AI severed that link. A novice can now produce work that doesn't give them away as a novice, because that output reflects the model's capability, not theirs. They become a pipe—capable of passing the model's output along to the recipient, but incapable of evaluating it along the way.

Then there's Boris and Anthropic's stance. It's the most radical of the three: he's not saying "slop can be useful," he's saying "our entire company is built on top of slop, and that's the right way to operate." That confidence comes from two places: Anthropic has frontier models, including an unreleased internal model called Mythos; and it has a complete organizational workflow built to digest model output—Loop, Routines, Claude instances talking to each other over Slack, automated CI fixes, and automated handling of flaky tests.

## Not Betting on Facts, Betting on the Future

Put all three stances side by side and you'll notice their disagreement isn't about the facts. Nobody denies that AI output today is uneven, nobody denies that models are getting stronger, and nobody denies that some people are using AI for things beyond their own judgment. What they're really disagreeing on is which future they're betting on.

Mitchell is betting that judgment will always belong to humans. No matter how strong the tool gets, you have to know when to use it, when to throw it away, and when to clean it up. That judgment comes from experience—from having built things with your own hands and broken things with your own hands. AI won't grow that judgment for you.

Boris is betting that model progress will make judgment less scarce. "Coding is solved"—those are his exact words. Claude 4.7 can already spin up Loops on its own, hook into Slack on its own, and report back on its own, and every new generation bends the curve again. What requires human judgment today, the model will be able to judge for itself tomorrow.

The essay's author is looking at the transition period. Even if Boris's future turns out to be right—even if models really do get strong enough not to need human judgment—there's a vacuum between now and that day. Models are already strong enough to let anyone produce things that look professional, but not yet strong enough to judge on their own whether those things are right or wrong. Meanwhile, on the human side, organizations are cutting entry-level roles, compressing review processes, and rewarding output volume in the name of "AI efficiency."

![The scissor gap](/posts/images/ai-slop-battle/ai-slop-battle-02.png)

**On one side, the sources of judgment are shrinking; on the other, output that requires judgment is growing exponentially. That scissor gap is the biggest risk right now.**

## Who's Right

I think all three of them are right, just on different timelines.

Mitchell's world is the present. If you're using AI for serious engineering work today, you need judgment as your safety net. AI output without judgment isn't efficiency; it's debt—and the kind of debt whose interest stays invisible until the day a customer opens your deliverable.

Boris's world may be the future. Models really are getting stronger, and faster than most people expect. Yet even he admits that "coding is solved" currently holds only for mainstream stacks like TypeScript + React, and he's using an internal model nobody outside can touch. His conclusion holds for him, but copying it straight into an ordinary team isn't a tooling gap—it's rebuilding the entire organizational workflow.

The world described in that essay is the reality most people are living through right now. Most teams have neither Mitchell's judgment nor Anthropic's organizational workflows and frontier models. What they do have is an increasingly capable AI tool, an increasingly impatient management layer, and an increasingly neglected quality review step. That's where the vast majority of people actually stand at this moment.

**Slop isn't the problem. Not knowing you're drinking slop is.**
