---
title: "Why Running More Agents in Parallel Makes Things Messier"
summary: "Parallel multi-agent coding often misses one question: who owns the shared interface. In Cursor's swarm experiment, the old harness racked up 70,000 conflicts in two hours; after redesigning task division and coordination, the same model family scored higher with roughly a quarter of the code."
coverAlt: "Why running more agents in parallel makes things messier"
sourceHash: "a14be4ae4f3e2085"
---

A while ago, I opened three Claude Code sessions at once: one for backend APIs, one for frontend pages, and one for tests. Watching all three terminal windows scroll together really felt like having three extra teammates.

When I merged them that evening, two agents had edited the same utility function, and the test agent was still writing cases against the old interface. I had to read through all three diffs before deciding whose changes to keep. The time saved by running them in parallel went right back into sorting out the mess.

My first reaction was that my prompts weren't detailed enough. After reading Wilson Lin's [swarm experiment report](https://cursor.com/cn/blog/agent-swarm-model-economics) at Cursor, I realized my task split was missing a basic question: who actually owns the interface that backend, frontend, and tests all depend on?

## The old swarm was stopped after two hours

Cursor gave a swarm an 835-page SQLite specification and asked it to build a database from scratch in Rust. There was no existing source code, no test suite, no SQLite binary, and no internet access. At the end, the results were checked with [sqllogictest](https://www.sqlite.org/sqllogictest/doc/trunk/about.wiki).

The old Grok 4.5 swarm made 68,000 commits in under two hours. Before it was halted, it had caused over 70,000 merge conflicts, with a single file modified by 1,173 agents.

The new version had fewer than a thousand conflicts in four hours. Compared under the same Opus setup, the new version used about a quarter of the code and raised the score from 97% to 100%.

![Comparison between a busy swarm and effective output](/posts/images/agent-swarm-context/agent-swarm-context-01.png)

Cursor changed several things at once—version control, conflict arbitration, design docs, and more—so you can't credit the score jump solely to how planners and workers were split. What reminded me of my own merge conflict was a much smaller detail in the report.

## Three separate SQL packages grew in the repo

The old swarm ended up producing 54 crates, including three unrelated SQL packages. Worse than two edits colliding on the same line, three agents each made their own decision on how the SQL layer should be designed.

The new version separates planners from workers. Planners break down tasks and lock in the design without writing implementation code; workers only handle their assigned slice. Planners don't get their context window filled with low-level code, and workers don't have to guess where the rest of the project is headed while writing code. Cursor calls this context efficiency.

![Planners break down tasks while workers execute separately](/posts/images/agent-swarm-context/agent-swarm-context-02.png)

My split for the three sessions had been "backend, frontend, tests." Each task had a name, but the interface had no owner. The backend agent could casually change a signature, the frontend agent could add a field on its own, and the test agent could assert against yet another version of the behavior.

**If two agents can both edit the same interface definition, they don't have two separate tasks—they have two competing claims on the design.**

## Three sessions, with these lines written down first

You can still open three windows, just don't start them all at once. Use a planning session first to write the design decisions and editable scope into `design.md`, without writing code. At minimum, spell out these items:

```text
Design owner: Planning session
Shared interface: Signature / sole editor
Worker A: Task scope / editable files
Worker B: Task scope / editable files
Verification: Command / expected result
```

Only after this file is written do the two worker sessions begin. If a worker hits a design flaw during execution, it kicks the issue back to the planning session instead of quietly inventing a different interface on its own branch.

If a conflict still happens, open a clean session and hand it both diffs along with `design.md`. Cursor's swarm also uses a neutral third-party agent to handle merges so the two workers involved don't overwrite each other.

![Design document, worker sessions, and merge arbitration](/posts/images/agent-swarm-context/agent-swarm-context-03.png)

A `design.md` file doesn't replace Cursor's custom version control system or compilable references. It solves just one small problem: at merge time, you don't have to guess on the spot who had the final say. Cursor has open-sourced the experiment's [minisqlite](https://github.com/cursor/minisqlite) repo, and the full data is in the original report.

My three terminal windows are still there. The difference is that now only one of them is allowed to touch the interface.
