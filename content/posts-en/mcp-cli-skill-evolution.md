---
title: "Tool Evolution: When MCP Meets CLI, a Quiet Revolution in Context"
summary: "The \"context explosion\" problem in MCP gave rise to a lighter Skill+CLI approach: instead of stuffing all tool definitions into the prompt, agents invoke CLI tools on demand. Community projects like OpenClaw are proving its value, and MCP and CLI will likely coexist in a hybrid model where each plays to its strengths."
coverAlt: "Tool Evolution: When MCP Meets CLI, a Quiet Revolution in Context"
sourceHash: "287ced7796752c80"
---

## 1. Where the Story Begins: November 2024

I first heard about MCP on an afternoon in late November 2024.

Anthropic had just open-sourced this thing called the "Model Context Protocol," and their ambition was big: they wanted to build a universal bridge between AI assistants and data systems. Put simply, they didn't want people writing piles of custom glue code every time they integrated a new tool.

When I first saw MCP, I genuinely thought the idea was clever. From then on, whether you were querying a database, calling an API, or touching the filesystem, you'd use one protocol instead of reinventing the wheel for every tool. How convenient.

Reality quickly taught me a lesson.

## 2. More Tools, More Confusion

Here is how MCP works at its core: each MCP server exposes its capability list (`tools/list`) to the host, including every tool's description, parameter schema, and so on. The host then stuffs all of that into the AI's system prompt so the model knows what it can do.

As I kept using it, something started to feel off.

With one or two MCP servers connected, everything felt snappy and tool calls were accurate. By the time I added a fifth or tenth server, things degraded—the AI assistant got slower, sometimes ignoring an obvious built-in tool or picking the wrong one altogether.

Later I realized this has a name: "context explosion."

Every MCP server's tool definitions consume tokens. In practice, a single tool definition averages 150–200 tokens, which means enabling 10 servers with 30 tools total can add 4,000–6,000 tokens of context overhead. I saw real numbers from a community member: 21 tools took up 3,500 tokens. Take another example: if one MCP server has 10 tools at roughly 200 tokens each, enabling 10 such servers adds 20,000 tokens to the context (10 servers × 10 tools × 200 tokens). Doesn't sound like much? In a multi-turn conversation, you carry that entire capability list along on every single turn, and the cost adds up fast.

Worse, even if a tool is completely irrelevant to the current task, its definition still sits in the context—like packing a suitcase full of clothes you'll never wear. By contrast, a CLI approach only needs a single generic "run command" instruction (around 200 tokens). Over a multi-turn conversation, that gap becomes obvious.

## 3. Enter Skill: Giving Toolkits a Wrapper

Around this time, the concept of a "Skill" started entering the picture.

What is a Skill, really? Simply put, it's a "tool for tools"—it doesn't provide capabilities directly, but instead teaches the AI when and how to use certain capabilities.

Skills have a neat design called "progressive loading." Normally, only the Skill's name and short summary live in the context; once the AI decides to use a particular Skill, the full instructions are loaded in. It's like walking out the door with just a shopping list and checking the details only when you're ready to buy something.

OpenAI's Codex and Anthropic's Claude Code both adopted Skills. Interestingly, the ecosystem quickly split into two distinct camps.

## 4. Two Paths Diverge: The MCP Camp vs. the CLI Camp

The first path is **skill+mcp**.

This approach plays by the book: MCP servers provide structured tool interfaces, and Skills orchestrate the workflow across them. Say you're deploying a service—the Skill tells the model, "Call tool A's create endpoint first, then tool B's config endpoint."

The upside is clear structure, safety, and explicit permission boundaries. The trade-off is just as obvious: you're still dealing with all those tool definitions, so the context overhead never really goes away.

The second path is **skill+cli**.

This path is wilder and much more down-to-earth. Instead of relying on MCP servers, it directly invokes command-line tools already sitting on the machine—`git`, `aws`, `kubectl`, `gh`, and the like.

One line from Claude Code's official docs stuck with me: prefer CLIs because they are more "context-friendly" than MCP servers.

Why? Because a CLI doesn't require stuffing huge blocks of tool definitions into the system prompt. You just tell the AI, "You can run commands via bash," and let it decide which commands and flags to use on the fly based on the situation.

