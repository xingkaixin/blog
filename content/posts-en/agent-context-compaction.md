---
title: "Why Does an Agent Rewrite a Rejected Solution at Turn 30?"
summary: "Why do agents suddenly lose capability and forget decisions after long conversations trigger context compaction? Why does naive full-text summarization erase critical constraints? A breakdown of modern coding agent compaction mechanisms and the shift-handoff design."
coverAlt: "Why Does an Agent Rewrite a Rejected Solution at Turn 30?"
sourceHash: "1cccf6f20c2ebf55"
---

Last week, I was pair programming with an agent on a refactoring branch.

The first twenty-odd turns went smoothly: we tracked down a concurrency lock issue in the legacy architecture, ruled out using a global Mutex, consolidated state into an independent Actor structure, and thoroughly tested several key edge cases.

At turn 28, a subtle message popped up on screen: `Context compressed (compaction triggered)`.

Immediately after, when I asked it to finish the persistence logic for the next endpoint, it confidently produced a brand-new patch—creating a Mutex directly in the global scope, writing back word-for-word the exact code we had spent hours rejecting and deleting two hours earlier.

Many people assume this is attention decay in the LLM. Take one look at what it actually did at the moment of compression, and the root cause is straightforward: **it flattened critical technical decisions into an ordinary conversation summary.**

## Why Naive "Chat Summaries" Fail in Long Sessions

In many simple agent implementations, the logic for handling an overflowing context window is blunt:

Bundle up the previous dozens of turns, call an LLM once, and attach a prompt: "Please summarize the main content of the conversation above and keep important information."

This approach might be good enough for customer support chat or casual Q&A, but in serious coding scenarios, it is almost a disaster.

A 30-turn coding session typically contains two completely different kinds of information:

1. **High-volume, low-value transient noise**: two hundred lines of `grep` output, long stack traces from failed tests, verbose text returned from reading config files.
2. **Low-volume, high-stakes decision assertions**: explicitly rejected dead ends, workarounds required for specific dependencies, and unified interface contract constraints.

When an LLM writes a flat summary, it often spends paragraphs describing "which files were inspected and which tests were run," while diluting those one- or two-sentence hard constraints into a passing remark like "discussed refactoring ideas."

When the next turn starts, the agent sees a smoothed-over overview. Pitfalls that were verified and explicitly rejected now look like "unexplored, reasonable options" again.

## Production-Grade Compaction Is a Shift Handoff

Mature coding agents abandoned the full-text shrinking approach long ago when handling context compaction.

Production-grade compaction must be a **rigorous engineering handoff briefing**.

![Naive summaries flatten constraints, while a structured handoff briefing preserves goals, rejected paths, and next steps](/posts/images/agent-context-compaction/agent-context-compaction-01.png)

The incoming shift does not care how many temporary commands the previous shift ran or which unrelated files it opened. It only needs to take over three core facts immediately: what the current stable state of the system is, which disproven approaches are strictly off-limits, and where the exact boundaries of the next tasks lie.

In engineering terms, a mature handoff mechanism includes four design elements:

### 1. Dedicated Summarizer Identity and Invocation

Context compaction cannot be done casually within the existing conversation flow.

When compaction triggers, the harness sends a completely independent, stateless single request to the model. This request does not inherit the bloated history, and its system prompt is swapped for a dedicated summarization instruction:

> "You are a context compaction and handoff assistant. Your task is to extract from the history below the hard context the next engineer must have to take over."

Only by stripping away the original coding role can the model evaluate from a third-party perspective which actions were temporary and which are long-term assets.

### 2. Structured Handoff Template

The summary must never be free-form prose. A proper handoff briefing must be strictly constrained to structured Markdown sections:

```text
[Current Core Goal]
- The core problem this session is solving and the definition of done.

[Key Decisions & Constraints]
- Adopted design patterns and state transition rules.
- Paths proven unviable and explicitly abandoned (Negative Constraints).
- Naming, type, and security conventions that must be followed.

[State & Progress]
- Which files have been modified or added (with key exported symbols).
- Current usable state of the codebase (which tests pass).

[Next Steps]
- Unhandled branches and remaining to-do items.
```

The most critical section here is the **abandoned paths**. Only by explicitly locking down "what not to do" can you prevent the agent from stepping into old traps after losing its memory.

### 3. Retaining the Last N Turns of Raw Context

A local buffer must be kept at the tail during handoff.

In practice, the harness carves out a retention zone at the end of the current conversation (usually the last 5 to 15 turns, roughly a 20k token budget).

```text
[System Prompt + Tool Definitions]
[Structured Handoff Briefing Generated by Compaction]
[Raw Transcript of the Last 10 Full Interaction Turns]
[New Prompt Just Sent by the User]
```

![Stable instructions, the handoff briefing, the last ten turns, and the new prompt form a workable context](/posts/images/agent-context-compaction/agent-context-compaction-02.png)

The structured briefing locks in the global goals and architectural constraints, while the uncompressed recent turns ensure no context gap occurs in the details of the function currently being edited.

### 4. Stripping Away Tool Output Noise

In long sessions, the bulk of tokens is never the natural language exchanged between human and AI—it is tool execution outputs: thousands of characters of `cat` source code, verbose build logs, and complex JSON responses.

When preparing handoff data, the underlying serialization module should actively filter out these already-consumed intermediate artifacts, leaving only "which tool was called and what key conclusion was reached," physically purging high-entropy junk.

## How to Prevent This in Daily Development

In daily development, three low-cost habits can reduce compaction amnesia:

1. **Write key decisions into files, not just the chat box**. If a technical constraint matters (for example, "do not use multithreading in this function"), put it in a comment right above the code or record it in the repository's spec file. Code files are physical facts the agent can read with tools at any time—they will never be washed away by compaction.
2. **Declare hard boundaries at the start of a session**. Set a clear scope for the task so the agent knows explicitly which modules must not be touched.
3. **Start a fresh session when a long task crosses phases**. Once a feature finishes its interface definitions and passes tests, the safest move is to make a clean Git commit and start a brand-new session to carry on. Starting from concrete code changes is far more reliable than nursing a bloated 50-turn conversation.

**No matter how large the context window is, it cannot beat unorganized forgetting; in long-horizon engineering, a precise handoff always outperforms blind accumulation.**
