---
title: "From \"Can Chat\" to \"Can Act\": Where AI Travel Assistants Get Stuck"
summary: "AI travel assistants don't get stuck on writing itineraries; they get stuck on making them happen. Travel breaks down into six stages—where, when, how to get there, eligibility, what to do, and mid-trip changes—each with its own tools, yet none owning the whole trip. Chatting relies on models, while acting requires live data, transaction inventory, rule checks, and fallback handling—a capability network where missing one piece leaves you stuck at recommendations."
coverAlt: "From \"Can Chat\" to \"Can Act\": Where AI Travel Assistants Get Stuck"
sourceHash: "c83ac42f6d5745a0"
---

Every time I plan a trip, I go through the exact same routine: I open Bilibili and watch one travel vlog after another. Whenever I spot a promising shop or a place worth visiting, I switch apps and jot it down in my notes. By the tenth or twelfth video, it hits me how absurd this is: this is obviously work for AI, yet I am still doing it the most primitive way—watching videos by hand and copying down itineraries.

Eventually I realized the problem isn't that AI can't write a travel guide. Quite the opposite: writing guides is what it does best. What actually trips it up is all the messy work that comes after the guide—live prices, opening hours, booking rules, transit connections, whether something is actually available, and the unexpected changes that pop up mid-trip.

Put simply, today's AI "can chat," but it still "can't act." This post is about where that dividing line sits.

## Travel planning isn't one task—it's a pipeline

When we say "planning a trip," it sounds like a single task. Break it down, and it's actually a long chain.

First, you decide **where to go**—whether to visit one city or string several together, whether to cross borders, and how to narrow a broad idea like "Japan" down to a concrete route. Next is **when to go**—avoiding peak seasons and crowds, fitting around holidays and PTO, and ideally keeping it cheap, goals that constantly pull against each other. Then comes **how to get there and move around**—flights, high-speed rail, or driving, how cities connect, and how to trade off time against price.

Then there is a stage that's easy to overlook, yet fatal when it goes wrong: **whether you can go and what needs to be locked in early**—visas, documents, whether popular spots require reservations or even lotteries, whether an exhibition is still running, or if a venue happens to be closed that day. Only after that do we get to the part everyone finds fun: **what to do locally**—food, sights, exhibitions, family activities, outdoors. What works for a solo traveler, a group of friends, or a family is completely different, and all of it still has to fit the budget. Finally, there is **being on the trip**—navigation, rebooking, translation, and swapping plans on the fly when it rains.

Each of these six stages is real work. Right now, we handle them separately: inspiration from Xiaohongshu and vlogs, price comparisons across search engines and OTAs, booking flights, hotels, and tickets one by one, checking rules on official websites, and muddling through on the ground with maps and translation apps.

So travel planning has never been a content generation problem; it's a pipeline orchestration problem. Every stage has a tool, yet no tool takes responsibility for the whole trip. The person stitching it all together is still me.

![The six-stage pipeline of travel planning](/posts/images/ai-travel-talk-vs-act/ai-travel-talk-vs-act-01.png)

## I don't want an itinerary—I want someone watching over the trip

Before complaining, let me be clear about what I actually want.

I don't want a chatbox that writes prettier itineraries. I want something that continuously makes judgments, runs checks, and executes on my behalf. In one sentence: not "give me a travel guide," but "keep an eye on this trip for me."

If I only say, "I have five or six days off, thinking of Japan, relaxed but not boring," it should narrow that vague intent into two or three workable options: a slow Kansai trip, Kanto plus Mt. Fuji, or a Kyushu hot-spring route. For each option, it shouldn't just say "great for relaxing"—it should tell me the rough budget, how many hotel changes it takes, how complex the transit is, how crowded it gets, and which dates offer better value.

Once I pick one, it should carry things forward: which day has cheaper flights, which neighborhood makes the most sense to stay in, whether that restaurant I want to try still has tables, whether the exhibition I've been eyeing is about to close, and which attractions require advance booking. Once I'm there, if it rains, a train is delayed, or a museum closes unexpectedly, it should reshuffle the rest of the schedule, tell me which tickets can be changed, what the cancellation fee is, and what alternatives exist—handling what it can automatically and asking me only when my confirmation is required.

