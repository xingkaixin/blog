---
title: "Agents Rarely Delete Code When Fixing Bugs, Just Layering Defenses On Top"
summary: "Agent bug fixes, code review, and AGENTS.md: when a fix diff only adds null checks and try-catch blocks, or keeps both options A and B, it often legalizes invalid states and pushes decisions onto future maintainers. Write three lines of default rules before delegating, and check deleted lines first during review."
coverAlt: "Agents rarely delete code when fixing bugs, layering defenses on top"
sourceHash: "e2cca8f89bb6cb6c"
---

In an episode released in early October, Armin Ronacher and Mario Zechner were talking about Pi Durable. On coding agents, Armin said an agent will definitely solve the problem, but it is almost impossible for it to fix a bug without adding code. Someone chimed in with a laugh that Armin himself probably opens 200-file PRs all the time, and Armin owned up to it.

Here is a composite example based on a common pattern, not any single diff: a field is null, so it adds a null check with a default value right before reading it; a request throws an exception, so it wraps it in a try-catch that returns an empty list. The tests pass, and deleted lines are 0.

Except that field was never supposed to be null by design. Once that null check goes in, an invalid state becomes a valid one, and every downstream reader now has to handle null too.

A post on maxlv.net ran into the same thing when the author used Claude Code's Agent Team to port the 30,000-line Go project mihomo to Rust. The Engineer wanted to wrap the Axum router in `tower::catch_panic` to "improve robustness." Meanwhile, QA's test plan explicitly required that a panic inside a spawned tokio task must terminate the process so the soak test could catch the failure. Swallowing the panic hid the failure from the soak test.

Back in June, Armin wrote in *The Coming Loop* that current models write overly defensive code—reasoning only one step ahead, reaching for a fallback whenever they hit a bad state instead of designing it out of existence. He also quoted Karpathy: models are terrified of exceptions. Put them in an automated loop, and those defenses pile up round after round.

When tison was implementing T-Digest for ScopeDB, he hit a different variation. Almost all the edge-case handling for extreme values ended up being decided by him, for a blunt reason: "Ask an AI to choose between A or B, and it will pick A, B, and 'or'."

Whether to stay backward-compatible with old data isn't answered in the codebase. Agents rarely stop to ask, so they just keep both code paths.

Armin told an old story in State of Agentic Coding #5 back in April (the transcript didn't label the speaker, though from context it sounded like him). Around the Xbox One launch, he worked on *Halo: The Master Chief Collection*, where the matchmaking system had about 15 boolean flags. Lots of states that should never be true at the same time were true at the same time—like "LLM code before LLMs existed."

He said LLMs don't feel that pain. They won't come to you and say there are too many booleans and it's time for a state machine; they just keep writing. Their own codebase has code like that now, which slipped in during a few weeks when they weren't reviewing the agent's commits closely.

**An agent doesn't feel the code getting harder to change, and nobody told it which of the two paths to keep—so every fix just adds another layer on top.**

Network timeouts and unresponsive third-party services can't be eliminated with types and invariants—defend against those when you need to. My rule of thumb is whether the bad state came from our own code; if it did, fix it at the source.

Before delegating work, put tie-breaking rules in `AGENTS.md`. mihomo-rust wrote an ADR (Architecture Decision Record): divergences in security, privacy, or routing intent are hard errors that refuse to load the config; divergences in performance or compatibility emit a single warning and keep running; when in doubt, treat it as a hard error and flag it in the PR description. For an ordinary project, three lines are enough: whether backward compatibility is needed, which errors must fail loudly, and which way to default when unsure. In a post on parallel vibe coding, @leon7hao put it like this: "This app is unreleased—no backward compatibility needed, breaking changes are fine."

When reviewing the diff, check the deleted line count first.

![Defensive layers added without deleting code](/posts/images/agent-fix-only-adds-code/agent-fix-only-adds-code-01.png)

If deleted lines are 0, or you see a new null check, `fallback`, or broad `catch`, ask two follow-up questions: "Where was this state produced? And which decision did this just dodge for me?"

DHH mentioned on Lex Fridman's podcast that an agent will say it's done, another agent will review it and say it's done, and then he'll add "this looks a bit too complex"—at which point the agent immediately admits it overcomplicated things and cuts the implementation in half. He asked why it couldn't just write it that way from the start. Someone reminded him that humans are the same. The only difference is that humans get annoyed with themselves halfway through, while agents don't—so before merging, a human has to be the one to say "this looks a bit too complex."
