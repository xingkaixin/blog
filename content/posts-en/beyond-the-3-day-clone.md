---
title: "When an Open-Source Idea Can Be Cloned in Three Days"
summary: "Coding Agents have made \"rewriting an open-source project in Rust in three days\" a reality. As three years of an author's hard-won cognitive assets get consumed overnight, the reward structure of open source is collapsing—and the incentive to create original work is quietly withering."
coverAlt: "When an open-source idea can be cloned in three days"
sourceHash: "b1a435c95249dcf9"
---

About a month ago, I stumbled across a pretty interesting CLI tool on GitHub. I don't remember the exact name—something like `xx-tool`. The author wrote it in Python to solve a niche but real pain point, something around converting data formats.

The README was remarkably earnest, and in the issues, the author talked through details patiently with users. You could feel that "I genuinely care about building this" attitude. It was genuinely refreshing.

Roughly two weeks later, I came across the project again. This time I noticed three or four "Rust rewrites" sitting right under "Similar projects."

My first reaction was confusion. Could it really happen that fast?

I clicked through them, and the pitch was nearly identical across the board: "10x faster," "20x faster," "half the memory usage." The feature set was practically the same, the API design barely differed, and even some of the phrasing in the READMEs looked familiar.

At first I thought: wow, rewriting a project is that fast now?

Then I started thinking: wait, isn't this just copying? Calling it outright copying didn't feel quite right either—they really did reimplement it from scratch in Rust. The code was new, not copy-pasted.

Still, I couldn't shake an uneasy feeling. Something felt off, even if I couldn't put my finger on it yet.

## Too Fast: The Rewrite Barrier Is Gone

Coding Agents have changed a lot of things, but what surprised me most is how effortless they have made "rewriting it in Rust."

Before, if you wanted to rewrite a project, you had to spend real time understanding its architecture and the design decisions buried in the code. That alone wasn't easy—you had to read the source, run the tests, and probably dig through issue and PR history.

