---
title: "DeepSeek Harness: What I Actually Want to Steal Isn't Its Plugin System"
summary: "DeepSeek Harness turns even the main loop into a plugin, but the rule I'd rather copy is \"anything the model sees gets logged.\" This post traces its design trade-offs through its dev notes and looks at how far it is from being a daily driver."
coverAlt: "DeepSeek Harness: What I Actually Want to Steal Isn't Its Plugin System"
sourceHash: "939bcc64a84805c6"
---

I spun up `npx @deepseek-ai/dsh web`, opened Plugins under Settings, and saw 133 plugins listed on the page. Bash, session, agent loop, sandbox, subagent, Web UI—all hanging off the same tree. My first reaction was blunt: this is way too heavy.

Then I dug into `.agents/notes`. I only meant to check how Presets are assembled, but in `2026-08-03-per-session-agent-presets.md` I ran into a memory test: one Standard Agent takes roughly 1.31MB resident, 50 of them take 57.8MB, and almost all of it is reclaimed after `dispose`. The objects are collectible; the Host just never calls `dispose` on idle agents.

A Preset design note that traces all the way down to GC and ownership tells you far more about what a project is doing than "133 plugins" ever could. The repo requires an Agent Note for every non-trivial change, so I read backward through those notes.

Note: This post is based on the codebase as of August 13, 2026 and hands-on testing with `0.1.0-rc.6`. The project is still a developer preview.

## The Harness Decides How the Model Works

A model API takes messages and returns text or tool calls. The harness decides what context goes into each turn, how tools run, how results are written back, whether failures are retried, and how state recovers after the process exits.

[Put the same model inside different harnesses, and its behavior can diverge sharply](/en/posts/agent-harness-not-model/). I look for three answers first: can we trace what the model saw, where do tools and permissions land, and who cleans up when a task ends.

Entering an API key and picking a workspace all work as expected. The gaps only show up on long-running sessions: whether a session can resume, whether cancellation stops cleanly, and what is left behind after a plugin unmounts.

![The harness connects context, tools, logs, and recovery into a closed loop](/posts/images/deepseek-harness-133-plugins/deepseek-harness-133-plugins-01.png)

## DeepSeek's Answer Is Heavy, and It Does Bring Something New

DeepSeek Harness is built on Cordis. Model adapters, tool registries, session persistence, the agent loop, and the Web UI are all plugins. The authors call this "no privileged kernel"—even the lone default loop can be swapped out.

Each capability is further split into Service Definition, Provider, and Consumer. The `bash` tool the model sees stays the same, while the executor behind it can be swapped between local, sandboxed, or remote. When multiple implementations coexist, this split works well. At its current package granularity, though, I wouldn't copy it into a small product—understanding the whole dependency graph is too expensive.

![The same bash capability can swap between local, sandboxed, or remote executors](/posts/images/deepseek-harness-133-plugins/deepseek-harness-133-plugins-02.png)

The rule I actually want to copy is a different one: everything the model sees must be reconstructible from the Session log. Request headers, tool calls, results, and interrupted steps all go into an append-only log, and the next turn's messages are derived from that log. Replay, debugging, and recovery share a single source of truth. As for what else the log needs to persist so execution can resume after a process exits, I covered that in [Logs and Agent Execution Recovery](/en/posts/log-lock-in/).

![Model-visible events flow into the same Session log](/posts/images/deepseek-harness-133-plugins/deepseek-harness-133-plugins-03.png)

`cordis_inspect`, `cordis_mount`, and `cordis_unmount` let an agent inspect the runtime, mount plugins on the fly, and cleanly unmount them. They are off by default, carry permissions close to Bash, and do not persist across restarts. I'd keep them strictly in dev mode.

## How These Designs Grew

The earliest direction is recorded in `2026-06-11-event-sourced-sessions.md` and `2026-06-11-microkernel-event-taxonomy.md` from the same day: first make the Session the single source of truth, then let extensions hook in through Cordis events. The three-role capability split came two days later.

I love reading the `rejected` directory. `2026-06-20-drop-durable-step-boundaries.md` proposed removing step start/end events, and `2026-06-20-truncate-interrupted-turns.md` proposed discarding unfinished turns after a crash. Both were rejected because replay would lose evidence of whether a request finished and whether the last stretch of tool work actually happened. That tells you more about the team's obsession with logging than any architecture diagram.

In July they added sandboxing, MCP, self-modification tools, and persistent PTYs, yet `2026-07-24-agent-loop-observable-state-machine.md` stripped out a batch of loop events. Too many callbacks force plugins to understand the entire control flow. In the end they kept only extension points with clear responsibilities, while turns and steps still defer to the log.

In August they started touching the product layer. Profiles compose the Bundles inside a process, while Presets define the tools and prompts for a single Session. Then came standing mounts, host planes, subagent inheritance, and other course corrections. `2026-08-11-preset-authoring-agent-validates-its-own-composition.md` documented four mistakes in the guide and changed validation from reading YAML to actually mounting the composition.

![Development progressed from log truth and extension boundaries to Presets](/posts/images/deepseek-harness-133-plugins/deepseek-harness-133-plugins-04.png)

Those notes lowered my estimate of the product's maturity. Ownership of composition is still shifting, and the team just deleted the TUI, pulled the Web YAML editor, and redid onboarding. The repo's pre-release principle is candid: get the foundation right first, and don't carry compatibility baggage yet.

## Pi, Codex, and My Choice

Pi also extends through plugins. It ships with just four tools by default, and Extensions can replace tools, model Providers, context compaction, and TUI components. DeepSeek Harness uses `pi-ai`, then wires dependency injection, service lifecycles, and the agent loop into Cordis. The difference is which layer plugins are responsible for.

Codex also offers plugins, Skills, MCP, and Hooks, while the core `run_turn` stays in Rust. It has to keep behavior consistent across CLI, IDE, desktop, and cloud, so plugin boundaries are narrower and the product surface has already converged.

If I were picking a daily tool today, I wouldn't migrate off Codex. The Web Host still doesn't reclaim idle agents, and Presets just went through a string of revisions. The sandbox only explicitly guarantees file-level effects; network and process visibility are out of scope.

If I were building my own harness, I'd take "anything the model sees gets logged" and "Presets must be validated by real mounting." Self-modification tools stay in dev mode, and Cordis-style splitting waits until a second Provider actually shows up.

![Users pick a Preset while Cordis composition details stay internal to the machine](/posts/images/deepseek-harness-133-plugins/deepseek-harness-133-plugins-05.png)

**Only when users can just pick a Preset without having to understand Cordis will I treat it as a real daily driver.**
