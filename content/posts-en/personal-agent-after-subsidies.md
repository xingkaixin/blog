---
title: "Personal Agent: After the Subsidies, Why Do Users Pay?"
summary: "Personal Agents are often compared to early Didi, but they lack ride-hailing's two-sided network effects—more users just mean bigger bills, and cloud startup credits do not cover third-party models. To judge the opportunity, look at whether a product can reliably finish a task users will pay for at a sustainable cost once subsidies end."
coverAlt: "Personal Agent: After the Subsidies, Why Do Users Pay?"
sourceHash: "8c193ba64dcf60f4"
---

There is a popular thesis about Personal Agent startups: today's personal assistants are like "Didi in 2012."

The argument goes like this: personal assistants burn through huge amounts of tokens that startups cannot afford on their own. To fight for the next major entry point, foundation model labs and cloud providers will push these apps to the mainstream through investments and compute subsidies. The teams that survive will both capture big-tech subsidies and bring costs down via hardware entry points and self-trained small models.

This logic misses a fundamental premise: once the subsidies end, why will users keep paying for a personal assistant?

By Personal Agent, I mean an assistant that stores personal information long-term and keeps getting things done across apps. It is indeed more expensive than one-off Q&A. But "expensive to build" and "users will pay for it long-term" are two different things. One does not imply the other.

The Didi analogy holds up in part. Behind the ride-hailing subsidies back then was the mobile payment war between Tencent and Alibaba. Still, according to [research from Tsinghua University](https://www.cideg.tsinghua.edu.cn/upload_files/file/20190612/1560329154294055378.pdf), the massive subsidies mostly happened in 2014, so "Didi in 2012" is off on the timing.

The bigger difference lies in demand and network effects. Passengers already needed to get from point A to point B; subsidies only lowered the barrier to hailing a cab on a phone for the first time. Ride-hailing also has two-sided network effects: the more cars there are, the shorter the wait for riders. Scale itself becomes a moat.

Personal assistants have no such effect. Organizing emails, managing calendars, following up on to-dos—which tasks users will trust an assistant with long-term is still being tested one by one. Gaining 100,000 more users does not make an assistant understand you any better. The underlying capabilities can be shared, but each person's memory and permissions have to be built from scratch.

So subsidies do not buy the kind of moat ride-hailing had. Extra sign-ups just bring bigger backend bills.

Those bills are not small. Manus's [credits documentation](https://manus.im/help/credits) breaks consumption down into three parts: model tokens, virtual machines, and third-party APIs. It is a general-purpose task agent and does not represent every personal assistant, but it shows the cost structure of multi-step execution: a user sends a single message, and the backend might call dozens of tools, parse web pages, and run code.

A long-term assistant also has to decide when to retrieve memory, when to update a profile, and when to send a proactive reminder. Storing information and stuffing all of it into the context window on every turn have vastly different costs.

In a 2025 [engineering post](https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus), the Manus team treated improving cache hit rates as a primary lever for controlling costs, keeping materials in files to read on demand. At the time, they chose to focus on context engineering around off-the-shelf commercial models in exchange for faster iteration cycles.

![Personal profiles stay in files, reading only the schedule details needed for the current task](/posts/images/personal-agent-after-subsidies/personal-agent-after-subsidies-01.png)

Costs depend heavily on what a product promises to do and how it is built. Automating a single vertical workflow and tracking every change in a user's life 24/7 are not in the same order of magnitude for compute. "The category is expensive" does not mean "startups have no chance."

It is also true that upstream providers are willing to spend. The [Google Cloud Startup Program](https://cloud.google.com/startup/early-stage) offers qualifying AI startups up to $350,000 in cloud credits over two years. But the program FAQ states that third-party models are not covered by those credits.

For a personal assistant that primarily calls models from other vendors, those credits do not cover the largest share of token spend. The subsidy is there, and how you can use it is restricted.

This is where upstream providers and application builders have misaligned incentives. Cloud providers want apps to stay inside their ecosystem; app builders need to switch model vendors at any time based on capability and price. Once the credits run out, the team pays the real operating costs itself.

**What a team needs to calculate clearly is: without subsidies, how much does it actually cost to reliably complete a task that users are willing to pay for?**

Beyond tokens and servers, that bill includes retries and rework after failures. Even easier to overlook is the time users spend checking and taking over. After switching to a cheaper small model, if the error rate rises noticeably, users have to double-check everything from scratch just to avoid sending the wrong email or double-booking a meeting. The API fees saved cannot make up for the extra time users spend.

![A user fixing a schedule conflict, showing that takeover time is also part of a personal assistant's cost](/posts/images/personal-agent-after-subsidies/personal-agent-after-subsidies-02.png)

Users pay for a personal assistant so they do not have to look at the work once it is done. Pricing power comes from doing that consistently. A cheaper per-token price does not automatically turn into a competitive advantage.

Self-trained small models belong in that same calculation, and they fit better as a later-stage cost-cutting move: only when workflows have converged enough, you have accumulated enough high-quality execution traces, and you can reliably verify delivery quality does training your own model become cheaper than calling commercial APIs. Before that, prompt caching, cutting unnecessary intermediate steps, and routing non-core steps to cheaper models all have much lower barriers.

Hardware can indeed capture context that software cannot. Recording devices like Plaud start capturing conversations as they happen, skipping manual uploads and organization afterward, with [pricing tiers](https://www.plaud.ai/pages/plaud-ai-plan-pricing) based on transcription minutes. But recording audio is not the same as understanding the user, and users may not want to wear it all the time while also handing over email and calendar permissions. Trying to build hardware, software, and proprietary models all at once—before proving the product can handle even one task reliably—just saddles the team with another supply chain and several extra R&D tracks.

A much smaller outcome is worth aiming for first: a group of real users hands a recurring chore to the product; the product finishes it reliably; and when charged an unsubsidized price, they still renew.

To test this, pick one high-frequency task and track three numbers: the real cost per completion without subsidies, the rate at which users have to step in, and retention at full price. Whether the bottleneck is the model, context retrieval, or the demand itself, those three numbers will tell you.

Subsidies buy a team time to experiment. The best use of that time is finding the first thing that works without them.
