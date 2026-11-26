---
title: "Every AI Coding Session You Have Is Quietly Disappearing"
summary: "From agent-dump to agent-view to CodeSesh, I've spent a lot of time building tools to visualize AI coding sessions. Here's why I keep working on it, what CodeSesh actually solves, and how it differs from tools like Spool."
coverAlt: "Every AI Coding Session You Have Is Quietly Disappearing"
sourceHash: "e99d4895bd015df5"
---

I've built several projects around visualizing AI coding sessions. It started with agent-dump—a Python CLI that exported session data from tools like Claude Code and Codex into JSON and Markdown. Later, exporting wasn't enough; I wanted to inspect sessions directly in the browser, so I built agent-view, a pure frontend session replay page.

After using both for a while, it became clear they belonged together: splitting scanning and visualization into two separate tools only added friction. In mid-April, I rewrote the whole thing in TypeScript and merged them into CodeSesh. A single `npx codesesh` command handles scanning, indexing, and launching the Web UI.

## What I'm Actually Trying to Solve

Claude Code and Codex are my daily drivers for writing code. I generate a lot of sessions every day, and each one captures the full engineering process—which files the agent read, what commands it ran, which lines it edited, and how its reasoning unfolded. Once a task is done, all that data just sits on disk and rarely gets looked at again.

That always felt like a waste. `git log` tells you what changed, but a session records why you changed it and what detours you took along the way. That context is valuable when tackling similar tasks later, yet if you can't see it or search it, it might as well not exist.

## How It Differs from Spool

I'm not the only one working on AI session management. Spool does a solid job in this space—if you want to search for "what did I talk to AI about on a project last week," its conversation-level search is great.

CodeSesh focuses on a different level of granularity. I don't just want to see what I said to the AI; I want to see what the AI agent actually did throughout the session: which tools it called, which files it read and wrote, and what steps its reasoning went through.

For example, when Claude Code fixes a bug, a single session might involve reading a dozen files, trying two or three approaches, and running several rounds of tests before converging. Spool can help you find that conversation, but if you want to trace the full execution chain—from reading logs to pinpointing the root cause to verifying the fix—you need the granularity CodeSesh provides.

The two tools solve different problems. Use Spool to search conversations; use CodeSesh to review the process.

## How I Use It Myself

After a month of using it, a few workflows come up most often:

Viewing an AI collaboration timeline by project. On the same project, I might use Claude Code for design decisions and Codex for implementation and code review. CodeSesh groups sessions from different agents by project, giving me a complete picture of how the work progressed.

Replaying the full path of a specific task. Sometimes the way an agent debugged an issue in a session is worth studying on its own—which file it checked first, how it narrowed down the scope, why it abandoned its first approach. None of that is visible in git history.

Tracking usage. You can see how many tokens each session consumed, which model it used, and the estimated cost. It's not about pinching pennies; I just want a rough sense of my daily AI usage across different projects.

## Try It Out

```bash
npx codesesh
```

It automatically scans your local session data and opens the local Web UI in your browser. Nothing leaves your machine.

It currently supports Claude Code, Cursor, Kimi, Codex, and OpenCode. It's open source—adding a new agent is just writing and registering an adapter.

https://codesesh.xingkaixin.me

If this sounds useful, run it to see the full picture of your own sessions, and feel free to open an issue on GitHub if you have ideas.
