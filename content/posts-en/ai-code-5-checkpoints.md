---
title: "After AI Writes the Code, I Only Check These 5 Places"
summary: "When code-reviewing AI-generated code, traditional checklists pass while risk hides in the default choices it made for you. Focus on five spots: boundary conditions, error-handling paths, assumptions about external dependencies, state consistency, and permission boundaries—where AI is most likely to be confidently wrong. Ten minutes spent here saves a midnight incident call."
coverAlt: "After AI Writes the Code, I Only Check These 5 Places"
sourceHash: "b9950c27eba4527f"
---

PRs submitted by AI are getting harder to fault: clean naming, thorough comments, well-structured try-catch blocks, and all-green tests. You go down a traditional review checklist from top to bottom, catch nothing, conclude "looks good," and hit merge.

**The code looks good because you are measuring the wrong things.**

In the last few posts I kept writing about how hard it is to accept AI-generated code. A reader asked: I get the point, but I can't review every line—give me something I can actually use. This is it.

The biggest risk in AI code comes down to "wrong choices": it makes decisions on its own wherever you weren't explicit, and it makes them without hesitation. Those choices cluster in five places.

## 1. Boundary Conditions

When AI hits a problem, it pulls the best-matching general solution from its training data. The solution itself is sound—textbook-grade—and works fine in most scenarios. Your product might not be in "most."

I once had AI write a page-block cache for an e-reader: keep rendered page blocks in memory so turning pages wouldn't require re-parsing. AI used an LRU policy, keeping the 10 most recently accessed blocks and evicting the least recently used one. Clean code, classic strategy.

But reading a technical book is not like scrolling a web page. Web browsing is linear—you scroll straight down, and LRU fits perfectly. Reading a technical book oscillates: you reach page 50, forget an earlier formula, flip back to page 30 for a look, then jump back to 50. The block for page 30 has already been evicted by LRU, so the rendering engine has to re-parse it. That isn't a cache miss; it's a mismatch between the eviction policy and the workload.

When checking boundary conditions, ask one extra question: what usage pattern did AI assume behind this implementation? Does that pattern match your users? The general solution AI picked is right in a textbook—what about in your product?

## 2. Error-Handling Paths

AI error handling has a signature trait: it is always there, and it looks complete. The try-catch layers are clear, the error types are neatly separated, and it reads like professional code.

But AI makes a default assumption about error handling: every abnormal event sends a notification. An incoming call triggers an interruption notification; entering the background fires a didEnterBackground callback. Everything listed in the API docs is covered.

I once asked AI to implement recording state persistence for a voice-note app: save recording progress when the app enters the background, and resume from the interruption point when it returns to the foreground. AI handled every documented event: save on background, restore on foreground, pause on incoming call, resume when the call ends. Every test passed.

Yet under memory pressure, a mobile OS can terminate a background process outright without giving the app a chance to run one last save. A user is recording, switches to WeChat to reply to a message, and the system reclaims the process at that exact moment. When they return to the app, it restores from the last saved point and continues recording—but the chunk of audio sitting in the pipeline buffer has vanished. The app didn't crash or throw an error; the recording just has an unnoticeable gap.

AI's error handling covered every event listed in the docs. It missed the one not in the docs: the runtime can kill your process at any time without warning. That event isn't in the API reference—it only shows up in production incidents.

One rule of thumb: does this error-handling code assume abnormal events will always notify you? If your runtime can act without sending a notification—like the OS reclaiming a process, or a request being canceled without the business layer receiving a terminal state—registering notifications and callbacks is not enough.

## 3. Assumptions About External Dependencies

This is the most hidden spot in AI-generated code.

I once had AI add a "tool call latency" metric to a CLI to track each tool's average response time. AI parsed the tool_call records in the session logs and calculated latency as end_time - start_time. The numbers were clean and the ranking looked reasonable.

Later, when I read the Agent's source code, I found that the Agent cached certain tool calls locally. When read_file hit the cache, it didn't actually read the file at all, yet the log still emitted a tool_call record with a 30ms gap between start and end. Those 30ms weren't disk I/O—they were a cache lookup plus IPC. What AI measured as "tool latency" was actually the Agent's internal overhead for handling the call, not the tool's own execution time.

AI trusted the field names at face value. But the same field name can mean different things upstream and downstream: the Agent's duration is "internal Agent response time," while your "tool latency" means "external tool execution time." That semantic gap isn't in the type definitions; it's in the Agent's implementation details.

How to check: find every calculation that relies on an external field and ask what that field actually means in the upstream system. A field name only hints at intent; the assignment logic defines its semantics.

## 4. State Consistency

When AI manipulates data, it often introduces side effects you didn't anticipate. The classic case: it adds a cache to the read path, forgets to touch the cache on the write path, and after an update, the cache keeps serving stale data. I covered that example in full in the Spec post, yet it shows up in real reviews so often it's numbing. Similar bugs include global variables carrying dirty state from a previous request, or step two of a transaction failing without rolling back step one.

These bugs rarely surface in a single-run test: on the first run, the cache is empty, the state is clean, and the transaction is fresh. They only show up after a thousand runs.

The way to check is impact tracing: find every write operation, and from each one, trace a line to every read path it affects. Wherever a line breaks, you have a ticking time bomb.

## 5. Permission Boundaries

AI almost never adds security controls on its own unless you explicitly ask for them.

Modern models mostly handle "surface-level" security out of the box: parameterized queries, input validation, endpoint auth—they add those without being told. What they miss is the part they can't reason about.

I once had AI build shareable links for voice notes. It added a login check on link access so unauthenticated users couldn't view them. The PR description read "Added access control." A reviewer glanced at it, saw auth was in place, and approved.

But a login check only answers "who are you?"—not "were you invited to see this note?" The "friends only" visibility setting didn't work at all; anyone who logged in with the link could view it. AI implemented authentication and skipped authorization.

When checking permission boundaries, don't be fooled by "has auth." Ask: is it checking whether this user is logged in, or whether this user has permission to access this specific resource? AI often fills in the first on its own; the second needs to be spelled out in your acceptance criteria.

---

These five places share one trait: **they are where AI is most likely to be "confidently wrong."**

AI doesn't hesitate here, doesn't flag "I'm not sure," and raises no alarms. In the exact same tone it uses for everything else, it hands you an implementation that runs flawlessly in your local environment. All the risk hides in the gap between local and production.

**Focus your limited attention on these five spots. Spend two minutes on each—ten minutes total.**

If you feel confident after checking them, merge. If not, have AI add three things: documented assumptions, failure paths, and targeted tests.

Those ten minutes buy you one fewer midnight production incident call.
