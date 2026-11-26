---
title: "\"AI Wrote 80% of Our Code\" Is Just Lines of Code With Better PR"
summary: "\"AI code percentage\" measures how much was written, not how much got better. It is lines of code with better PR: always rising, never wrong, and promising nothing. While researchers update their findings and marketers count lines, this metric is already shifting budgets and layoff lists. To measure delivery, go back to proven metrics like DORA and revenue—and start by asking: is this outcome, or just volume?"
coverAlt: "\"AI Wrote 80% of Our Code\" Is Just Lines of Code With Better PR"
sourceHash: "181eeacc535c7fc7"
---

Someone in a group chat shared a news link: Google says 75% of its new code is written by AI. Right below it came the follow-up: "What's our AI adoption rate?"

Numbers like that are everywhere this year. Google at 75%. Anthropic saying roughly 80% of the code merged into production comes from Claude, with engineers shipping 8x more code per quarter than before. OpenAI reporting 80% as well. Cursor going straight for scale, saying enterprises write over 100 million lines of code a day with it. Each number is bigger than the last, sounding like a progress bar: the higher the number, the better you're using AI, and the more advanced your team is.

Put those numbers side by side, and one thing stands out: every single one of them talks about "how much was written," and not a single one talks about "how much got better."

And the companies shouting these numbers are, without exception, the ones selling tokens.

**"Percentage of code written by AI" is just lines of code with better PR.**

## We've Already Climbed Out of This Trap Once

Picture two PRs sitting in front of you. One adds 800 lines, stuffing a bunch of config flags into an old feature. The other deletes 2,000 lines of duplicate logic and fixes a recurring bug at its root. By lines of code, the first has positive "output" and the second has negative output—yet you know perfectly well which one actually delivered value.

Lines of code and PR counts are terrible metrics. That's hard-won industry common sense earned through years of chasing the wrong things: what you actually want to know is never how much was written, but what it did for users, revenue, and stability. Today, anyone who still uses it to evaluate engineers gets laughed out of the room.

![The wrong ruler: measuring software by lines of code](/posts/images/ai-code-volume-not-outcome/ai-code-volume-not-outcome-01.png)

Now we're right back on our knees for it. Only this time, lines of code hired a better publicist and called itself "percentage of code written by AI."

Even better, this kind of number cannot fail. Back when GitHub marketed Copilot, the pitch was "55% faster task completion"—you could disagree with that study (plenty of people did), because it was an outcome claim: bold, falsifiable, about value, and if it was wrong, you could prove it wrong. "75% of our code is written by AI," on the other hand, can never be wrong. It only goes up, completely detached from whether you're moving faster, whether incidents dropped, or whether customers are happier. As long as adoption keeps rising, this number only climbs. It promises nothing, so it never disappoints.

## What About the Evidence That Things "Got Better"?

That's the part nobody puts on a billboard, because it's a mess.

The strongest positive evidence comes from Cui et al.'s study of nearly 5,000 developers: task completion went up 26%, with junior developers seeing the biggest gains. That much is largely undisputed. But GitClear's data shows that as Copilot usage deepens, code churn is rising and refactoring is collapsing. METR's widely cited study from last year was even more awkward: experienced open-source developers working in familiar codebases were actually 19% slower with AI—while believing they were 20% faster.

Then came the plot twist. This February, METR largely reversed itself: their updated estimate flipped to a speedup, and they abandoned their original experimental design altogether—because developers now refuse to work without AI, and can no longer reliably self-report how much time they spend on agent tasks. Their latest position is that in 2026, AI probably makes people faster, but by how much is no longer measurable.

At the company level, an NBER survey of roughly 6,000 executives found that 69% of firms use AI, yet nearly 90% report no measurable productivity gain. Cross-referencing multiple studies puts real organizational gains somewhere around 10%. Not useless—very useful, in fact—but nowhere near "you don't need developers anymore."

The master of hedging both sides is Anthropic: on one hand, handing you the "8x output" slogan; on the other, publishing one of the most rigorous studies of the year—a randomized controlled trial showing that developers using AI assistance scored 17% lower on understanding the code they had just shipped, with no statistically significant gain in productivity.

Research teams are updating their findings honestly; marketing teams are counting lines. Both things are true at the same time, and that is precisely the point.

![Research teams vs. marketing teams](/posts/images/ai-code-volume-not-outcome/ai-code-volume-not-outcome-02.png)

## This Number Isn't Decoration—It's Coming for Jobs

If this were just keynote bragging, it wouldn't matter. The problem is that these numbers move budgets, performance expectations, and layoff lists.

This February, Jack Dorsey cut over 40% of Block's workforce—more than 4,000 people—explicitly citing AI as the core reason: "A significantly smaller team, using the tools we're building, can do more and do it better." Two weeks later, Atlassian laid off 10%, about 1,600 people.

One detail from Dorsey's announcement stuck with me: in the very same memo, he said the business was strong and gross profit was growing.

That doesn't add up. If AI really handed you a pile of free capacity out of thin air, and you're a SaaS company with a roadmap that never ends, why wouldn't you put that capacity toward shipping more value to customers and moving faster? That would show up in MAU, conversion, and revenue. Choosing layoffs instead points to only one thing: that productivity number is covering for a decision already made for other reasons—over-hiring, investor pressure, take your pick.

Every company has bloat. Efficiency-driven streamlining is fine; it happens in this industry with every major tech shift. But if you're going to cut people, use the individual performance system you already run—the one that tells you who is coasting and who is falling behind. Don't use token counts, don't use "percentage of code written by AI," and don't use where someone sits on some AI maturity ladder. **If your layoffs are based on a vanity metric, that layoff is a lottery with lipstick on.**

![A lottery with lipstick on](/posts/images/ai-code-volume-not-outcome/ai-code-volume-not-outcome-03.png)

## Individual Developers Have the Same Disease

Zoom out, and the industry is mistaking volume for outcome. Zoom in, and you and I do the exact same thing every day.

The code runs, the tests are green, and you breathe a sigh of relief: "Done." That is the exact same reflex as an executive nodding at "AI wrote 80% of our code"—you're looking at "how much was generated," not "whether it was delivered right." Earlier, when I wrote about "running it once to see if it works" being the most expensive way to verify code in the AI era, and about the five places I actually check after AI writes code, I was talking about the same thing: volume and verification are two different jobs, and the gap between them has to be bridged by human judgment.

The industry calls that gap review workload. Individuals call it "do I actually trust this code?" Different scale, same disease.

## Where I Land

Don't read this as anti-AI. I think every engineer should be using AI every single day—that's not up for debate. I've watched this industry swallow high-level languages, IDEs, autocomplete, Agile, and DevOps. Every time, people waxed nostalgic about the good old days, and every time, almost everyone came around. The only difference this time is speed: back then you could be two years late to the cloud and survive; this time you might only have a few months.

But adoption is the starting line, not the scoreboard. We've known how to measure whether engineering is delivering for a long time: DORA metrics, reliability, meaningful change rate, and ultimately revenue and customer value. Old, rough around the edges, and effective. Why on earth would we throw all of that away to chase a vanity score counted in tokens?

So the next time someone throws a number at you—at a launch event, in a performance review, or in your feed—ask one question:

**Is this outcome, or just volume?**

The funny part is how many claims deflate on the spot the moment you ask it.

At work, go AI-first all you want. When it comes to measuring it, go back to the old methods that actually work.
