---
title: "Assuming X Comes True: Your Craft Is Being Repriced"
summary: "Assuming AI Agents can independently handle most implementation work within the next year or two, where do engineers go from here? Move upstream—from \"how to build\" to \"whether to build\"—and move deeper—from \"writing fast\" to \"judging accurately.\" Your X-resistance score is how much of this week's work relied on judgment AI cannot replace."
coverAlt: "Assuming X Comes True: Your Craft Is Being Repriced"
sourceHash: "65357e6c807702a0"
---

## 1. An Email from 2027

At 8:15 on a Monday morning, Zhang Yuan opened his work email.

His coffee was still hot. Sunlight from the window hit his monitor, and he tilted it out of habit. The first email was from HR, with a short subject line: **Organizational Restructuring Notice**.

He clicked it open. Three paragraphs.

The first paragraph said the company had deployed an Agent development system over the past six months that now handled 80% of routine backend service tasks. The second said that, after review, his infrastructure services team would shrink from 12 people to 3. The third thanked him for ten years of service and offered an N+3 severance package along with internal transfer interviews.

Zhang Yuan stared at the screen for a long time. It wasn't that he didn't see this day coming—last year, he had personally integrated Claude Code into the team's workflow and watched it compress three days of work into three hours. He just hadn't expected the bullet to turn back toward him.

He glanced over at the mechanical keyboard on his desk. It was an HHKB he bought during his first year at the company, its keycaps worn shiny from use. Ten years, twenty thousand commits, countless late-night debugging sessions. All distilled into a three-paragraph email.

---

**Don't close this tab just yet.**

The email above is fictional. Zhang Yuan doesn't exist. But I want you to answer one question honestly: when you read that second paragraph, did you feel a brief chill down your spine?

If you did, it means you already sense something beneath the surface.

This post is not a prophecy. I don't have a crystal ball, and I have no interest in selling panic. What I want to run is a thought experiment—putting a question on the table that many of us think about in private, yet rarely discuss head-on:

**Assuming AI Agents' coding ability reaches a tipping point within the next one to two years, capable of independently completing most "implementation" work—what will the word "engineer" still mean?**

I call this assumption "Assumption X."

---

## 2. Assumption X: Not Sci-Fi, an Approaching Reality

![Assumption X: Not Sci-Fi, an Approaching Reality](/posts/images/assuming-x-agentic-era-engineers-survival-coordinates/assuming-x-agentic-era-engineers-survival-coordinates-01.png)

Let's draw the boundary clearly first.

Assumption X has nothing to do with sci-fi. Its scope is concrete: **within the next 12 to 18 months, AI Agents will be able to independently handle most "implementation-layer" programming work**—writing CRUD, wiring APIs, fixing bugs, writing tests, running data migrations, and building basic frontend and backend pages. Not 100%, but enough to cover the majority of an average developer's day-to-day workload.

You might think that assumption is too aggressive. Then look at what the people building these tools are saying.

Boris Cherny, the Anthropic engineer leading Claude Code, said on a podcast that coding is basically "solved." Inside Anthropic and OpenAI, AI already writes 100% of engineers' code. Meanwhile, new-grad hiring across the 15 largest U.S. tech companies has dropped 55% over five years.

It is the gunmakers telling us how fast the bullets are flying.

I don't know when Assumption X will come true "completely." But **it won't flip on like a light switch. It's like a rising tide—before you notice, the water is already past your ankles.**

By the time you look down, the beach is gone.

---

## 3. The Old Map No Longer Works

![The Old Map No Longer Works](/posts/images/assuming-x-agentic-era-engineers-survival-coordinates/assuming-x-agentic-era-engineers-survival-coordinates-02.png)

If Assumption X comes true—even partially—you will run into an uncomfortable reality: **the coordinate system of skills you built your livelihood on is being repriced.**

Writing code fast, strong debugging instincts, deep mastery of a language or framework, familiarity with a specific tech stack—these made you indispensable on a team. Yet at their core, they all answer the same question: how to build something that has already been defined. And Assumption X says precisely this: AI is learning to answer that question, faster and cheaper every month.

Fifteen years ago, the best taxi drivers in Beijing relied on knowing the roads—which part of the Third Ring Road moved fastest, which hutong offered a shortcut. Then navigation apps arrived, and "knowing the roads" went overnight from a core advantage to a nice-to-have. Drivers didn't disappear, but the axis of competition changed.

Engineers are going through the same shift.

