---
title: "How One Dynamic Timestamp Breaks All Your Agent Caches"
summary: "Prefix caching is a hard physical constraint when building an Agent harness. Adding a single timestamp line at the top of your system prompt invalidates the entire session's KV cache. Here are 4 hidden cache killers, a layered context-freezing architecture, and benchmark data showing why optimizations don't simply stack."
coverAlt: "How One Dynamic Timestamp Breaks All Your Agent Caches"
sourceHash: "c6b63a3dc20677b9"
---

Last month, I helped a team building an internal Coding Agent debug a performance issue.

Their engineers came to me frustrated: the first two or three turns of a session felt fine, but after turn ten, the Agent took five or six seconds just to start responding. When the monthly bill arrived, input token costs were four times higher than expected.

I asked them to export the raw request logs sent to the LLM.

The system prompt was clean and the tool definitions were standard. Yet right at the very top of the prompt sat this line of code:

```typescript
const systemPrompt = `你是一个资深编程助手...
当前工作目录: ${cwd}
当前系统时间: ${new Date().toLocaleString()}`;
```

Just to let the model "know the current time," someone had casually dropped in that timestamp.

As a result, every single turn's request had a tiny character-level change around token 150. The price for that tiny change: the inference engine threw away tens of thousands of cached tokens built up over previous turns and recomputed everything from scratch on every turn.

Inside GPU memory, whether your Agent stays fast and affordable comes down to one thing: protecting the fragile **Prompt Cache**.

## The Physics of Causal Attention: Change One Byte, Lose Everything After It

Processing an input in an LLM happens in two phases: the **Prefill phase** (reading all input tokens and computing Key and Value tensors) and the **Decode phase** (generating new tokens one by one while reusing those computed matrices). The tensors kept in GPU memory are the **KV Cache**.

Modern inference engines (vLLM, SGLang) and model providers widely support cross-request prefix caching: if a new request shares an identical prefix sequence with a previous turn, the engine reuses the already-computed KV state in memory and only computes the newly appended suffix.

This cuts time-to-first-token by over 80% and brings up to a 90% discount on input token costs.

But this mechanism has one hard physical line it cannot cross: **Prefix Exact Match**.

Under autoregressive attention, computing the token at any position depends on the computed states of all preceding tokens. That means: **the moment any byte in the prefix changes, every computed state after that break point shifts in a cascade.**

The cache only recognizes exact byte sequences, checked token by token starting from index 0. Change a single character near the beginning, and tens of thousands of identical tokens after it must all be recomputed from scratch.

Conversely, the one-way dependency of causal attention gives us a useful corollary: **appending at the end has zero recomputation overhead.** New content at the tail never retroactively invalidates cached states ahead of it.

![Changing one byte at the front invalidates everything after it; appending at the end preserves the existing cache](/posts/images/harness-kv-cache-prefix/harness-kv-cache-prefix-01.png)

## 4 Hidden "Cache Killers" When Writing a Harness

Operations that look completely reasonable at the application layer can silently break prefix caching at the inference layer.

### 1. Putting Dynamic Variables Inside the Static Prefix

The system timestamp from earlier, a randomly generated Session ID, or a frequently changing Git branch name all fall into this trap.

If you put the time at the top of your system prompt, every turn triggers a full cold start for the entire conversation. The right approach is to append dynamic time as environment context at the end of the latest user message, or let the Agent query it via a tool when needed.

### 2. Dynamic Tool Switching and Order Drift

Some frameworks add or remove tools dynamically by scenario, or serialize tool definitions without alphabetical sorting so JSON keys drift in random order.

Tool declarations sit before conversation history. Once the tool list changes order or membership, the entire conversation cache following it is immediately invalidated. Keeping a fixed tool order has no impact on the model's ability to pick tools, but it is decisive for cache hit rates.

### 3. Truncating History with a Sliding Window

To cap context length, some systems use a brute-force sliding window—keeping only the last 10 turns.

This is a deceptive trap. Input tokens per request look lower, but because the sliding window drops the oldest message on every turn, the request prefix changes on every single turn, making prefix caching completely unusable.

Even worse, once early tool-call evidence is silently dropped, the Agent starts guessing blindly and gets stuck in a loop calling the same tool over and over.

### 4. Mutating Historical Messages and Thinking Blocks

To save context, modifying past messages mid-session—such as truncating an earlier tool output or stripping previous thinking blocks—breaks prefix consistency and invalidates all cached states after the edit point.

## Counterintuitive Benchmark Results: Optimization Gains Don't Add Up

Most people assume that stacking multiple context optimizations multiplies the savings.

Benchmarks show the opposite. In a controlled 8-turn task experiment toggling "Stable Prefix" and "History Compaction" on and off, the numbers looked like this:

| Strategy | Input Tokens | Cached Tokens | Savings vs. Baseline |
|---|---|---|---|
| No cache, no compaction | 20,700 | 0 | — |
| Stable prefix only | 20,386 | 13,568 | 28.3% |
| History compaction only | 16,177 | 0 | 17.5% |
| Stable prefix + compaction | 16,035 | 6,144 | **30.0%** |

Simple addition says 28.3% + 17.5% = 45.8%. Combined in practice, the total savings was only 30.0%.

**Because compacting history also shortens the prefix available to hit the cache.**

The two optimizations compete for the same pool of savings. When designing a context strategy, you have to measure end-to-end instead of adding single-feature metrics together.

## A Layered Context-Freezing Architecture

A production-grade harness must treat caching as a first-class constraint and enforce a layered context-freezing discipline:

```text
[Layer 1: Strictly Static Zone]    -> Global immutable System Prompt (no dynamic variables)
[Layer 2: Stable Tools Zone]       -> Tool Schemas sorted strictly alphabetically by name
[Layer 3: Base Knowledge Zone]     -> Repo-wide rules and stable context (loaded once as a snapshot)
[Layer 4: Append-Only History]     -> Message sequence (strictly Append-Only, never mutated mid-session)
[Layer 5: Dynamic Transient Zone]  -> Current time, transient env vars (appended as an Addon to the latest User message)
```

![System settings, tools, knowledge, history, and dynamic zones ordered by stability](/posts/images/harness-kv-cache-prefix/harness-kv-cache-prefix-02.png)

The first three layers stay strictly static across sessions. Changes happen only at the very end in Layer 5, so core system instructions and conversation history continue to benefit from GPU cache acceleration.

When a main Agent spawns a subagent, prompts and tool definitions should also align byte-for-byte so the subagent isn't forced into an expensive full cold start.

---

When building an Agent, print the `cached_tokens / total_tokens` hit ratio in your terminal on every API response.

**Prefix caching is the first physical boundary when writing prompts.** The next time your Agent gets slower and your bill spikes, check whether someone slipped another `new Date()` into the top of the system prompt.