Put simply: the MCP camp is like carrying a thick manual that spells out every feature in detail; the CLI camp is like carrying a sticky note that says, "Ask me if you need anything."

## 5. OpenClaw: The Community's Bet

In the CLI camp, OpenClaw is a textbook example.

It's an open-source project building a "self-hosted AI gateway." What I like about it is how it treats Skill management as an engineering problem.

OpenClaw splits Skills into three tiers: bundled, managed/local, and workspace. It also does something genuinely useful: it measures how much context each Skill consumes.

According to their docs, loading the Skill list injects a compact XML list into the system prompt, with a fixed character cost per Skill. It's like having an itemized bill for your context budget so you always know where you stand.

More importantly, while OpenClaw supports MCP, it treats it as an "optional tool-provider layer," leaving Skills and CLIs as the primary orchestration mechanism. That architectural choice alone says a lot about where the community is leaning.

## 6. Why Is skill+cli Catching On?

The rapid rise of skill+cli setups like OpenClaw comes down to a few key reasons:

**First, the inertia of the DevOps ecosystem.**

Engineers in the cloud-native era already live in the terminal. Tools like `kubectl`, `docker`, and `terraform` have been around for over a decade—well-documented, battle-tested, and stable. Wrap them in a Skill and an AI can use them right away. Why add an MCP wrapper on top? OpenClaw saw that clearly and leaned into calling these mature tools directly through the Skill layer, saving a ton of effort.

**Second, pressure from context costs.**

In practice, every MCP server's tool definitions enter the context even when the server sits idle. A CLI setup needs only a few generic execution instructions to unlock countless external tools. OpenClaw's built-in context cost accounting exists specifically so developers can see the exact token footprint of each Skill.

**Third, flexibility and controllability.**

CLI output is plain text, which an AI can read, analyze, and summarize directly. MCP output is structured JSON—clean and standardized, sure, but often requiring extra parsing steps. In plenty of scenarios, readability beats structure. OpenClaw pairs this with a sandboxed execution environment, keeping the flexibility of CLIs while using permission controls to keep security risks in check.

Of course, skill+cli has an Achilles' heel: security.

Running arbitrary commands carries more risk than calling structured APIs. That's why OpenClaw emphasizes running CLI commands inside a sandbox with strict permission controls.

Judging by OpenClaw's engineering practice, skill+cli isn't just viable on paper—it has proven its value in production by keeping context costs down while tapping into the existing tool ecosystem.

## 7. The Future of MCP: Evolution, Not Extinction

Even with skill+cli's advantages, I don't think MCP is going away. It's evolving too.

Looking at recent spec updates, the MCP community is actively responding to the "context explosion" criticism:

**On-demand loading**: Claude Code has introduced a tool search mechanism. Once tool definitions exceed a certain threshold, it switches to search mode and only loads descriptions for relevant tools.

**Asynchronous tasks**: The November 2025 spec introduced the concept of tasks, allowing long-running operations to run asynchronously and reducing the pressure of feeding everything back into context.

**Layered architecture**: Newer spec versions bring major upgrades across authorization, security, and transport—OAuth 2.1, scope upgrades, and SSE stream reconnection make MCP much better suited for production environments.

My prediction is that we'll land on a hybrid model:

- **CLIs handle frequent, lightweight, low-risk tasks**—like committing code, checking logs, or inspecting configs;
- **MCP handles scenarios that need authorization, structured interaction, or resource subscriptions**—like accessing enterprise SaaS, querying databases, or calling third-party APIs.

It's not an either-or choice. Each has its own job.

## 8. Closing Thoughts: An Ongoing Search for Better Connections

Looking back over the past year or so, MCP, Skills, and OpenClaw are all trying to answer the same question: **how do we connect AI to the outside world more effectively?**

MCP bets on protocol standardization, Skills bet on packaging knowledge, and OpenClaw approaches it from engineering practice. These approaches don't conflict—they're borrowing from and blending into one another.

As developers, we might want to let go of ideological debates over which camp wins and just pick the right tool for the job. Context is a finite resource; we should spend it wisely.

After all, the point of a tool isn't to show off—it's to make our lives a little bit easier.
