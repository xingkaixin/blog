---
title: "Same Model, Different Harness: Coding Agent Bills Can Differ by 5x"
summary: "Downgrading models mid-session in a coding agent triggers Prompt Cache recomputation and silently drops higher-tier thinking blocks. Benchmarks across 7 models and 3 harnesses show you save money by choosing based on cost per resolved task and switching models only at new session boundaries."
coverAlt: "Same Model, Different Harness: Coding Agent Bills Can Differ by 5x"
sourceHash: "5743ae592d72488d"
---

On September 17, the Arena.ai team published the [HarnessTax benchmark](https://arena.ai/blog/coding-agents-harness-tax), testing 21 combinations of 7 models paired with Claude Code, Codex, and Pi. Each combination ran 3 times across 30 tasks each from SWE-bench Lite and Terminal-Bench 2.0, with costs calculated uniformly using direct API pricing as of September 1.

In these tests, the same model achieved similar pass rates across different harnesses, yet the cost per run varied by up to 5x. On the first benchmark, for example, Fable 5 averaged 15.4 turns in Pi and 15.3 turns in Claude Code. Claude Code's pass rate was only 1.1% higher, but its cost per run was roughly double that of Pi.

First-party harnesses did not always win either. Across 12 cross-benchmark comparisons of 6 Anthropic and OpenAI models, 9 of the highest observed pass rates came from third-party tools.

Sonnet 4.6 reached 68.9% on Codex, beating the first-party 66.7% at a similar cost. On the second benchmark, GPT-5.6 Sol hit 83.3% in Pi, outperforming Codex's 78.9% while dropping the cost per run from $0.76 to $0.42.

## The Price Gap Comes from the Harness Tax, Not Just Token Rates

To see where the difference comes from, you need to separate three layers: the interface, the model, and the harness. As Theo noted in an October 23 [breakdown](https://x.com/theo/status/2113424203345265053), the model only generates text, and the terminal or desktop app is just the UI. The software layer that provides tools, defines schemas, and feeds results back is the harness—and it can be plugged into other application UIs for reuse.

The report calls the overhead introduced by the harness the "Harness Tax," and it starts accruing on the very first request. Pi ships with only four tools—read, write, edit, and bash—while Claude Code includes a large set of built-in tools and long system prompts. Averaged across the 7 models, Claude Code's initial context was more than 10x larger than Pi's.

Every subsequent turn resends the instructions, tool definitions, and conversation history. The more source code and logs you load into the main session, the higher the recurring bill for redundant context on every turn.

According to calculations cited in Claude's official [model selection guide](https://claude.dev/blog/which-claude-model-should-you-build-with/) on November 9, when Opus 5.5 hits the prefix cache, a single cached read of 150K context costs about $0.03, whereas trimming it to 20K drops the cost to around $0.004.

## Downgrading Mid-Session Hits Two Hard Constraints

Running a large model through a long session is expensive, so switching to a cheaper, smaller model midway seems like an easy way to save money. However, two hard API constraints disclosed in that November 9 guide show that downgrading mid-session rarely saves budget and can break reasoning.

First, Prompt Cache is isolated by model. A cache belongs strictly to the model that wrote it and is not shared across models. If you swap a frontier model for a cheaper model mid-session, the new model has to recompute the entire history at cache-write pricing on its first turn.

Second, encrypted thinking blocks are only downward-compatible. Only higher-tier models can read thinking blocks from lower-tier models—for example, Fable 5.2 can read records from Opus 5.5, while lower-tier models cannot read thinking blocks from higher-tier models at all.

Once you downgrade mid-session, especially from the top tier to a lower tier, the API silently drops the unreadable thinking blocks and still returns a successful response. The smaller model taking over loses the prior chain of reasoning and ends up editing code blindly.

## Choose by Cost per Resolved Task, Switch at Session Boundaries

When evaluating a harness, do not look only at pass rates or per-token prices. Sample a batch of real tasks from your repo with verifiable outcomes, run them in isolated sessions across different harnesses, models, and reasoning efforts, and decide based on the actual cost per resolved task from the API bill.

When you need a large model for planning and a smaller model for execution, switch at an isolated new session or subagent boundary. Before handing a task off to a cheaper model, start a fresh session with a brief written plan or work summary. If you must switch within the same thread, run /compact to compress the history first—never downgrade directly in the middle of an uncompacted long session.

![Hand off a brief plan to a new session while keeping the long history in the original planning session](/posts/images/agent-harness-tax/agent-harness-tax-01.png)

To offload work within a single task, dispatch a subagent with its own isolated context. Easily verifiable tasks like finding files, running tests, and reading logs are well suited for cheaper models, while code edits and key decisions should stay with the main model.

Claude Code's opusplan alias defaults to Opus for planning and Sonnet for editing code—benchmark it on real tasks before adopting it.

**Factor harness context overhead into your cost per resolved task when choosing tools, and only mix large and small models at fresh session or subagent boundaries.** Before switching models, carry a short plan into a new session and keep file search and log inspection inside cheaper subagents—downgrading in place mid-session will not save you money.
