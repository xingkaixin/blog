---
title: "Code Mode: Why Coding Agents Are Letting Models Write Code to Call Tools"
summary: "Code Mode lets coding agents put tool dependencies, error handling, and filtering into scripts, avoiding intermediate JSON overhead. Comparing Codex, Pi, OpenCode, and Claude Code, this post examines host boundaries with Bash, API stability, and the cost of non-rollback writes."
coverAlt: "Code Mode: Why Coding Agents Are Letting Models Write Code to Call Tools"
sourceHash: "3ca38a24817664e4"
---

[Armin Ronacher's October 6 post](https://lucumr.pocoo.org/2026/10/6/codemode/) includes a real Pi session snippet where the task is to find Sentry organizations first and then list the projects under each one. With standard tool calling, the entire organization list comes back into the conversation context first; the model reads each organization's `slug` and `regionUrl`, then issues the next round of requests.

This session puts both steps into a single JavaScript snippet, reading values directly from each organization object to call the projects endpoint:

```js
await tools.mcp__sentry__find_projects({
  organizationSlug: org.slug,
  regionUrl: org.regionUrl,
})
```

Around that call, `Promise.allSettled` waits for every organization lookup to finish. When a request is rejected or a tool returns `isError`, the script records an error for that organization; on success, it returns only the organization identifier and project slugs to the model, keeping all project details inside the script.

Standard JSON tool calls can already [run in parallel](https://platform.claude.com/docs/en/agents-and-tools/tool-use/parallel-tool-use). What Code Mode adds is encoding the dependency between finding organizations and querying projects—along with local error handling and field filtering—directly in code. The underlying requests and rate limits still happen, but execution doesn't have to pause after every step for the model to decide what comes next.

Beyond large intermediate payloads, tool definitions and return text also eat into the context window. Early Pi didn't support MCP; in its late-September post ["You Said No MCP!"](https://earendil.com/posts/you-said-no-mcp/), the team noted that many MCP servers are designed to be called directly by the model, returning verbose text blocks that the host and model then have to parse separately.

Making tool definitions queryable on demand also cuts initial overhead. [The MCP server Cloudflare released in February](https://blog.cloudflare.com/code-mode-mcp/) exposes only two entry points, `search` and `execute`, letting the model write JS to inspect OpenAPI specs. Cloudflare's post reports roughly 1,000 tokens for the entry-point descriptions versus 1.17 million tokens when expanded in full. Those numbers haven't been independently reproduced and only compare initial schema descriptions rather than total usage across a full task; standard tool calling can use lazy loading too.

Having models generate executable code to call tools was explored in the 2024 [CodeAct paper](https://arxiv.org/abs/2402.01030). In September 2025, the [Cloudflare blog](https://blog.cloudflare.com/code-mode/) coined the term "Code Mode," and two months later [Anthropic](https://www.anthropic.com/research/code-execution-with-mcp) published on using code execution to call MCP. In 2026, four major coding agents followed suit. Codex shipped an experimental `code_mode` in March's [0.114.0](https://github.com/openai/codex/releases/tag/rust-v0.114.0) release, and it was still marked under development in the [0.163.0 source](https://github.com/openai/codex/blob/83086188ae0614bd882818ff1aa23f3194962012/codex-rs/features/src/lib.rs#L1160). Pi added Codemode in late September with [0.99.0](https://github.com/earendil-works/pi/blob/1402973a9dbe8c627341e04c9744c54953e285ca/packages/coding-agent/CHANGELOG.md#L391), OpenCode highlighted it as a key change in October's [2.0](https://anoma.ly/notes/opencode-2-0/) release, and Claude Code added experimental [Code Mode](https://code.claude.com/docs/en/code-mode) in [v2.1.323](https://github.com/anthropics/claude-code/releases/tag/v2.1.323) on November 12 (UTC).

Claude Code disables the feature by default; it must be enabled in an interactive terminal session via `CLAUDE_CODE_EXPERIMENTAL_CODE_MODE=1` (the variable is ignored if set in project configuration). It runs model-written JS through a `REPL` tool. In the official example, a single script searches files, calls `edit` to modify them, and runs tests, returning only file paths and test output. By default, the conversation UI only shows tool results such as `edit` diffs; pressing `Ctrl+O` expands the `Code` row to reveal the source.

Wrapping MCP servers as CLIs for Bash is another approach—[mcporter](https://github.com/openclaw/mcporter), for example, lets agents call services from the shell. However, a CLI's `--help` text only shows usage to the model; it doesn't automatically become a tool definition the host can validate.

The more critical difference is the execution environment. Armin draws a clear line between the host and Bash. Bash may run in a project workspace, a Docker container, or a remote machine, while the channels for passing images to the model or dispatching subagents belong to the host. Running `cat` on an image inside a container won't put that image into the model's input, and Python inside a container needs extra plumbing—like environment variables and a Unix socket—just to call a Sentry tool registered on the host.

Credentials and permissions can stay on the host side too. When queries are wrapped as tools, the script only passes arguments and the host uses its keys to make the request, keeping secrets out of the project container. Pi runs scripts inside QuickJS compiled to WASM without direct filesystem or network access, and every `tools.xxx()` call still goes through the host's [argument validation, hooks, and permission checks](https://github.com/earendil-works/pi/blob/1402973a9dbe8c627341e04c9744c54953e285ca/packages/coding-agent/src/extensions/codemode/tool.ts). Of course, if the host exposes write tools, the script can still perform writes.

Claude Code's script calls also pass through host `deny`/`ask` rules and `PreToolUse` hooks (which can match `REPL` and read `tool_input.code`). In `auto` mode, however, the classifier only reviews the source before execution and cannot see paths assembled at runtime from search results. If new code starts before the previous snippet finishes, the earlier one loses classifier review and triggers a countdown confirmation prompt—so hard constraints still depend on rules, hooks, or a sandbox.

![Code Mode orchestrates host tools while Bash operates on project files](/posts/images/agent-codemode-tools/agent-codemode-tools-01.png)

The diagram shows the split between host tools and the project terminal; Bash itself can also be exposed as a host tool for Code Mode to call. Among the three agents with public implementation details—Codex, Pi, and OpenCode—each uses a different execution engine. Codex runs source passed to [`exec`](https://github.com/openai/codex/blob/83086188ae0614bd882818ff1aa23f3194962012/codex-rs/code-mode-protocol/src/description.rs) in a V8 isolate inside a separate process and selects output text via `text()`. Pi runs [QuickJS compiled to WASM](https://github.com/earendil-works/pi/blob/1402973a9dbe8c627341e04c9744c54953e285ca/packages/coding-agent/docs/codemode.md). OpenCode parses code with Acorn and runs a [custom JavaScript-subset interpreter](https://github.com/anomalyco/opencode/blob/ba06ff9e0bf2dcefbbbc3a1d6094f3572d77c84e/packages/codemode/src/interpreter/execute.ts).

State persistence across multiple script calls also differs across Codex, Pi, and OpenCode. Both Codex and Pi provide explicit `store/load` APIs for serializable values: Pi writes storage from successful scripts into the session log to support resuming, while Codex only guarantees persistence for the current session runtime. OpenCode creates a fresh interpreter state on every run and had no built-in `store/load` in the version checked. Because I haven't run side-by-side benchmarks on the same task, I can't rank their speed based on V8, QuickJS, or a subset interpreter alone.

Claude Code's documentation doesn't disclose the `REPL`'s underlying JS engine or any cross-call `store/load` API, focusing instead on session and timeout limits: up to 10 minutes in the foreground (including permission prompts), or up to 2 hours in the background under `auto` or `bypassPermissions` mode, and any session that used Code Mode can only be resumed with `--resume` or `--continue` in a terminal where Code Mode remains enabled.

Once orchestration moves into scripts, tool API stability matters even more. Armin pointed out a pattern that easily breaks scripts: a tool returns one shape for small queries and switches to another at maximum batch size to save tokens. A script works when the model tests a few items, then crashes on field access when scaled up. When scripts read data by field, tools must keep their return structure consistent instead of forcing callers to guess whether they're getting text or an object.

Nested calls are also brittle right now. Armin shared an example of an outer Code Mode calling an inner Code Mode: strings pick up an extra layer of escaping (when debugging doubly escaped JSON/JSONL tool logs, I usually drop them into [Unquote](https://unquote.xingkaixin.me/agent-log-viewer/) to unwrap), and the inner layer can't reach the outer host's tools. Likewise, code running inside Cloudflare's MCP server can only access the APIs it exposes, not the outer host's Bash or image tools.

**When adding Code Mode to an agent, start with read-only queries and keep write operations in a step-by-step confirmation flow.** Export a few local sessions with [Agent Dump](https://agent-dump.xingkaixin.me), pick queries from your call logs that return large payloads when only a few fields are needed, filter them in a script, and track both the raw response size and the fields returned to the model to see how much intermediate data you actually save.

Mid-flight failures during writes carry a very different cost. If a script fires three writes in a row and the first two succeed before the third errors out, the completed writes won't roll back automatically just because the script aborted—you still have to check what already went through before retrying.
