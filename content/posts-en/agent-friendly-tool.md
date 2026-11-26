---
title: "Building CLIs for Agents: Your Casual Error Message Is Its Next Instruction"
summary: "When building CLIs for agents, errors are an interface, not logs. After dissecting 350k lines of Feishu's lark-cli, one rule stands out: every error message you write will be parsed by AI to decide its next move. Here are four copy-ready patterns: typed errors, stdout/stderr separation, _notice prompts, and lint guardrails."
coverAlt: "Building CLIs for Agents: Your Casual Error Message Is Its Next Instruction"
sourceHash: "a937fa0a4afccb78"
---

Reviewing an agent's session replay, I saw a CLI I wrote spit out: `Error: request failed`. The agent then retried the exact same command three times, got the same line back every time, and eventually started inventing flags that don't exist.

I couldn't blame it. I wrote that error off the cuff for humans. A human seeing "request failed" checks the network, inspects config, or reads the docs. An agent has none of those out-of-band channels; its entire world is the few lines of text you print. If those lines don't say what to do next, it can only guess.

A few days ago, I went through the source code of Feishu's official lark-cli. Across 350,000 lines of Go, its AGENTS.md states the premise right at the top: the primary consumer of this CLI is an AI agent, and your code is read by machines. The entire repo asks contributors to internalize a single rule: **every error message you write will be parsed by AI to decide its next action.**

Nearly the whole architecture follows from that one sentence. Comparing it side by side, my CLI was broken in a very systematic way.

## Errors Are Not Logs, They Are an Interface

Errors in lark-cli are structured: every error carries four fields—`type`, `subtype`, `param`, and `hint`. When parameter validation fails, `param` names the exact flag. When a precondition isn't met, `hint` spells out what to do first. The question an error answers shifts from "what went wrong" to "what to do next."

How far do they take this? The repo has an `ERROR_CONTRACT.md` written like an API spec: how errors are categorized, which constructor to use in each scenario, and a rule that lower-level typed errors must pass through untouched without wrapping. A bare `fmt.Errorf` in the command layer won't even pass lint. In this codebase, errors are first-class citizens, treated on par with function signatures.

Once it clicks, the logic is simple: humans tolerate vague errors because they have other ways to figure things out; an agent's next step is determined entirely by that line of text. The information density of your error directly decides whether it recovers or guesses blindly. And every wrong guess burns your tokens.

![Difference in agent behavior between bare errors and structured errors](/posts/images/agent-friendly-tool/agent-friendly-tool-01.png)

## stdout Is Data, stderr Is Everything Else

lark-cli's second rule of discipline: JSON data goes to stdout; progress, warnings, and hints always go to stderr.

My CLI made the classic mistake: it printed a "Fetching data..." progress message to stdout. In a human terminal, that looks fine. When an agent pipes the output, a line of Chinese sits in front of the JSON and breaks parsing immediately. For humans, mixed output is an aesthetic issue; for an agent, it's a functional failure.

There is a second half to this rule: every field that enters stdout enters the agent's context. Irrelevant fields don't just take up space—they dilute the agent's attention and derail downstream reasoning. That's why lark-cli builds in `--jq`, trimming data before it ever reaches the LLM. Output for an agent should be just enough, not as exhaustive as possible.

![Dual-channel separation between stdout and stderr](/posts/images/agent-friendly-tool/agent-friendly-tool-02.png)

## Tools Can Talk Back to the Agent

The most interesting piece is the `_notice` mechanism. When a new CLI version is out, or local skill files drift from the binary version, lark-cli doesn't print a human-readable reminder to stderr. Instead, it embeds `_notice.update` and `_notice.skills` fields right inside the JSON envelope, where the agent is guaranteed to read them. When the agent sees it, it runs `lark-cli update` on its own.

This flips the direction of control: the tool doesn't just passively receive commands—it hands the maintenance action right to the agent. Humans ignore upgrade prompts; agents won't, as long as you put the prompt in their field of view.

Documentation follows the same idea. lark-cli uses `go:embed` to compile manuals for 26 skill domains straight into the binary, ensuring the docs the agent reads match the exact tool version it is running. When docs for humans sit on a website and go stale, humans just frown. When docs for an agent go stale, it earnestly invokes old syntax—and you're right back in section one, watching it guess against your errors.

![The _notice mechanism: tools hand maintenance actions directly to the agent](/posts/images/agent-friendly-tool/agent-friendly-tool-03.png)

## Conventions Rely on Guardrails, Not Self-Discipline

What really won me over wasn't these designs, but how they are enforced: everything is baked into lint rules.

`forbidigo` bans a whole set of calls via regex: `fmt.Print*` must be replaced by the framework's output channel so nothing bypasses `--jq` and pollutes stdout; `fmt.Errorf` as a final error triggers a lint failure and must use a typed error; the business layer forbids raw HTTP calls and direct `os.*` access. Putting "every error will be parsed by AI" in a doc means nobody remembers it consistently; putting it in lint means nobody can bypass it.

My CLI doesn't have 350,000 lines, but this layer is the most worth copying. For a solo-maintained tool with no second pair of eyes doing code review, guardrails are that second pair of eyes. Whatever convention can be enforced by tooling shouldn't rely on self-discipline.

---

When building CLIs for humans, the interface is the UI and errors are the fallback. When building tools for agents—CLIs, SDKs, internal scripts they invoke—it's the exact opposite: **every line you output becomes part of their prompt.**

I went back and rewrote that `request failed` message with three things: the error type, the offending parameter, and the next-step suggestion. Checking the replay again, the agent got the parameters right on its very first retry. The tool didn't get smarter; I just finally spoke clearly.