My own experience is concrete. Last year while building Fin-Agent, after switching to AI-assisted development, 200 lines of code came out in two minutes. Then I spent nearly 40 minutes reviewing it: checking edge cases, fixing logic, catching three bugs, adding two error handlers, and deleting an unnecessary conversion layer. In those 40 minutes, nothing I did was "writing code." It was all judgment.

The skill is still real, but its price tag is changing.

---

## 4. Two Directions

![A New Coordinate System](/posts/images/assuming-x-agentic-era-engineers-survival-coordinates/assuming-x-agentic-era-engineers-survival-coordinates-03.png)

An obsolete map doesn't mean there are no roads left. Over the past few months, I've been watching—and living through—this shift firsthand. Broadly, I see two directions.

### Moving Upstream: From "How to Build" to "Whether to Build"

While building Fin-Agent, one feeling stood out clearly: what actually blocks progress is never writing the code. It's figuring out what should be written.

How to split tasks, what the API should look like, how failures fall back. If you haven't thought those through, AI output drifts. Handing the frontend to Codex and keeping the backend in Claude Code wasn't a decision from some methodology—I arrived at it through trial and error. Yet making that call required judgment about project structure, an understanding of where each model's capabilities stop, and a grip on business priorities—all skills outside of "writing code."

LinkedIn CPO Tomer Cohen shut down the company's traditional product manager training program and replaced it with a "Full-Stack Builder" role. He listed five core traits: vision, empathy, communication, creativity, and judgment. Not one of the five is "writing code."

When AI drives the cost of "how to implement" toward zero, what becomes scarce is "what to implement" and "why." Walmart created an internal Agent Builder role and filled it entirely through internal transfers—a store manager with ten years on the retail floor may know better what to tell an AI to build than a fresh computer science master's graduate.

**Defining the problem is always scarcer than solving it.**

### Moving Deeper: From "Writing Fast" to "Judging Accurately"

Last year I stepped on a landmine. AI wrote a date-formatting function, all tests passed, I skimmed it and merged. Three months later, I updated the date logic and production data broke—the project already had an almost identical function, which the AI didn't reuse and instead wrote from scratch. I updated the old one and never touched the new one, because I didn't know it existed.

The bug was planted the day I hit merge. Every test passed, and nothing caught it.

OpenClaw, which I covered in the second post of this series, is a scaled-up version of the same failure: a million-line Vibe Coding project that broke on every upgrade. Every piece of AI-written code looked right in isolation, and failed the moment you stitched it together. The sum of local optima is not a global optimum.

Catching these "locally right, globally wrong" failures relies on system intuition. You have to know why the system grew into its current shape, how much legacy baggage an interface carries, and the unwritten business rules—like orders over ten thousand yuan requiring manual approval. AI doesn't know any of that. You do.

**An eye for acceptance is worth more than a craftsman's hand at construction.**

---

## 5. Your X-Resistance Score

![Cold Water Time](/posts/images/assuming-x-agentic-era-engineers-survival-coordinates/assuming-x-agentic-era-engineers-survival-coordinates-04.png)

Before you start asking "which direction should I take," there is a structural dilemma worth facing.

Junior engineers used to cut their teeth on grunt work: building simple features, fixing small bugs, running data migrations. That seemingly unremarkable work was the core of apprenticeship—you learned to read blueprints by laying bricks. But if AI takes over the bricklaying, where do newcomers build judgment?

Where did your own judgment come from? From writing thousands of CRUD endpoints and stepping into countless traps. If that path gets blocked off, how will the next generation of engineers develop the eye you have today?

Nobody knows the answer.

![Your X-Resistance Score](/posts/images/assuming-x-agentic-era-engineers-survival-coordinates/assuming-x-agentic-era-engineers-survival-coordinates-05.png)

There is, however, one thing you can do right now.

**Before you log off today, look back at your work this week. How much of it consisted of judgment calls only you could make? And how much was execution an AI could take over at any moment?**

That ratio is your "X-resistance score."

If 80% of your time went to execution—writing CRUD, wiring APIs, moving data, tweaking styles—it doesn't mean you did anything wrong. It simply means that in a world where Assumption X comes true, that time will get compressed, and you'll need to find new ways to create value.

---

Remember Zhang Yuan from the beginning?

He's fictional. But that email won't stay fictional forever—similar notices have already started showing up at real companies.

This is the final post in the series. In the first post, I worked out multi-model task routing on Fin-Agent; in the second, OpenClaw showed me where the red lines of Vibe Coding lie. This third post on survival coordinates is really a corollary of the first two—when AI drives the cost of execution toward zero, your value lives in judgment.

**Before you log off today, calculate your X-resistance score.**

---

*If this post made you think through a few things you'd rather not face head-on, it has done its job.*