That is what I'm looking for: not longer walls of text, but someone making decisions for me and actually seeing them through.

## Where today's AI gets stuck

Measure that expectation against today's products, and the boundary is obvious.

Today's AI is strongest in the first half: turning a vague request into a few destinations, expanding a destination into a route, and packaging that route into a decent-looking itinerary. It solves "where could I go and what could I do?" At that stage, it already does a great job—far faster than spending a whole evening scrolling through videos.

But a trip actually happens in the second half: whether the flights and hotels really fit, whether the restaurant and exhibition still have availability, whether the attraction is open that day, whether visa or booking rules have changed, how long it truly takes to get from A to B, and how to re-route when it rains. The first half is content generation; the second half is real-time decision-making and execution. Today's AI stalls right on that line.

![The dividing line between chatting and acting](/posts/images/ai-travel-talk-vs-act/ai-travel-talk-vs-act-02.png)

I've run into this more than once. Ask it whether a popular spot needs a reservation this weekend, and it gives an answer that is clearly outdated—the rule changed months ago. It also loves to pack a schedule tight: a major landmark in the morning, a trendy restaurant at noon, an exhibition in the evening. It looks great on paper, until you land and discover the commute between them takes over an hour, the restaurant booked out weeks ago, and the exhibition is closed that day.

At least for now, it's hard to find a single product that reliably manages the full chain from inspiration, planning, booking, and rule checks all the way to mid-trip adjustments. OTAs are strong on flight and hotel inventory, content platforms excel at discovery, maps own navigation and local info, while visas, tickets, and restaurant bookings sit in separate vertical systems. Every category has its strengths, yet for an ordinary user, none of it adds up to a dependable end-to-end experience.

## Why this is so hard

It isn't hard because models aren't smart enough. It's hard because every step in the second half hits hard constraints in the real world.

First, the data is alive. Airfares, opening hours, reservation slots, and visa or entry rules change constantly, and those updates are scattered across official sites, platforms, email notices, and local announcements. If an AI is going to make calls on your behalf, it can't rely on yesterday's snapshot.

Second, local supply is deeply fragmented. Many of the most appealing parts of travel aren't standardized products—they're small shops, pop-up exhibitions, seasonal events, local experiences, and temporary notices. They change quickly, live at fine granularity, span multiple languages, and rarely plug into any unified system. Before an AI can recommend them accurately, it first has to know they actually exist and are still valid today.

Third, transaction systems are siloed. Flights, hotels, tickets, restaurants, visas, payments, and refunds all live in different systems with different rules. Between "you should go here" and "I've booked it for you" sit APIs, live inventory, authorization, payments, and customer support.

Fourth, the cost of getting it wrong is high. Inaccurate copy is annoying at worst; a misbooked flight or a botched visa means you literally can't leave, can't enter, have nowhere to stay, or miss what you came for. Precisely because the stakes are real, nobody is eager to hand full spending and accountability over to an AI.

So a real AI travel assistant only looks like a chat box on the surface. Underneath, it's a capability network: the model is just one piece, alongside live data, transaction inventory, rule verification, payment authorization, and fallback support. Miss any piece, and you stay stuck at "recommendations." This isn't something a smarter model alone will fix; it's heavy, unglamorous work that has to be tackled destination by destination.

![The capability network behind the chat interface](/posts/images/ai-travel-talk-vs-act/ai-travel-talk-vs-act-03.png)

## From "can chat" to "can act"

Putting all this together, my biggest takeaway is that the real hurdle for AI travel assistants isn't going from "can't write itineraries" to "can write itineraries." It's going from "can chat" to "can act."

Chatting depends on model capability. Acting depends on live data, transaction APIs, rule checks, and fallback handling when things break. The former has leaped forward over the past couple of years; the latter is the real moat—and the reason "AI travel assistant" has been talked about for years without becoming a high-frequency, reliable product people actually trust.

So I'm still scrolling through videos—not because AI can't give me ideas, but because it hasn't yet taken over the messy, tedious, fast-changing, error-prone parts that someone actually has to stand behind.

The endgame for travel planning probably isn't a prettier AI itinerary. It's a system that ties together inspiration, pricing, inventory, rules, bookings, transit, and mid-trip changes. Only then can I stop being the person making the travel guide, and just be the person showing up for the trip.
