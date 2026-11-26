---
title: "Why Stronger LLMs Make Code Review More Exhausting"
summary: "AI models keep leaping ahead on benchmarks and multimodal demos, but real software engineering never ends when the code runs. Starting from Armin Ronacher's long-running experiment, this post breaks down the handoff fatigue and hidden cognitive debt behind long-horizon model endurance. The real metric for a model upgrade is how long you spend cleaning up after it declares the job done."
coverAlt: "Why Stronger LLMs Make Code Review More Exhausting"
sourceHash: "8736ef751aafbebd"
---

35 hours, 79 commits, and nearly 75,000 net lines of code added.

Flask creator Armin Ronacher once shared the results of a long-horizon coding experiment: he gave a new-generation model high autonomy to add virtual threads and lexical scoping to the Python interpreter. After a marathon run, Armin finally hit abort. Tens of thousands of lines of churning code had produced not a single shippable change.

Few people doubt the leap in raw capability of newer models: longer reasoning chains, smoother system-level orchestration, and tireless endurance. Yet when those capabilities land in serious software engineering, the actual payoff often falls short.

This captures a real dilemma for heavy users: you can genuinely admire how impressive a new model has become, and still switch your main workflow right back to the older one.

In the past, the biggest headache was an Agent getting stuck after two steps and constantly needing human intervention. Now that models can run for much longer stretches, a new burden has quietly emerged: you have to spend a lot of time figuring out whether it is making real progress in deep water or running in circles down a dead end. Looking at a multi-hour runtime alone tells you nothing.

Serious engineering defines "shipped" much more strictly than passing unit tests. Changes have to fit naturally into the repository's existing design patterns, the logic has to be clear enough to explain to a reviewer, and the code cannot leave landmines for the next iteration. None of these implicit constraints show up on benchmarks or launch videos, yet they sit squarely in the path of every future maintenance task.

**A model's endurance for finishing a task on its own and the cost for a human to take over that output need to be counted separately.**

In vendor demos, models show off their ability to build 3D houses in Blender automatically: generating geometry through the Python API, setting up lighting, tuning materials, and refining details through a visual feedback loop.

For that kind of task, code is just temporary scaffolding for the visual result. What matters to the user is whether the scene looks right, the furniture placement makes sense, and the lighting feels natural. As long as the rendered house holds up, it barely matters if the generated Python script took three extra detours or carried some redundant logic.

Teams maintaining real production systems operate under a completely different set of rules. A seemingly simple change has to fit cleanly into years-old legacy code, respect unwritten business conventions, and be ready for a teammate to review and take over. Both scenarios ask the model to write code, but the acceptance criteria on the engineering scale could not be further apart.

![Two different acceptance targets](/posts/images/frontier-models-developer-fit/frontier-models-developer-fit-01.png)

As frontier models expand their general-purpose reach, "stronger" needs strict engineering qualifiers. Better image understanding, desktop control, and multimedia tool use are real breakthroughs—but none of that guarantees the model will be any easier to work with in the messy codebases developers deal with every day.

A software demo can easily end in applause the moment a feature runs. In real software engineering, maintenance and handoff are where the real work begins.

Say the model casually adds a few helper functions that look fine on their own. Did it just reinvent utilities that already exist? Did it quietly introduce an awkward private state or a non-standard error-handling pattern? The more of this "island code" piles up in a repository, the heavier the project's long-term cognitive load becomes.

Some might ask: if AI keeps getting stronger, why not just hand all future maintenance over to it too?

That idea ignores a practical cost: software doesn't just need to run on a normal day—it needs to be debugged fast when production breaks at 3 a.m. As long as human engineers are still accountable for business outcomes, the cost of code readability never disappears.

Even if you take a step back and hand maintenance entirely to an Agent, running, verifying, and repeatedly patching code still burns huge amounts of time and compute. Nobody reading every line does not mean nobody has to vouch that the system is doing the right thing.

So when evaluating a model upgrade, you cannot stop the clock the moment the Agent says "done." The time humans spend reviewing the code afterward, the effort spent tracking down side effects, and the changes you have to revert to undo over-engineering all belong on the real delivery ledger.

![Tracking total delivery time](/posts/images/frontier-models-developer-fit/frontier-models-developer-fit-02.png)

With new models arriving one after another, wanting to try them is natural—but there is no reason to swap out your main pipeline wholesale.

A safer litmus test is to take a real, well-scoped requirement your team recently shipped and replay it against the same baseline commit. Keep the context, tool permissions, and acceptance criteria identical, and pay close attention to how much extra prompt steering and code cleanup humans have to do for the new model. Looking only at the first generation misses mid-run loops; looking only at whether tests pass hides the friction along the way.

If a new model shines at exploring unfamiliar stacks or reading third-party docs, let it scout ahead. If it keeps producing bloated, hard-to-adopt code in routine core-business iterations, the older model is still the better tool. Upgrading tools does not have to be an all-or-nothing team mandate.

Developers can reject the hype with a simple yardstick: if shipping the same change takes me more time to review and take over, the new model is not a worthwhile upgrade.

Before you switch models next time, track how long you spend cleaning up after it says the job is done.
