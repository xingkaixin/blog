---
title: "Stop Asking \"What Do I Know?\" First When Picking a Stack: Physical Constraints Come First"
summary: "Tech stack selection is shifting from \"what I already know\" to a system's hard constraints. Agents flatten syntax and debugging barriers, but they won't make architectural trade-offs for you. Without explicit constraints on binary size, memory, and I/O, an agent defaults to the laziest implementation."
coverAlt: "Filtering a tech stack by cold start, memory, single-binary, and WASM constraints"
sourceHash: "249c00b33be7c175"
---

Last month, I set out to build a local log-analysis CLI tool. Out of habit, my first instinct was TypeScript or Python: I know them best, I can move fast in them, and when something breaks, I know where to look.

But the real requirements for this tool were strict: single-binary distribution, zero setup, cold start under 10 milliseconds, and low memory usage across hundreds of megabytes of log streams. Put those hard metrics on the table, and the Node and Python runtimes suddenly look bloated.

In the end, I had an agent build a version in Rust. Within half a day, all unit tests and cross-platform builds passed.

The same shift is happening across the industry. In Cloudflare's Artifacts service, they wrote a complete Git protocol engine in pure Zig, compiled into a roughly 100KB WebAssembly module that runs directly on edge nodes. Vercel's coding agent tool `fx` is also built in pure Zig, pitched around tiny binary size and instant startup.

The first rule of choosing a tech stack is shifting from "what do I know" to "what does the system need."

## Familiarity Used to Buy Debugging Time

In the past, clinging to a familiar stack was mostly a hedge against debugging costs.

An experienced engineer can pick up the syntax of a mainstream language in a few days. What actually stalls you is the scar tissue: an obscure compiler error can burn half a day, a tricky memory lifetime issue can take a whole week to track down, and subtle undefined behavior can make a program crash mysteriously after three days in production.

A familiar language was essentially muscle memory underwriting your delivery timeline.

Today's coding agents have compressed that cost close to zero. Hit a gnarly type-system error or an obscure library quirk, and an agent can give you a fix with context in seconds. Once syntax recall and basic troubleshooting are no longer the bottleneck, the starting point for stack selection naturally moves.

## The First Question Is Now Performance, Size, and Runtime Constraints

In Cloudflare's case, the point wasn't how popular Zig is. It was two hard metrics: a 100KB footprint and a WebAssembly edge runtime.

When your target is locked to "no external runtime, negligible cold start, and embeddable directly in an edge sandbox," the list of viable languages narrows fast. At that point, Zig is the shortest path to the goal, and "I mostly write frontend and Node" stops being a valid reason to stall.

The order of operations has flipped completely: instead of starting from what you already know to decide what you can build, you define the system's physical constraints first and work backward to the tool you have to use.

Many developers who rarely touched systems programming before are already using agents to work with eBPF, network drivers, and low-level syscalls. The tools flattened the entry barrier, which pushed the center of gravity in engineering deeper.

## Once Syntax Is Free, Engineering Judgment Is the Bottleneck

Cross-language coding with an agent lets you spin up prototypes fast, but it can also bury landmines in latency, consistency, and reliability.

An agent defaults to the path of least resistance—cleanly formatted code, all unit tests passing. The hidden engineering flaws only show up under real load.

I stepped right into that trap with my Rust log analyzer. The agent quickly delivered a spotless first pass with green unit tests. Then I pointed it at a real log file of a few hundred megabytes, and memory usage spiked past 4GB.

Looking at the code, I saw why: to keep things simple, the agent called `read_to_string` on every search request to load the entire file into memory and cloned data repeatedly across function calls. And when it hit a file I/O error, it tossed in a silent `loop` retry with no backoff, instantly pinning one CPU core at 100%.

![Full-file log reads push memory to 4GB while a backoff-free loop pegs the CPU](/posts/images/stack-choice-constraints/stack-choice-constraints-01.png)

The agent got the syntax to compile, then chose the laziest possible I/O model. If you lack basic engineering judgment around memory mapping (mmap), zero-copy streaming, and failure backoff, that kind of code is a disaster in production.

## Put Engineering Trade-offs Into Explicit Task Constraints

Getting an agent to deliver reliable code in an unfamiliar stack comes down to turning architectural trade-offs into hard constraints up front, right in the task definition.

Before letting the agent write a line of code, lock down boundaries like these:
- **Size and startup**: Binary size capped at 15MB, cold start under 20ms, no heavy async runtimes allowed.
- **Memory and I/O**: Peak memory under 50MB, no full-file loading into memory, zero-copy streaming or memory mapping required.
- **Error recovery**: Fail fast with a standard exit code on I/O errors; no silent retries without backoff.
- **Complexity control**: Keep third-party dependencies minimal, prefer the standard library, and avoid complex concurrency optimizations unless necessary.

When hard constraints like these are written down in black and white, working in an unfamiliar language is actually less likely to go off the rails than working in a familiar one. In a stack you know well, many engineering norms stay unspoken habits and are easy to overlook. In an unfamiliar language, you are forced to spell out every trade-off before work begins.

Writing in a language you haven't mastered yet is no longer blocked by syntax.

**The real barrier has always been engineering judgment: you have to know, with total clarity, what cost your system is paying for every gain it gets.**
