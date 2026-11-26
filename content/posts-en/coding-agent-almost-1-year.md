---
title: "One Year with AI: From Hands-Off Delegator to Steering the Ship"
summary: "Reflections from nearly a year of working with coding agents: from treating AI like an outsourced team and getting paged at 2 a.m., to building habits like talking before coding, step-by-step verification, and staying skeptical. An engineer's core value lies in design, judgment, and steering."
coverAlt: "One year with AI: from hands-off delegator to steering the ship"
sourceHash: "9c44e804bdee02fd"
---

One evening last December, a few friends and I got on a video call and started talking about AI coding. Xiao Chen excitedly told us he'd built an entire microservice in three days with Claude Code, sounding pleased that he'd "never have to write code by hand again." On the other side of the call, Xiao Li gave a wry smile: "I still only trust it to autocomplete a few lines. If I ask it to write a full function, reviewing it takes longer than writing it myself."

That conversation stuck with me for a long time. We were using the exact same tool, so why were our results so different? Eventually it clicked: the difference wasn't the tool. It was the person using it.

This isn't a "ten-step mastery" tutorial. It's just a collection of lessons I've picked up over nearly a year of bumping into walls, experimenting, and figuring out how to work alongside coding agents. Some of my early habits look pretty foolish in hindsight; others turned out to be surprisingly effective.

---

## Treat It Like a Collaborator, Not a Babysitter

When I first started using agents, I made a dumb mistake: I treated them like an outsourced dev shop.

Last September, an urgent task landed on my desk—adding a permissions module to our user system in three days. Perfect chance to test what AI could really do, I thought. So I wrote up a detailed spec, tossed it to Claude Code, and waited for it to "turn in the homework."

Two days later, it delivered—1,200 lines of code, cleanly structured and thoroughly commented. Thrilled, I skimmed through it and opened a PR. That very night after deploy, things broke: an edge case slipped through, and the permission check returned the wrong result under specific conditions. When the 2 a.m. alert woke me up, staring at a pile of code I didn't fully understand, it hit me: AI doesn't take the 3 a.m. on-call page.

That was the first time I truly understood that responsibility cannot be outsourced. No matter who writes the code, you're the one holding the bag.

Over time, my mental model shifted. Rather than an outsourced vendor, an agent is much closer to a new intern. It has strong execution speed, but zero knowledge of your business context, legacy baggage, or unwritten team conventions. You have to guide it, not dump work on it.

Once that clicked, my entire workflow changed. Instead of saying "write this code for me," it became "let's solve this problem together." It sounds like a subtle phrasing change, but the level of engagement is worlds apart.

---

## Stop Being Hands-Off

I've seen too many people—including my earlier self—use an agent like this: open the editor, paste the requirements, wait for the output, copy-paste, commit. Fast runs take a few minutes, slow ones take a dozen, all in one go.

That's not collaboration. That's being hands-off.

What does real collaboration look like? Let me share a few concrete moments.

When I refactored our user module last month, I spent an afternoon sketching out a rough architecture on a whiteboard before even opening the agent. I told it: "Here's the architecture I have in mind, but I'm unsure about a potential bottleneck here. How would you optimize it?" The agent proposed three options. We went back and forth for half an hour and settled on a middle ground. I learned more about data sharding that afternoon than I would have from two days of tutorials.

Another time, the agent implemented a caching module using the decorator pattern, which I wasn't very familiar with. Instead of accepting it blindly, I asked: "Why use a decorator here? Wouldn't a simple function wrapper work?" After going back and forth, I realized I was actually asking a deeper question: does this case call for a structural pattern or a behavioral one? That conversation sharpened my grasp of design patterns.

Another key part of collaborating is knowing when to hit the brakes. Agents sometimes get tunnel vision, obsessing over an unimportant detail. That's when you have to step in firmly: "Stop, wrong direction. Let's get back to the main track." You never build that instinct if you only delegate.

On habits: I now follow a "talk before coding" workflow. Instead of rushing for code, I treat it like pair programming with a colleague—aligning on boundaries, constraints, and possible approaches first. This upfront exploration looks slower on paper, but it prevents a lot of "generate, throw away, start over" loops later.

Another great habit is leaning on "Plan mode." Have the agent output an execution plan first, then challenge and refine it before a single line of code is written. Fixing a plan is orders of magnitude cheaper than rewriting code.

---

## Don't Let Code Become a Black Box

Last year I had a painful wake-up call: an agent wrote a complex reporting module for me, over 800 lines long. I watched its test cases pass smoothly and thought, "Looks solid." Three days after launch, a customer reported a bizarre bug: report numbers for certain time ranges were getting double-counted.

Staring at those 800 lines, I felt like a stranger in my own codebase. I understood what each individual line did, yet had no idea why their combination produced that bug. It felt like borrowing someone else's car, breaking down on the highway, and being afraid to even pop the hood.

After that, I made a rule for myself: before committing any code, run the "Feynman test"—pretend I have to explain what the code does to a completely non-technical friend. If I can't explain it clearly, I don't actually understand it.

Keeping a sense of ownership takes concrete engineering practices.

Start with PR size. Agents write code fast and in bulk, easily churning out thousands of lines in one shot. Huge PRs are a nightmare to review—reviewers get overwhelmed, skim the surface, and only nitpick formatting. Now I try to keep each PR under 600 lines. When a change simply can't be split, I attach a short design note—not a line-by-line spec, just a high-level summary of what changed and why. Funny enough, this habit forces me to clarify the design before writing code, which improves quality on its own.

