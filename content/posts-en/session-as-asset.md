---
title: "You Throw Away the Most Valuable Part of Every Agent Session"
summary: "After finishing a session with an agent, code goes into git, while engineering judgment—pitfalls hit, solution assumptions, what to check first next time—has no home and disappears when the session closes. The fix: while context is still hot, have the agent distill non-obvious takeaways into 100–200 words in a searchable decisions directory so you can grep them back next time."
coverAlt: "You Throw Away the Most Valuable Part of Every Agent Session"
sourceHash: "c4dc98353396f635"
---

Last month, I was debugging a concurrent write issue in SQLite WAL mode. I checked the docs, tried a few locking strategies, went back and forth with Codex for a few rounds, and finally landed on a fix: serialize writes, add a queue, and configure the connection pool for a single writer and multiple readers. It took about two hours and three pitfalls.

I closed the terminal. The next day, I moved on to something else.

A week later, another project hit SQLite concurrent writes. I distinctly remembered solving this before, just not how. I searched again, tested again, fell into two of the exact same traps, spent another hour-plus, and arrived at the exact same conclusion.

I tried taking notes. I piled up more than a dozen pages of debugging logs in Notion, dumping huge amounts of context when writing them down, only to dig through them forever when I actually needed an answer and still miss the one sentence that mattered. Too much detail becomes a chore; too little is useless. Eventually it clicked: **I kept recording the process, dumping the entire play-by-play of a session into Notion. The engineering conclusions that actually mattered got buried under all that context.**

## Code Has Git, Docs Have READMEs—What Holds Engineering Judgment?

When you finish a feature, you actually produce three things, and their fates could not be more different.

Code has a home: it goes into git, CI runs it for you, and blame lets you trace it.

Documentation has a home: it goes into the README and the docs, where new teammates see it during onboarding.

What about judgment? Which traps you hit and why, under what conditions a solution holds, and what to check first next time you run into something similar—this is the highest-density, most expensive output of the work, yet there is nowhere to put it. It grows out of a real problem, then vanishes the moment you close the session.

![Three types of output, with only engineering judgment left homeless](/posts/images/session-as-asset/session-as-asset-01.png)

Look at it from the other side: you barely have to worry about the first two. Git tracks the code for you, and templates force you to write the docs. What you actually need to capture intentionally is the third—the judgment that git cannot store, docs do not cover, and only ever existed inside a session. Yet in the entire toolchain, not a single container was built for it.

Not every piece of work is worth keeping. Renaming a field or fixing a minor bug—once it's done, move on.

There is only one bar for what's worth keeping: did it produce a non-obvious engineering conclusion?

Obvious conclusions are already in the docs—this API takes that parameter.

A non-obvious conclusion looks like this: the docs tell you to use X, but in your setup X triggers Y, so you end up needing Z; the root cause is that default settings A and B collide, so next time check those two first.

Let me stop here for a second. You might say: can't a search engine give you that too? Serializing WAL writes, single writer and multiple readers—yes, you can search for that, it's the textbook answer.

But a search engine gives you the destination, not the steps you had to stumble through to get from your starting point to that destination. How your connection pool was configured, where each of those three traps sat, why the default settings collided in your setup—that path isn't in any documentation. It only existed in the session you just closed. **The solution is searchable; the path you took to reach it is not.** If you don't save it, you'll walk into the same traps all over again next time.

![Non-obvious conclusions: short answer, expensive path](/posts/images/session-as-asset/session-as-asset-02.png)

## How to Make Sure You Can Actually Find It Next Time

The cure has to match where Notion failed. Notion failed because you couldn't find what you needed when you needed it. So this approach has to answer three things directly: how to capture it, what shape to store it in, and how to pull it back up next time.

**Distill while context is still hot—have the agent do it instead of relying on your memory later.** Once a phase of work wraps up, give it one prompt: compress the non-obvious conclusions from this phase into 100–200 words, spelling out the traps hit, the root cause, and the conditions where the fix applies. When humans recall later, they drop the root cause; right now, the agent still holds the full context. That's where it beats you—once the session ends, that window is gone.

**Store the conclusion, not the process.** Keep it to 100–200 words and drop it straight into a global `~/decisions/` directory—so it's searchable across projects—and sync project-level team consensus into the repo's `docs/decisions/`. Name the file directly after the scenario keywords—`sqlite-wal-并发写入.md`, not `2026-06-03-笔记.md`. Next time you search for "SQLite concurrent", the filename itself needs to match your query on the spot. That's where Notion tripped up: it buried the searchable keywords in the third paragraph of the body.

**Keep one fixed entry point for search.** Everything goes into the same directory, and before starting new work, you grep there first. Fixed container, searchable filenames, single entry point—only then does saving something mean you can actually retrieve it. Otherwise, just like Notion, saving it is no different from never saving it at all.

![Distill while hot → Store the conclusion → Search it next time](/posts/images/session-as-asset/session-as-asset-03.png)

---

For that SQLite issue, what sits in my notes now isn't "serialize WAL writes"—the answer anyone can search for—but the three traps I hit on the way there. When a friend asked me about WAL writes, I sent him that path. He skipped the hour-plus of re-stepping into the same holes and fixed it in ten minutes.

Think back to your last project: was there a conclusion you bought with two hours of work—and the moment you closed the terminal, you never saw it again?
