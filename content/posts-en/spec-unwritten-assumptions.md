---
title: "The Most Dangerous Part of a Spec Is What You Thought Went Without Saying"
summary: "A caching spec defined a TTL but omitted \"invalidate the cache on data updates\" because it seemed too obvious. AI does not know what is obvious—it builds exactly what the spec says. The more valuable your engineering intuition, the less likely you are to write it down; turning what you take for granted into explicit text is what separates a weak spec from a good one."
coverAlt: "The Most Dangerous Part of a Spec Is What You Thought Went Without Saying"
sourceHash: "962d73e1c83cc064"
---

Last month, I added caching to a tool I built for myself.

The tool connects to a data platform. It handles a lot of reads and occasional updates. Queries were slow and repetitive, so adding a local cache made sense. I wrote a spec for Codex: the background explained the slow queries, and the goal was to cache common queries and bring response times down from 800ms to under 100ms. I set clear non-goals too: no persistence, no distributed setup. Constraints specified a 5-minute cache TTL, and the acceptance criteria required cache hits to respond in under 50ms.

The code AI returned was clean. Local in-memory cache, LRU eviction, 5-minute expiration, all tests green. I merged it.

Two or three days later, I hit a bug. I updated a record through the tool, queried it right away, and got the old value. I refreshed a few times—still stale. Only after a few minutes did the new value show up.

I checked the code. AI had only added caching to the read path and left the write path untouched. When data changed, the cache had no idea and kept serving stale values. Reads and writes lived in the same codebase, yet AI never connected them.

I went back to my spec. It said "5-minute cache TTL," not "invalidate the corresponding cache entry on data updates." I left that out because in every caching system I have ever built, clearing the cache on writes is basic hygiene—does that even need to be said?

AI does not know what goes without saying. The spec described a read cache, so it built a read cache. You never mentioned writes, so it never touched them.

---

## Your Common Sense Is AI's Blind Spot

Looking back at that spec, I noticed a pattern: everything I missed was not something I "forgot"—it was something I "thought didn't need to be written."

"Support search"—I didn't specify an approach, because in my experience, once a table passes a hundred thousand rows, you use an index; nobody runs a full-table `LIKE`. AI wrote a full-table `LIKE`. It flew on a few thousand rows and timed out as soon as data grew.

"Record audit logs"—I didn't list the fields, because in systems I have worked on, actor, timestamp, before/after values, and request ID are standard. AI only logged the actor and timestamp, leaving us unable to reconstruct what happened when something broke.

"Add authentication to the endpoint"—I didn't specify what status code an expired token should return, because 401 is standard HTTP semantics. AI returned 403. The frontend skipped its token-refresh flow, and users kept getting kicked back to the login page.

In every single case, AI "met" my spec. And in every single case, what I meant and what AI understood were two different things.

The format was fine; all five sections were filled out. But AI could not see the unspoken assumptions in my head—the parts I took for granted.

---

## Unspoken Assumptions Are a Side Effect of Experience

You might think the spec just wasn't detailed enough. But remember the takeaway from the first spec post: writing too much detail is its own trap—a spec that is precise enough is just code in another syntax.

What matters is the nature of the things you leave out.

They are instincts built over years of engineering. Full-table `LIKE` breaks at scale; caches need active invalidation; 401 and 403 mean different things. You don't learn these from docs—they become muscle memory after you get burned. When you write "add caching," your brain automatically attaches "clear the cache on writes," just like you don't add "look both ways" when you tell someone to cross the street.

Those unspoken assumptions are your most valuable engineering judgment. But they come with a fatal flaw: **the more valuable the experience, the less likely you are to write it into a spec—because to you, it is obvious.**

AI works the opposite way. It only sees what you write. If the spec says "5-minute cache TTL," it implements a 5-minute expiration. If you don't say to clear the cache on updates, it won't. It isn't being difficult; it genuinely has no idea there was another layer of meaning in your head.

**You think you said 100%, when you really only said 60%. AI fills the remaining 40% with whatever is most common in its training data. You won't know what it chose until something breaks in production.**

![You think you said 100%, when you really only said 60%](/posts/images/spec-unwritten-assumptions/spec-unwritten-assumptions-01.png)

---

## Silent Conflicts Between Default Choices

If AI picks a bad default in one isolated spot, you still have a chance to catch it during review.

What is actually dangerous is when AI picks separate defaults in multiple places, and those defaults collide in ways you never anticipated.

I ran into an example of this. A spec listed two requirements: "support retries on message consumption" and "ensure idempotent processing." For retries, AI added exponential backoff with intervals of 1s, 2s, 4s, 8s, and 16s—reasonable. For idempotency, it added a deduplication window keyed by message ID, treating the same ID within 5 minutes as a duplicate—also reasonable.

But the fifth retry interval was 16 seconds. Combined with queue latency, the actual delivery time could easily exceed 5 minutes. By then, the deduplication window had closed, so the message was processed again as a new one, breaking idempotency.

Each default made sense on its own, yet together they contradicted each other. My spec never stated that the deduplication window had to outlast the maximum retry span—because in my head, that was common sense.

**Bugs like this are brutal to catch in code review. You have to look at two parameters in two different files at the same time and compute their numerical relationship in your head. The more you trust AI's output—since each module looks reasonable in isolation—the less likely you are to run that cross-check.**

![Two defaults that each make sense on their own, yet contradict each other together](/posts/images/spec-unwritten-assumptions/spec-unwritten-assumptions-02.png)

---

## Write It Backward: List What You Think "Goes Without Saying"

I added one step to my workflow after that.

Before, my spec process was: figure out what I want, fill in the template fields, hand it to AI.

Now there is an extra step. After finishing the first draft, I force myself to go through every requirement and ask one question: **"If someone smart who knows nothing about our project reads this sentence, what will they do?"**

They don't know your data scale, your tech stack, or your logging conventions. They don't know how your frontend handles 401 vs. 403, or the outage you had last time a cache wasn't cleared properly. To them, none of that exists.

They only see the words on the page.

Reviewing through that lens brings the "unwritten" parts to the surface. Put them right into the constraints field—"data volume may reach millions of rows," "cache must be invalidated immediately on data updates," "error logs must include traceId"—one sentence per item is enough.

That single sentence is the bridge between your experience and AI's defaults.

---

Across these three spec posts, there is one thread: the first was about not turning specs into pseudocode, the second was about which fields belong in a spec, and this one is about not leaving your "obvious" assumptions out of those fields.

A template is just a skeleton. Given the same template, what separates a senior engineer's spec from a junior's? Senior engineers translate their unspoken assumptions into explicit constraints; junior engineers don't even realize they have unspoken assumptions.

**The quality of a spec is not measured by how much you write, but by how much of what you take for granted gets put down on paper.**

*Next time you finish a spec, read it again as if you know nothing about the project. You will find plenty of things you thought you said, when you only thought them.*