There's also a seemingly paradoxical trick that works well: use AI to write the code, then use AI to review it. The prompts for those two phases have completely different goals. When writing, the agent is in "generation" mode; when reviewing, I tell it to act as a nitpicky reviewer hunting for logic flaws, edge cases, security risks, and over-engineered designs. This upfront self-check catches a lot of basic mistakes. To be fair, it has limits—AI still struggles to spot issues that depend on subtle business context.

Test coverage is another non-negotiable. Shipping AI-generated code without tests is flying blind. Code review won't catch bugs that only surface at runtime. Now I explicitly ask the agent to write tests alongside every feature, creating a tight "verify → fix → verify" loop. Just last week, an agent wrote three unit tests for a function and all three passed—yet when I added a manual test case, I caught an edge case it had missed. A good reminder not to trust AI-written tests blindly.

I also noticed another quirk: agents love reinventing the wheel. Last year, one wrote an 80-line implementation for a simple date-formatting task. I shook my head—`dayjs` handles that in two lines. Now I remind myself to ask first: "Is there already a well-tested library for this?" That's a judgment call the agent won't make for you.

## Small Habits That Saved Me Detours

Beyond the big-picture mindset, here are a few practical habits I picked up the hard way.

First: verify in small steps. Never dump a complex task on an agent all at once. I learned that lesson when I asked an agent to build a full user registration flow in one shot, and it picked an insecure password-hashing algorithm that I didn't notice until much later. Now I break tasks down and verify each piece before moving on. When refactoring the user module last week, I split it into database migration, API updates, and frontend integration, validating each step independently. It feels a little slower, but I sleep better.

Second: stay skeptical. An agent gives you the "most statistically probable" answer, not necessarily the "best fit for your codebase." I make a habit of pushing back: "What are the downsides of this approach? Is there a simpler alternative? Will this hurt us if we need to extend it later?" Questions like these often surface trade-offs you wouldn't have spotted. Once, an agent suggested Redux for local state; I asked whether React Context would be lighter, and we ended up with something far simpler.

Third, and slightly counterintuitive: don't let the agent steer you off course. Its output is so fluent and persuasive that it's easy to drift along with its framing and forget your own initial judgment. Now I spend fifteen minutes thinking through the general direction myself before asking the agent anything. Having my own baseline makes me much better at spotting when its proposal is off.

Finally: stay curious. When an agent reaches for a library, pattern, or idiom you don't recognize, don't just gloss over it. Dig in: What's this pattern called? When is it appropriate? What are the trade-offs? Every follow-up question becomes a real learning moment. I picked up at least five design patterns that way last year, and they stuck far better than watching tutorials.

---

## When AI Writes the Code, What's Left for Us?

Lately I've been thinking about a question: as agents take over more and more of the actual coding, what value do we engineers still bring?

After chewing on it for a while, I think it comes down to three words: **design, judgment, and steering**.

Agents excel at concrete implementation within clear boundaries. Give them a function signature and a requirement, and they'll produce clean code. What they're bad at is answering questions like: "What architecture fits this system?" "Which of these two approaches serves the project's long-term health?" "Will this design buckle if traffic grows 10x?"

Those questions demand deep domain understanding, familiarity with project history, and sensitivity to non-functional requirements—security, maintainability, concurrency safety, and scalability. Left to its defaults, an agent easily overlooks all of them.

Interestingly, the AI era has made some "old-school" habits more valuable than ever. Reading official docs, for example. Agents have knowledge cutoffs and still hallucinate. Last year I wanted to learn GraphQL properly and asked an agent to walk me through it. It sounded completely convincing, yet something felt off. I eventually sat down and read the official documentation cover to cover, and realized the agent had skipped several critical details. That grounded confidence from slowing down to read the source is something AI can't give you.

Studying design patterns and system architecture matters too. Not so you can slap "architect" on your title, but because having those mental models makes collaborating with an agent vastly smoother. You can articulate the structure you want and judge whether the agent's proposal makes sense. Last month, when designing a message queue module, having the pub-sub pattern clearly in mind made our back-and-forth way more productive.

One more thing only recently clicked for me: doing the right thing matters far more than doing things fast. An agent can sprint at full speed down the wrong road—ask it to optimize a feature that shouldn't exist, and it will polish it to perfection. When the direction is wrong, speed just takes you further from the goal. In the age of AI, asking "what is the real problem we're trying to solve?" has ten times the leverage it used to.

To be honest, I still haven't figured all of this out. Seeing an agent effortlessly write code that would have taken me half a day still makes me wonder sometimes: will my skills become obsolete? Then I remember: as tools improve, our roles evolve with them. When cars replaced horse carriages, coachmen disappeared—but drivers, mechanics, and automotive designers emerged.

---

Writing all this brings back a memory from early last year, when I was obsessed with finding the "perfect workflow" for working with agents. Now I know there's no such thing—only a collaboration style you keep adjusting as you go.

Working with a coding agent is a lot like learning to ride a bike. At first you wobble and worry about falling; then you find your balance; eventually you can ride one-handed. No matter how comfortable you get, though, you still have to watch the road—there's always a pothole waiting somewhere ahead.

If there's one thing I want to leave you with, it's this: don't shrink into a "requirement forwarder." How deeply you engage with the code determines how much you actually get out of this workflow. **An agent is a tool that extends your reach, not a system that replaces your judgment.**

These are just my personal notes from the past year—definitely incomplete, and maybe not a fit for every team. If you've found better ways to work with coding agents, I'd love to hear them. At the end of the day, we're all still figuring out how to wield this new tool, and comparing notes helps us all move a little faster.

![Illustration 02](/posts/images/coding-agent-almost-1-year/illustration-02.png)
