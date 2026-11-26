---
title: "You're Only Getting the Average from Your LLM"
summary: "LLM outputs follow a probability distribution, and most people only get the mediocre average in the middle. The truly good answers sit in the tail—and only someone who already knows the domain can tell good from bad and squeeze them out round after round. LLMs aren't flattening the knowledge gap; they're widening it."
coverAlt: "You're Only Getting the Average from Your LLM"
sourceHash: "34085665e3d5120f"
---

Last week I asked ChatGPT to write a Redis distributed lock implementation.

The code came back looking pretty solid—it had comments, error handling, and even logging all written out. I almost copied it straight into the project.

Then I took a closer look and spotted a race condition in the lock renewal logic. Not an obvious bug, either—the kind that sits quietly in production for two weeks before blowing up.

My first thought was: if I didn't already know this area, I probably would've shipped it as-is.

That's how using an LLM feels to me right now. Everything it hands you looks fine on the surface, and you have no idea which part is hollow.

## What You're Getting Is the Average

An LLM's output is a probability distribution. Ask the same question differently, or as different people, and what comes out can vary wildly. Most answers land right in the middle—smoothly written, seemingly useful, basically an average of all the boilerplate floating around online.

The truly good answers sit out in the tail. Rare, but they're there.

The catch is: how do you know whether you got the middle or the good end?

Unless you already know the subject, you can't tell.

## Why Experts Move Faster

This part is pretty counterintuitive.

LLMs don't help everyone equally. The more you understand a domain, the bigger the boost you get. You can spot what's wrong at a glance and tell it to try again—pushing the answer, round after round, from mediocre toward genuinely good.

I don't know what the proper term for this is; I just call it "squeezing." You press what you already know against a probability machine and force it to give up what it was capable of producing all along, just too lazy to offer on the first try.

So the gap between how different people use LLMs comes down to who can judge quality and keep squeezing.

A few days ago a coworker asked an LLM to write API docs. The formatting looked great, and every field description was filler like "This field is used to store XXX." He thought it looked good and committed it straight away.

When I tried it myself, I worked out the boundary conditions for every field first, then had the LLM write against that structure. Only then was the output actually usable.

Same model, same probability space. The difference is who can squeeze a little more out of it.

There's a catch to all this, though—you still have to actually understand something first. Nobody gets to skip that step. The LLM can't do it for you.

## You Still Have to Go Deep

Honestly, LLMs haven't flattened knowledge. They're widening the gap.

You get out what you put in. Toss a vague question over the fence and you get a vague answer back. Think it through first and then hand it over, and the efficiency jumps several times over.

So the way I see it now, the most important thing is still to go deep in a field.

Once you're deep enough, it can't fool you. You can point out exactly where an answer falls short, telling it to redo is a single sentence, and you'll know right away whether the new answer holds up.

Only then is the LLM actually working for you.
