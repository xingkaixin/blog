---
title: "Why Agents Become Less Stable as They Learn: They Need Git-Style State Control"
summary: "Adding Auto-Memory and adaptive Skills to an agent often makes its behavior less predictable over time. When memories, skills, scripts, and scheduled tasks develop conflicting rules, we need a version control system to manage the agent's own state."
coverAlt: "Why Agents Become Less Stable as They Learn: They Need Git-Style State Control"
sourceHash: "81581852da4e5ad7"
---

I recently shut down a coding agent that had been running in the background for a while.

When I first gave it Auto-Memory and self-evolving skills, it looked genuinely smart: it remembered my preferred directory structure, learned to label PRs according to team conventions, and even wrote helper scripts based on past errors.

After three weeks, though, its behavior started drifting.

For a tiny two-line change, it would suddenly pop up three confirmation prompts in a row. Yet when touching a core database migration, it pushed the code straight to a branch without saying a word.

Looking inside its config directory, everything had turned into a mess:

- `MEMORY.md` held last week's preference: "The user dislikes frequent interruptions; auto-approve routine edits."
- A review skill file held an instruction from two days ago: "Always confirm risks with the user before modifying files."
- An auto-generated check script hardcoded an outdated permission flag.

None of these files looked wrong in isolation. But when stitched together and fed into the model, the model spent every step trying to balance conflicting rules. You could not even trace which round of edits first broke its state.

An append-only memory system does not keep evolving smoothly. Instead, it quickly accumulates severe **state drift**.

## Unchecked Append-Only Memory Inevitably Causes Rule Conflicts

Many agent frameworks still treat long-term memory like a notepad.

At the end of each conversation, a background summarizer appends a few user preferences to `MEMORY.md`. If the user says "write more comments" today, it adds a line. If the user says "comments are too verbose, delete them all" tomorrow, it adds another line.

Over time, the model's context fills up with contradictory assertions: both "add inline comments for complex logic" and "keep code minimal and forbid multi-line comments." With multiple mutually exclusive rules sitting in the same prompt, the agent can only guess at runtime.

Even trickier, a modern agent's state is never just plain text. For an agent seriously involved in engineering work, its state spans long-term facts, workflow specs, self-authored helper scripts, and permission configs.

When an agent tries to self-evolve to improve a capability, it might update a skill, write half a script, tweak permissions, and then get interrupted by a cron job or timeout.

At that point, the agent enters a "half-upgraded state": no single file is corrupted, yet the whole system is out of sync.

## State Management Needs Version Control Discipline

Software engineering already has mature patterns for managing complex system state:

Edits across related files need **atomic commits**—either all of them take effect, or none do. Running tasks need **snapshot isolation** so mid-flight writes do not interfere with them. Conflicting rules must be explicitly detected and resolved before they are committed. And when a new config degrades performance, the system must be able to roll back cleanly.

Every time a long-running agent modifies its own state, that change should be a disciplined version transition—never a black-box overwrite directly on live files.

Some newer frameworks have started experimenting with session snapshot isolation: freezing a memory snapshot when a session starts and queuing new memories produced mid-session for the next cycle, keeping the cognitive baseline stable within a single session.

That is still not enough. Real state management has to run validation before changes take effect.

![Atomic commits pass through conflict checks and roll back to a stable state on failure](/posts/images/agent-needs-git/agent-needs-git-01.png)

## Three Versioning Mechanisms for Reliable Agents

To bring version control discipline into agent self-evolution, a system needs to uphold three mechanisms:

### 1. Cross-Dimension Atomic Upgrade Bundles

When an agent decides to upgrade a capability, the affected memory, skills, helper scripts, and permissions must be bundled into a single atomic commit:

```text
Commit 3a7f9c2: upgrade(pr-review): switch to AST-based diff analysis
- memory: update reviewer preference
- skills/review.md: add ast-check step
- scripts/parse-ast.py: create helper
- permissions.json: grant exec for parse-ast.py
```

Only after every change passes syntax checks and sandbox verification does it merge into the main line for subsequent tasks. If any step fails, the entire batch rolls back immediately.

### 2. Pre-Commit Rule Conflict Detection

Resolving rule conflicts must never be pushed down to model inference time.

When an agent tries to write a new rule or edit a skill, the harness should invoke a conflict detector to check whether the new instruction directly contradicts existing rules in the store.

If a conflict is found, the system must raise an explicit warning and attach a resolution action to the commit (such as explicitly deprecating the old rule), instead of stuffing contradictory instructions into the context side by side.

### 3. Branch Experiments and Capability Rollbacks

When introducing a brand-new workflow, you do not need to gamble directly in production. You can spin up a separate branch for the agent's state:

```bash
agent checkout -b experimental-refactor-v2
```

Let it run 10 test issues independently on that branch. If the task success rate improves, merge that state back into main. If it behaves poorly, one command reverts it to yesterday's stable state.

---

AI agents are evolving from one-off chat boxes into long-lived engineering tools.

A system cannot just learn new rules; it has to keep its state consistent. If every interaction merely appends blindly into a config directory, the result will eventually tangle into an unmaintainable knot.

**Piling up memories for an agent is only step one; using version-control engineering discipline to manage state evolution is what keeps it reliable over the long haul.**
