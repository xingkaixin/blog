---
title: "Most People Don't Judge an Agent—They Just Absorb Its Conclusions"
summary: "Judgment isn't a gift; it's a muscle you train through a predict-and-reconcile loop. Before assigning a task, write down how you bet the agent will approach it and where it will trip up; when it delivers, hide its summary, guess the changes first, and compare. Where your bet misses is exactly where you need to look closely—most people only absorb the agent's conclusions without making a prediction, and only notice the drift a year later."
coverAlt: "Most people don't judge an agent—they just absorb its conclusions"
sourceHash: "845bc06d3a505b6b"
---

You ask an agent to fix a bug. Thirty seconds later, it throws back a PR with a well-argued description, and the tests look green. You skim it, think "looks fine," and merge.

More and more work ships like this. The faster agents produce output, the less your real anxiety is about whether the code is right. It becomes a different question: on what basis am I deciding whether to trust it?

We usually assume this kind of judgment is a gift. Some people can glance at a piece of code or a design and immediately tell if it's solid; others can't, and we chalk it up to talent. The AI era amplifies this anxiety—the agent feeds you screen after screen of output, and you either scrutinize every line (which you don't have time for) or skim it and decide it "seems fine" (which isn't judgment).

I recently read an article on scientific research that nailed it in one line: **taste isn't a gift; it's a muscle.** It even laid out how to train it. That training method maps onto working with agents seamlessly.

## How to Train Judgment: Predict, Then Reconcile

The article's method for training scientific taste is almost disarmingly simple: before every experiment, predict its outcome. Cover up the results section of a paper, read only the methods, and guess the numbers yourself. Place a bet on every new release this month—will it still matter two years from now?—and check your hit rate later.

One prediction plus one correction, repeated a few hundred times. That is how any good model gets trained, including the one in your head.

Swap "experiment" for "agent output," and you have the training loop for judgment.

The reason you struggle to judge what an agent hands you is usually that your order is backwards: you read what it wrote first, then decide "yeah, looks fine." That isn't judgment; it's rubber-stamping—the conclusion is already sitting in front of you, and you're just signing off on it. Real judgment happens before you see the answer.

![The predict-and-reconcile loop](/posts/images/taste-is-a-muscle-predict-before-output/taste-is-a-muscle-predict-before-output-01.png)

## Before Assigning Work, Write Down Your Bet

In practice, it comes down to one rule: **before you hand off a task, write down what you bet the agent will do.**

Before asking an agent to build a feature, write one sentence: I bet it will take this approach and trip up on this edge case. Before asking it to fix a bug, write: I bet the root cause is here. When it comes back with a PR, don't read its description first—cover it up, guess which files it touched and what it missed, and then reconcile.

When your bet is right, your mental model gets reinforced. When your bet is wrong, you've caught the exact spot where your understanding and the agent's diverge—and that spot is where your attention belongs.

The cost of doing this is absurdly low; it's barely a single written sentence. Yet it pulls you out of passive rubber-stamping and back into active prediction. And the gap between rubber-stamping and prediction is judgment itself.

![The line between passive rubber-stamping and active prediction](/posts/images/taste-is-a-muscle-predict-before-output/taste-is-a-muscle-predict-before-output-02.png)

## Why Most People Never Build This Muscle

There was another detail in that article that stuck with me. At Bell Labs, Richard Hamming had a habit that made him unpopular at lunch: he would ask whoever sat next to him what the most important problem in their field was, and then ask why they weren't working on it. People started moving to other tables.

The question stings because most people can't answer it. We don't choose our problems; we absorb them—from an advisor, from whatever a big lab announced last quarter, from the paper everyone is sharing this week. When you absorb a problem, you hold the conclusion without the derivation: you know a famous lab cares about a certain direction, but not why, not what they expect to find, and not what would make them abandon it.

It's the same with agents. Most people don't judge an agent; they just absorb its conclusions—the proposal sounds plausible enough, so they ship it. You hold its output without a prediction of your own to check it against. Once it drifts off course, just like everyone else, you won't notice until a year later.

## Where This Lands

Judgment isn't about whether you were born with an eye for things. It's about whether you're willing to put a prediction down before seeing the answer.

Next time you hand a task to an agent, before you hit Enter, take ten seconds to write one line: I bet it will do this, and it will break here. Then wait for the output and reconcile.

After a few hundred reps, that mental model gets built. There is no such thing as talent here—only whether you made the prediction.
