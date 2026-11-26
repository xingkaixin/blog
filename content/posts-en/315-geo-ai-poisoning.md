---
title: "Putting a Fake Product at #1 in AI Recommendations in Two Hours: A Developer's View on GEO Warfare"
summary: "China's 315 Consumer Rights Gala exposed a GEO poisoning case: by mass-generating fake product reviews and distributing them across platforms, a fictional smart band called 'Apollo-9' reached the top of AI recommendations in two hours. From a developer's perspective, this post examines RAG architecture vulnerabilities, the historical cycle from SEO to GEO, and practical defenses."
coverAlt: "Putting a Fake Product at #1 in AI Recommendations in Two Hours: A Developer's View on GEO Warfare"
sourceHash: "64589011ad10cc64"
---

The 315 Consumer Rights Gala demonstrated an experiment that gave me chills.

Someone invented a completely nonexistent smart band called "Apollo-9." Then they used a GEO optimization system to automatically generate a dozen advertorials and publish them across various platforms. Two hours later, they asked mainstream LLMs: "What smart bands are worth recommending?"

The AI actually recommended it—near the top of the list.

If you're not in tech, your reaction might be: "AI is so dumb."

But if you've ever built a RAG system, your first instinct is probably the same as mine: the AI itself doesn't have a bug. The problem lies in how RAG architectures are designed.

---

## 1. First, Understand What GEO Is Attacking

![First, understand what GEO is attacking](/posts/images/315-geo-ai-poisoning/illustration-01.png)

GEO stands for Generative Engine Optimization. It sounds like an upgraded version of SEO, but the nature of it is completely different.

SEO aims to rank your webpage higher in a list of search results—users still see multiple links and make up their own minds.

GEO aims to get AI to **cite your content directly** when generating an answer—users don't see a list of links, they see an authoritative "standard answer." What's the difference? The former just gets you a "recommended spot," while the latter turns the AI into your "spokesperson."

To see why GEO works, you have to understand the underlying architecture of today's mainstream AI products.

Almost every AI assistant you use—DeepSeek, Doubao, Kimi, Ernie Bot—doesn't rely purely on its own model weights when answering factual questions. Their workflow roughly looks like this:

**User asks a question → Retrieval module fetches relevant documents from the internet or knowledge base → Documents are stuffed into the prompt as "context" → LLM generates an answer based on that context**

That is the core principle of RAG (Retrieval-Augmented Generation).

Where does it break down? **The retrieval module only cares about finding "relevant" content. It does not care whether that content is trustworthy.**

Think of it like writing a SQL query: `WHERE content LIKE '%智能手环%' AND content LIKE '%推荐%'`. It faithfully returns every matching record. Whether a record is a genuine user review or a marketing piece mass-generated two hours ago—sorry, the `WHERE` clause doesn't check for that.

That is GEO's attack surface. It doesn't need to modify model weights, hack into servers, or clear any technical hurdles. It only needs to do one thing: **flood the internet with text that "looks like high-quality content," making the retrieval module see it as "relevant" and the LLM see it as "credible."**

Put in more technical terms: GEO doesn't poison the model; it poisons the model's external evidence layer.

---

## 2. GEO's Three-Step Playbook

![GEO's three-step playbook](/posts/images/315-geo-ai-poisoning/illustration-02.png)

The "Liqing GEO Optimization System" exposed on the 315 Gala sounds sophisticated, but once you break it down, the playbook isn't complicated. As a developer, you could probably replicate the exact same pipeline in 30 minutes (of course, don't do that).

**Step 1: Mass-generate fake content.**

Feed in the product name you want to promote, core keywords, and target scenarios, and the system automatically spits out dozens of "review articles," "comparison posts," and "top-10 lists." These articles read convincingly, complete with spec comparisons, hands-on impressions, and "expert advice." Every single detail is fabricated.

**Step 2: Matrix distribution.**

Spread these articles across different platforms and accounts. The key is to "look like multiple independent sources." During retrieval, if the AI sees Platform A, Platform B, and Platform C all praising the same product, it tends to treat that as reliable, "multi-source corroborated" information.

In reality, all of it came from the same content factory. **This "multi-source corroboration" is really just "circular self-citation."**

**Step 3: Continuous feeding to hold rankings.**

This isn't a one-off operation. Because new content constantly floods the internet, stopping the feed means your content gets diluted in retrieval results. That's why GEO vendors naturally operate on a monthly subscription model—they advertise 3,000–4,000 RMB per quarter, while "premium packages" at 20,000 RMB a month or 50,000 RMB a quarter promise to "hold a top-3 spot for 80% of queries."

That's why the GEO executive, when asked about the nature of their business, put it so bluntly: "Everyone online is dumping 'poison' everywhere; GEO is all about dumping 'poison.'"

---

## 3. This Isn't a New Problem—Just an Old One in a New Shell

