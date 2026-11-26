---
title: "Process Crashed, Resumed, and the Agent Froze: The Log Is the Agent"
summary: "After a Claude Code process crashed, resume brought back the conversation but lost the pending permission request. For an agent to truly recover, what gets persisted cannot be just a transcript—it must include replayable events, workspace state, and side-effect state."
coverAlt: "Process Crashed, Resumed, and the Agent Froze: The Log Is the Agent"
sourceHash: "5557892c04329074"
---

The other day, Claude Code was running a fairly large change and paused at a permission prompt, waiting for me to press `y`. I switched away to handle something else, and when I came back, SSH had disconnected and the process was gone.

After running `claude --resume`, the session came back with every line of history intact, except the permission prompt never returned. The agent sat there frozen—neither continuing nor asking me again, like someone who forgot the second half of their sentence mid-thought.

I always chalked this up to a bug in resume. Later, after reading Ishaan Sehgal's [_The Log Is the Agent_](https://www.omnara.com/blog/the-log-is-the-agent) on Omnara's blog, it clicked: why a permission prompt disappears depends not just on how resume is written, but on what the system treats as recoverable ground truth.

## Your Character Lives in the Save File, Not the Console

He opens with an analogy to _Elden Ring_: after a hundred hours of play, your character's level, gear, and progress don't live inside the console hardware—they live in the save file. Swap machines, sync the save over, and it's still your character.

Agents have hit that same boundary. Both the model and the execution process are replaceable; to pick up the same work, you have to carry forward what has already happened. User inputs, model outputs, tool calls, tool results, permission requests, and approvals should all be written as append-only events.

Simply saving the conversation as JSONL isn't enough, though. To resume in place, the log also has to link to workspace snapshots, artifact versions, external side effects, and runtime configuration; the executor also needs to know which actions have already been taken. Miss any one of those, and what spins back up is just a new process that "remembers what we talked about."

My permission request fell right outside that boundary. Resume read the transcript, so it knew what we had discussed; it couldn't read the pending-approval event, so it didn't know the next step was still waiting on a human. Only when the request itself, its corresponding tool call, and its execution state are persisted can a new worker pick up waiting for me to press `y`.

![The gap in transcripts versus a complete event log](/posts/images/log-lock-in/log-lock-in-01.png)

Many harnesses already save transcripts, but a transcript is only enough to restore the UI, not necessarily execution. As long as pending permission requests, leases, workspace versions, and side-effect identifiers remain scattered across process memory, the filesystem, and internal tables, users will keep seeing the same outcome: history is still there, and the agent won't budge.

## Processes Can Restart; Side Effects Cannot Replay

An event log solves recovery first, then forces the execution loop to be written differently. A worker acquires a temporary lease, reconstructs state from the log and associated snapshots, takes one step forward, records its call intent first, and only then executes the side effect and writes back the result.

Trouble usually strikes when the request has already been sent, but the result hasn't been written back yet. If the worker crashes right then, should the new worker send it again? Calls that support idempotency keys must reuse the same key; non-idempotent actions must query or reconcile state on recovery rather than retrying blindly. Otherwise, messages, charges, and deployments can all happen twice.

![Recording intent, executing side effects, and idempotent replay](/posts/images/log-lock-in/log-lock-in-02.png)

The same event chain can also fork from any node: one branch running Claude, another running a local model, each exploring its own path. Files and sandbox snapshots have to fork along with it, though, or both agents end up mutating the same workspace. The migration boundary is just as concrete: model adapters are only the shallowest layer; the event format and artifact references are what actually have to move.

Because the context window can't hold the full history, execution still needs compaction. But the compacted output cannot replace the raw log. Compaction is a lossy projection—just as a materialized view isn't the database itself. Keep the raw log, and you can always re-compact it a different way later; keep only the compacted version, and any dropped detail is gone for good.

## The Deepest Lock-In Is Log Lock-In

Reading this made me realize I had underestimated platform lock-in before. Models can be swapped, APIs can be wrapped behind an adapter, but execution history is hard to move. **Whoever owns your log owns your agent.**

Being able to export a transcript is certainly better than nothing, yet it still won't let an agent keep working. Migration requires taking at least the structured events, workspace and artifacts, tool-call states, and a replayable format. I wrote previously that [solutions are searchable in a session, while paths are not](/en/posts/session-as-asset/). Now I care even more about who stores that path, and whether it can still keep running once you leave the platform.

![Platform access versus full portability](/posts/images/log-lock-in/log-lock-in-03.png)

Every provider is offering managed loops, memory, sandboxes, and background execution, which saves teams a lot of infrastructure work. The trade-off is just as concrete: the agent touches your code, data, and decisions, and the log records failed attempts alongside permission choices. How long it is retained, who can query it, and how much can be exported are all up to the platform.

---

Right now, many agent sessions end the same day they start, so the weight of the log hasn't shown up yet. Still, platform infrastructure choices are being made today. Once sessions begin spanning days and tasks and accumulating reusable work history, migrating later becomes moving house with all the furniture inside.

So when evaluating an agent platform now, I first check where the log is stored, whether it can be replayed in full, and whether it can be exported together with the workspace and artifacts.

When those questions don't have clear answers, all I'm getting is an entry point to run an agent. Whether the character survives still depends on the save file held by the platform.
