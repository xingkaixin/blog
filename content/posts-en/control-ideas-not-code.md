---
title: "I Said Engineers Should Shift to Reviewing Code—Four Months Later, Redis's Creator Says Line-by-Line AI Code Review Is Mostly Useless"
summary: "Should we still review AI-generated code line by line? Redis creator antirez admits line-by-line review is \"mostly useless\" and argues for spending time on QA, design, and DESIGN.md instead. This isn't a final verdict, but a follow-up to my earlier post on shifting from writing to reviewing code."
coverAlt: "I Said Engineers Should Shift to Reviewing Code—Four Months Later, Redis's Creator Says Line-by-Line AI Code Review Is Mostly Useless"
sourceHash: "b841f20c8fd3cc4a"
---

Back in March, I published a post titled *From Writing Code to Reviewing Code*. In it, there was a vignette I was quite proud of at the time: AI generated 200 lines in two minutes, and I spent 40 minutes walking through edge cases and fixing bugs one by one. I treated those 40 minutes as proof of our new job description—writing was losing value, while reviewing was gaining it.

Last week I read antirez's new blog post, whose title felt aimed almost directly at that piece: *Control the ideas, not the code*. The creator of Redis put it bluntly: he still reviews AI code line by line himself, but the practice is "mostly useless."

My first reaction was pushback. Reading it again, I realized he wasn't offering a dataset meant to settle the debate—he was pointing out an opportunity cost I hadn't seriously calculated.

## He Isn't Just Talking in the Abstract

antirez has been working on DwarfStar, an open-source local LLM inference project. He had AI write the inference implementations for DeepSeek v4 and GLM 5.2 completely automatically.

This wasn't "one-sentence prompt to build XYZ" vibe coding. He emphasizes that you still need to understand the principles, the design, and how to squeeze out performance. The difference is where you spend your effort: on those decisions, rather than reading every generated line.

The results were worse than he expected—for the other side. When he compared his AI-written implementations against other systems for correctness, he found more bugs in the hand-written ones. Digging deeper, the local inference ecosystem was full of subtle, accumulated errors: for instance, broken indexed attention implementations doing redundant work, causing performance to degrade once context passed a certain length.

Those bugs lived in code written and read line by line by humans. Reading line by line hadn't caught them.

## He Still Reviews Line by Line, While Telling the Truth

Matteo Collina asked him directly: didn't you say you inspect all AI-written code in Redis?

He admitted he still does. For the Redis sorted sets optimization PR that cut memory usage by 50%, he still went through it line by line and rewrote parts that didn't match his taste. But he stated plainly: starting around GPT 5.5, that became increasingly pointless, and by Fable and GPT 5.6, it's mostly useless. He keeps doing it out of respect for users—too many people open Redis source files and modify the code themselves.

What really made me pause was this line: he judged that Fable and GPT 5.6 reviewing that PR would catch more bugs and subtle race conditions than he would himself.

This isn't a benchmark; it's just antirez's assessment of his own workflow, so you can't extrapolate that everyone should stop reading code. Still, it forces a harder question: if independent model reviews and executable verification already catch most defects, what new signal am I actually adding by spending 40 minutes scanning a diff line by line?

**Line-by-line review is only quality assurance when it adds new judgment; if you can't say what it adds, it's just a ritual.**

![The opportunity cost of line-by-line review versus adding new judgment](/posts/images/control-ideas-not-code/control-ideas-not-code-01.png)

He did the math: in an eight-hour day, reading code has an opportunity cost. He wants to invest the saved time in three places: doing more QA; coming up with the next optimization idea; and using an LLM to write a `DESIGN.md` for each data structure, describing the ideas, trade-offs, and implementation tricks it embodies in plain human language. Anyone who wants to modify sorted sets in the future can read the design, own the ideas, and then direct agents with the right mental model.

Own ideas, not code. He notes that this framing goes back to *The Mythical Man-Month* in the 1970s.

## Which Layer Do I Step Back To?

In my March post, I had already written "don't act as a human linter line by line; use linters and tests to catch trivial mistakes." Even so, I treated "reviewing code" as the engineer's new core skill—as the destination. antirez pushed it one step further: reviewing code is itself a transitional form, and human control has to move up to the level of ideas.

I buy that step. Thinking back to the moments in line-by-line review where I actually created value, they were rarely "there's a bug on this line." Far more often they were "this module shouldn't be split this way" or "this edge case wasn't considered in the design at all." Machines are getting better at the former, while the latter happens before code is ever written.

That is also the hardest step to make.

antirez can afford to control only the ideas because he already has the byte-level layout of sorted sets in his head. His "ideas" translate directly into data structures, constraints, and trade-offs—not "build me something fast and memory-efficient." Most of the time when we say "control the ideas," what we actually provide are wishes, not constraints. The gap between wishes and constraints determines how much judgment you still need to keep at the code level.

**You need an idea worth controlling before you earn the right to control only the idea.**

You can try his `DESIGN.md` test yourself: pick a module you own, don't look at the code, and write down its data structures, key trade-offs, and failure modes in plain language. If you can't write it, your line-by-line reviews were only skimming the surface—you can't judge what you don't understand. I wrote that line in March, and it still holds; only the conclusion it points to has changed.

![Reviewing structure, trade-offs, and failure modes before generating code](/posts/images/control-ideas-not-code/control-ideas-not-code-02.png)

## Where Do Ideas Come From?

So I don't think antirez is telling people to slack off. On the contrary, his bar for fundamentals just got higher.

His advice to beginners isn't "read more AI-generated code," but to build a small interpreter, a small database, or a hash table to form a real mental model. Reviewing piles of LLM-generated JavaScript for client websites? He was blunt: don't waste your time on that.

He also got one more jab in: people protesting "AI slop" today—where was that horror over the past ten years when software was already terrible? AI didn't invent slop. Software where nobody owns the ideas turns into slop just the same when written by hand.

In March I said a developer's value lies in how many right judgments they make. I'm not taking that back. What changed is where that judgment needs to stand: off the diff, and ahead of it.

Next time AI submits code, hold off on reading it line by line. Ask yourself first: could I write down this module's design without looking at the code?