If you've worked in web development, this story should feel familiar.

In the 2000s, Google became the king of search on the back of PageRank. The core logic was: "The more other pages link to a page, the more authoritative it is." Soon, link farms appeared—swarms of spam sites linking to each other for the sole purpose of inflating a target site's PageRank.

In the 2010s, search SEO matured. Keyword density, title tag optimization, and backlink building became a standardized industry. Alongside it came content farms—churning out low-quality articles packed with high keyword density specifically to feed search engine crawlers.

In the 2020s, recommendation algorithms took over traffic distribution. That gave us clickbait, completion-rate manipulation, and traffic-pool gaming.

In 2026, RAG architectures have become standard in AI products. And now we have GEO poisoning.

**Every generation of information retrieval systems breeds a corresponding manipulation industry.** Because every generation shares the same fundamental tension: it must rapidly filter "relevant" content from a sea of information, and there is always a gap between "relevant" and "true."

Interestingly, history tells us something else too. The 315 Gala's exposure of GEO will likely accelerate the industry's growth, just like when it exposed DSPs years ago. After that broadcast, countless traditional business owners learned for the first time that "ads can actually be targeted this precisely," and compliant programmatic ad buying exploded shortly after.

This time will be no different. After watching the 315 Gala, many business owners won't walk away thinking "GEO is evil"—their first thought will be, "Wait, you can game AI search like this?"

---

## 4. What We Can Do as Developers

Enough rubbernecking—let's talk about practical steps.

![What we can do as developers](/posts/images/315-geo-ai-poisoning/illustration-03.png)

### If You're Building AI Products

GEO succeeds fundamentally because your RAG pipeline lacks a "credibility evaluation layer." Here are a few directions worth exploring:

1. **Source diversity detection**: Before feeding context into the LLM, check whether the documents effectively come from the same content source. You can use text similarity clustering—if five articles from "different sources" share over 0.85 similarity, they were almost certainly generated from the same template.

2. **Tiered source weighting**: Not all sources deserve equal weight. Official websites > authoritative media > niche communities > general UGC > unknown sources. Traditional search engines figured this out long ago (Google's E-E-A-T), and RAG systems need to do the same.

3. **Temporal anomaly detection**: If a product has barely been discussed before, and suddenly sees a flood of positive content within 48 hours, that alone is an anomaly signal. A simple time-series anomaly check can catch most crude GEO attacks.

4. **Citation transparency**: Let users see the sources behind an AI's answer instead of giving them only a "synthesized conclusion." Perplexity does this well by attaching source links to every claim. It won't stop poisoning, but at least it gives users the ability to judge for themselves.

### If You Use AI Daily

A few simple habits can drastically cut your chances of being misled by GEO:

**Ask for sources.** When an AI recommends an unfamiliar product, follow up: "What is your recommendation based on? Which sources did you pull from?" Most AIs will honestly list the webpages they referenced—click through and take a look, and you'll usually tell right away whether it's a real review or a paid advertorial.

**Cross-check.** Ask multiple AIs the same question, then run a traditional search. If only one AI recommends a product while other channels have zero mention of it, that recommendation is suspect.

**Be wary of "everyone says it's great."** In the real world, no product has zero negative reviews. If a brand gets nothing but praise in an AI response with no downsides mentioned—that in itself is abnormal.

### A Bigger Problem

GEO doesn't just expose a flaw in a single RAG system. It exposes the lack of a "trust layer" across the entire AI information ecosystem.

It reminds me of the relationship between HTTP and HTTPS. HTTP wasn't designed with security in mind—anyone could eavesdrop on or tamper with data in transit. Only when HTTPS added TLS encryption and certificate verification did the web become genuinely trustworthy.

AI's information pipeline right now is stuck in the HTTP era: we have powerful generation capabilities, but no mechanism to verify the authenticity of information sources. No single company can solve this alone; it requires a protocol-level solution.

In my previous post, I talked about how the MCP protocol standardizes tool calling for AI. Trust verification for tool calling is already being worked on. What about trust verification for information sources? That problem is nowhere near solved.

---

## Wrapping Up

Back to the Apollo-9 smart band story from the start.

What truly unsettles me isn't that "someone invented a fake product and fooled an AI." Black-hat schemes have always existed, and the search engine era had plenty of misinformation too.

What truly unsettles me is this: **when AI presents information in the form of an "answer," it carries an inherent sense of authority.** When users see ten links on a search engine, they instinctively compare, filter, and doubt. But when an AI hands you a fluent, confident, detailed answer, most people's first instinct is to trust it.

And behind that trust might be nothing more than a dozen advertorials generated two hours ago.

As technologists, I think this is a problem our generation has to solve. Maybe not tomorrow, but the sooner the better.

---

*Have you ever been misled by an AI recommendation? Share your experience in the comments.*

*If you found this useful, give it a "Like" so more developers see this issue.*
