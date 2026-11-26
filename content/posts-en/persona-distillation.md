---
title: "Stop Calling It \"Distillation\" — You Just Wrote a Character Card"
summary: "The viral \"persona distillation\" trend on GitHub is not knowledge distillation in any technical sense. There is no training and no weight updates—just raw text summarized into a system prompt, producing a character card. Swapping terms to sound sophisticated only widens the gap between public expectations and what AI can actually do."
coverAlt: "Stop Calling It Distillation — You Just Wrote a Character Card"
sourceHash: "a89ade5b09fb628f"
---

Lately, the word "distillation" has been run into the ground on GitHub.

`colleague.skill`, `ex.skill`, `Zhang Xuefeng.skill`, `myself.skill`, even `Nuwa.skill`—all claiming they can distill anyone. In just a few days, `colleague.skill` shot past ten thousand stars, and derivative projects popped up like mushrooms. It took over Xiaohongshu, Weibo, and Douyin, and even China National Radio (CNR) ran a story on it.

As an engineer who works with LLMs every day, my first reaction to the phrase "persona distillation" wasn't excitement. It was discomfort. Technically speaking, the term is flat-out wrong.

---

## What Real Distillation Looks Like

![What real distillation looks like](/posts/images/persona-distillation/persona-distillation-01.png)

Knowledge Distillation is a model training technique introduced by Hinton in 2015. The core idea is straightforward: a large model is capable but heavy, so can we compress its "knowledge" into a smaller model?

How does it work? You show the same problems to both the large model (the teacher) and the small model (the student). The teacher doesn't just tell the student "the answer is cat." It passes along its full judgment process—a probability distribution like "90% cat, 8% dog, 2% tiger." The student adjusts its own weights based on the teacher's distribution and trains repeatedly until its reasoning matches the teacher's.

A few keywords define this process: **training, gradient descent, weight updates**. Once distillation finishes, the student model's internal parameters are permanently altered. It doesn't need the teacher standing beside it anymore; it can make decisions close to the teacher's level on its own.

Earlier this year, Anthropic publicly accused DeepSeek and other companies of distilling Claude at scale—running 16 million conversational interactions to extract Claude's reasoning traces and train their own models. *That* is distillation. It changes the model itself. Of course, Anthropic has not provided any actual evidence for that accusation.

Keep this criterion in mind: **the output of distillation is a new model with modified weights.**

---

## What So-Called "Persona Distillation" Actually Does

![What so-called persona distillation actually does](/posts/images/persona-distillation/persona-distillation-02.png)

Now look back at those viral GitHub projects. What is their actual workflow?

Step one: collect someone's text data—chat logs, articles, speeches, social media posts. Step two: have an LLM read that data and extract speaking style, common phrases, personality traits, and decision-making habits. Step three: organize those extracted traits into a structured document.

What comes out at the end? A system prompt. A Markdown file. A character card.

Throughout this entire process, no model is trained. There is no gradient descent, no weight updates, and not a single internal parameter of any model changes. The base model remains the exact same base model—Claude is still Claude, GPT is still GPT. You simply stuffed a character description into its context window before the conversation started.

If that counts as distillation, then anyone who has ever written "You are a senior Python engineer who speaks concisely and directly" can claim they are distilling a model. Put plainly, the whole process is summarization, and the output is a character card—not a new model.

---

## This Is Not Splitting Hairs

![This is not splitting hairs](/posts/images/persona-distillation/persona-distillation-03.png)

You might think I'm being pedantic—what does the name matter as long as it works?

Naming does matter. The word "distillation" carries a technical implication: it makes you believe some irreversible transfer of capability took place, that a person's "essence" was genuinely purified and baked into the AI. In reality, how well this character card performs depends entirely on three things: the base model's capability, the size of the context window, and the quality of the raw data you feed in. Put the exact same card on different models and the results vary wildly. Switch model versions, and an output that looked convincing last month can fall apart completely this month.

There is also a hard ceiling on information density—no matter how detailed the persona description is, it still has to fit inside the context window. Decades of someone's lived experience, thousands of decisions, and countless small moments that shaped their character get compressed into a summary of a few thousand tokens. That isn't purification. It's lossy compression, and the parts that get lost are precisely the ones hardest to capture in text.

Anyone who has written fiction knows that no matter how detailed a character sheet is, the character on the page is never the real person. An AI character card is no different—it can mimic the format of how someone talks, but it cannot replicate everything that made them talk that way.

---

## Character Cards Are Fine. Mislabeling Them Isn't.

I have nothing against character cards themselves.

Role-playing in prompt engineering has been one of the most basic and widespread techniques since ChatGPT launched in 2022. Giving an AI a role so its output fits your needs is a completely reasonable way to use it. Automating that process—using AI to extract traits from raw data and generate a character card—is also a worthwhile engineering practice.

Just call it "character card generation" or "persona profiling." Don't call it "distillation."

Calling it distillation borrows a term with a precise technical definition to manufacture fake sophistication. It leads non-technical readers to think some deep AI training process is happening under the hood, and floods GitHub with low-quality repos harvesting stars off an intimidating name. Some projects claim to "distill" celebrities using nothing more than two speeches and a handful of quotes—you can imagine the quality of that character card.

What makes me even more uncomfortable is talk of "digital immortality." Packaging a character card as "resurrection" or "immortality" exploits the dead and misleads the living. You haven't brought anyone back. You've just dressed a large language model in a costume tailored from limited records. It can act the part, but it is not that person. It doesn't even know who it's playing.

Swapping concepts is not harmless. At a moment when most people are still forming their basic understanding of AI, every misused term widens the gap between public expectations and reality.

So the next time you see someone say "I distilled so-and-so," silently translate it in your head:

They wrote a character card.

Nothing more.
