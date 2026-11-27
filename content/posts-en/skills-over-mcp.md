---
title: "Skills Over MCP Is Useful, But Don't Rush to Move Your SKILL.md"
summary: "Skills Over MCP keeps usage instructions in sync with remote services, but on-demand loading already exists and auto-updates still require trust checks. Here is which skills belong over the wire and which should stay in your repo."
coverAlt: "The remote service has updated while the local Skill stays on an old version"
sourceHash: "b0c37d7dec6c871e"
---

Last month I wired up a third-party scraping service to my Agent and copied its usage instructions into a local `SKILL.md`: how to split batch jobs, how long to wait after errors, and where to fetch results.

Two weeks later, the service changed its rate-limiting policy and recommended scraping flow, while my local file stayed stuck on the old rules from the first time it worked.

The Agent could still call the API, but it kept stumbling through the outdated workflow. The main gap Skills Over MCP addresses is this drift between a tool that has updated and instructions that have stayed behind.

After reading the draft proposal and working group notes, my take is that it has real value, though its sweet spot is much narrower than the hype suggests.

## One Less Doc Drifting Behind the Service

The core idea of Skills Over MCP is that connecting to an external service lets you pull its companion skills alongside it. The provider maintains and publishes both the tools and the operating rules, so developers do not have to hunt down repos and copy-paste instructions by hand.

Tool descriptions only cover single calls; cross-tool selection criteria, call ordering, and verification steps go into the companion Skill.

Static config files cannot sense changes on a remote server. Git or package managers can handle updates, of course, but they require maintaining a separate distribution pipeline. MCP's engineering value here is reusing the existing connection to bind API and instruction versions together.

Still, that is only a distribution convenience. Whether the instructions actually match the tool version still depends entirely on the provider's engineering discipline.

## On-Demand Loading Does Not Need a New Protocol

Many discussions treat "on-demand loading" as a unique selling point of the MCP extension.

Shoving hundreds of lines of workflow into the system prompt does eat up context. But routing on names and short descriptions first, then loading the body and attachments only on a match, is a [progressive disclosure mechanism](/en/posts/skill-is-a-folder/) that already works in standard local Skill specs.

Even without a new protocol, as long as the host gives the model a basic read tool, the model can pull in the full body whenever needed.

What a standard protocol saves is the cost of every client building custom adapters. The real win of the extension is letting the host manage these skills uniformly: showing their source clearly, unifying permission approvals, and filtering disabled items.

That is a standardized product feature, not a leap in model reasoning.

## It Saves the Update Step, Not the Trust Decision

A remote skill is fundamentally a piece of third-party text with explicit operational intent.

It might guide the Agent to paginate properly, or it might tell the Agent to read local secrets, run a shell script, and exfiltrate data. Calling it a Skill does not automatically make those instructions legitimate.

A SHA-256 digest only proves the received file matches the manifest. A malicious provider can easily write malicious instructions and attach a valid digest, and the hash check will still pass completely green.

The draft sets clear security boundaries: before a remote skill triggers local code execution, it must receive item-by-item approval; and once the remote file's hash changes, prior approvals are immediately invalidated and the user must re-confirm.

This means "silent, fully automatic updates" cannot exist under the security spec. If the host enforces strict checks, every dependency update interrupts the workflow; if it loosens them, remote text injection punches straight through the local sandbox.

![After the remote Skill hash changes, the previous approval is invalidated and awaits re-approval](/posts/images/skills-over-mcp/skills-over-mcp-01.png)

## Which Skills Actually Belong Over the Wire

The best candidates for migration are third-party SaaS services whose APIs and policies change continuously—think scraping services, cloud provider APIs, or GitHub toolchains. Here, tools and best practices come from the same vendor, API updates and limit changes move in lockstep, and the vendor has every incentive to maintain them together.

Complex internal enterprise workflows also benefit: the server can serve dynamic flows based on an employee's login credentials, so sales sees sales playbooks and legal gets compliance checklists.

For most other cases, local files remain the better choice:
- **Personal static skills and writing templates**: These have no external sync needs and are safest inside a local repo (I sync mine across repos with [Agent Skills](https://skills.xingkaixin.me));
- **Team code style and architecture conventions**: The code repository itself is the single source of truth; spinning up a separate MCP service only adds a single point of failure;
- **Strictly ordered operation chains**: If the call order takes two or three sentences to explain, put it straight into the tool definition; if it is deterministic logic that must be followed strictly, write it into the host code instead of leaving it to the model to improvise.

**Skills Over MCP is fundamentally a distribution and version-coordination protocol; do not expect it to raise an Agent's reasoning ceiling out of thin air.**

Before tearing down your local directories to refactor, check your codebase first and find a `SKILL.md` that actually sent a task off the rails because it fell behind a remote service. If you cannot find one, leave it where it is.