Then you had to learn Rust (if you didn't already know it). That wasn't a weekend affair either; you needed time to get comfortable with the syntax, the ecosystem, and the toolchain. When I first started learning Rust, the borrow checker alone was plenty to deal with.

Only after all that came the actual rewrite: writing code, hitting edge cases, debugging, fixing bugs. The whole process took a few months at minimum, and often half a year or more. That time cost acted as a natural barrier. It forced a rewrite to be a deliberate decision—you had to truly believe it was worth doing.

Now that barrier seems to have vanished.

The workflow today looks something like this: fork the repo, feed the entire codebase to a Coding Agent, prompt it with "Rewrite this in Rust with matching functionality," wait for the tests to pass, and have it generate a README.

Three days. Literally three days.

**The problem isn't rewriting itself—it's that rewriting has become too easy.** Rust has real strengths: memory safety, its concurrency model, its type system. Yet look at the selling points of these rewrites—they're embarrassingly uniform, boiled down to a single word: "fast."

It's as if all the original project's design thinking, API trade-offs, and edge-case handling get stripped away, leaving nothing but benchmark numbers to brag about.

It reminds me of copying a Michelin-starred restaurant's recipes, opening a "fast-food version" in three days using pre-made meal kits, and advertising "my version serves faster." You took the recipes and the dish design; your only contribution was running them through a faster assembly line.

Is that progress? Technically, maybe—but something still feels wrong about it.

Eventually I realized the real issue is the disappearance of friction.

Before Coding Agents, "rewriting in Rust" carried a real cost. You had to understand every edge case the original project had accumulated, learn a new language and ecosystem, and invest months of engineering effort.

That cost functioned as implicit protection. It gave the original project a window of time to build its own moat—a community, documentation, a plugin ecosystem, and word-of-mouth adoption.

Tools and language projects evolve on their own, too. When the time is right, the original author will choose a faster language to rewrite their own work. That's a healthy, paced progression.

Coding Agents have compressed that friction to near zero. What used to take months now takes three days. Before the original project has a chance to build a moat, its replacements are already out there.

In the short term, removing that friction looks good for users—more choices, faster tools. In the long run, it risks hurting the entire ecosystem, because original creators lose their most important protection: a window of time.

## Cognitive Assets Are What Get Consumed

Someone might argue: isn't open source meant to be forked and improved? What's wrong with a rewrite?

The problem is that code can be rewritten, but the tacit knowledge behind it can't be replicated by a machine—it just gets harvested.

The value of an open-source project has never been just the pile of code. The real value lies in:

- The wrong turns the author explored (approaches that were tried and discarded)
- The pitfalls the author hit (bugs that only surface under specific conditions)
- What the author discovered users *actually* needed (what users ask for vs. what actually solves their problem)
- The API design intuition built over time (why a given parameter is shaped the way it is)
- The edge-case knowledge accumulated through issues and PRs

None of this is written directly in the code; it's the invisible body of knowledge behind it. A rewriter consumes all of that work without paying any of the cost to accumulate it.

It's a bit like cheating on an exam. You get someone else's answer key and score 100%, but you never went through the reasoning. You don't know why the answer is A instead of B, and you don't grasp the logic behind the question. The next time a variation shows up, you'll still get stuck.

**Or put it another way: the original author is the person who walked through the wilderness for three years to draw a map.** The rewriter is the person who takes that map and sprints straight down the trail. The map took three years to chart; the rewriter covers the same ground in three days.

Is that fair?

It's a setup where you stand on someone's shoulders without acknowledging them. The original author did the hardest part—finding the problem, designing the solution, proving it works—while the rewriter walks away with the payoff.

![The cost of cognitive assets: three years of exploration vs. three days of cloning](/posts/images/beyond-the-3-day-clone/beyond-the-3-day-clone-illustration-01.png)

## The Reward Structure Collapses

Why do we choose open source in the first place?

Reputation, community recognition, career opportunities, and a sense of belonging. All of those rewards rest on one assumption: your contributions will be remembered, and your impact will compound over time.

If open-sourcing something means your idea gets cloned in three days and replaced by a "10x faster" version, that incentive model breaks down.

Imagine spending three years building an open-source project. People are finally starting to use it, a community is forming, and you're finally beginning to feel like it was all worth it.

Then three days later, three Rust rewrites appear. Users start asking, "Why not just use the Rust version?" Your growth curve flattens overnight.

How would you react?

The rational choices start looking like:
- Keeping the core logic closed-source and only opening the interfaces
- Switching to stricter licenses (AGPL, BUSL)
- Not publishing at all, and keeping it internal

That isn't pettiness—it's the predictable outcome when the rules of the game change. You can see echoes of the same logic in how HashiCorp, Redis, and Elasticsearch changed their licenses. Back then, the catalyst was cloud providers; today, it's AI tools.

The difference is: you can negotiate with a cloud provider. You can't reason with a tool.

## How the Ecosystem Fractures

Open source won't disappear as a whole, but it may fracture into tiers.

At the bottom layer: tools will keep getting faster and more polished, turning into ownerless performance commodities. Nobody will truly own the edge cases or documentation, because there's no long-term sense of ownership or responsibility. When a rewriter's upfront investment is tiny, they have little incentive to maintain a "quick clone" over the long haul.

At the top layer: genuinely original ideas will show up in public communities less and less often. People with new ideas won't want to validate them in the open, because going public means exposure, and exposure means getting cloned immediately.

The result: stronger infrastructure, paired with original innovation struggling to grow in an open environment.

It's like a forest. Original creators plant the trees; rewriters show up to cut them down. In the short term, you get more lumber. In the long term, the forest turns into a wasteland—because nobody is planting anymore.

Or like a city where everyone is busy building fast-food joints, and nobody is building new libraries, schools, or parks. Convenient in the short run, soulless in the long run.

![Ecosystem fracture: a forest turning into a wasteland](/posts/images/beyond-the-3-day-clone/beyond-the-3-day-clone-illustration-02.png)

## Closing Thoughts

The health of the open-source community depends on the belief that sharing is rewarded. Coding Agents are systematically eroding that belief.

It's not that "open source will die." It's a quieter kind of decline: project counts keep climbing, GitHub stars keep going up, yet truly original ideas appear in public less and less. **The drive to innovate in the open is quietly withering.**

I don't know what the answer is. Maybe new open-source mechanisms will emerge, or maybe we'll gradually find a new equilibrium.

Still, I can't help wondering: if you spent three years building an open-source project, only to watch a "Rust rewrite" show up three days later, would you open-source your next one?
