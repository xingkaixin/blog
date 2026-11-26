---
title: "The Subtlest Blind Spot in Agentic Coding: If You Step Out of the Loop, Who Presses Tab?"
summary: "Agent-written code can pass every test and look logical, yet feel wrong under a user's fingers: when OpenCode's author let an agent handle focus switching, it picked the f key while everyone's muscle memory reaches for Tab. Agents generate what is plausible, not what is right; you can outsource execution, but not taste."
coverAlt: "The Subtlest Blind Spot in Agentic Coding: If You Step Out of the Loop, Who Presses Tab?"
sourceHash: "ece4d6d1330090d9"
---

An agent took over the UI details of a module for me.

I defined the requirements, wrote down the constraints, and let the agent generate the code. I checked the final diff, ran the tests, saw everything pass, and merged. I didn't review every line, and I didn't open the product to try it myself. I called that "efficiency"—saving human time for higher-level decisions while letting the agent handle execution.

It was fast. Fast enough that I started thinking this was the right way to work.

---

While building the diff viewer for OpenCode, jlongster ran into a small interaction problem. With a file tree and a diff pane side by side, what should happen when the user presses the arrow keys? Scroll the diff, or move to the next file in the tree? Both panes are on screen; deciding which one responds to the keyboard is a judgment call.

He let the agent handle the focus logic. The agent's solution was to use the `f` key to toggle focus on the file tree—`f` for focus, semantically clear, and free of conflicts with other shortcuts. He looked at the diff, thought it made sense, and merged it.

Later, when he actually used the feature, his fingers naturally reached for Tab.

Just Tab. The way web and native apps have switched focus for decades. Everyone's fingers remember Tab; nobody's fingers remember `f`.

As he wrote in his post: wait a second, of course it's Tab! That's how every web and native app works.

But an agent has no "of course." It has never pressed Tab on a real interface; it only has the next token gathered from its context. As an answer, `f` is reasonable on the level of reasoning. On the level of actual use, it is wrong.

![What hands remember, docs never write](/posts/images/stay-in-the-loop/stay-in-the-loop-01.png)

---

## Agents generate what is plausible, not what is right

Plausible means the logic holds up, the tests pass, and code review finds no obvious flaws. Right means that when a user sits down, their hands naturally land in the right place.

Where a user's hands naturally land isn't written in any documentation, platform design guideline, or `CLAUDE.md`. It lives in muscle memory, built from opening a dozen apps every day. If you tell an agent to follow "platform interaction conventions," it can find the parts that are written down, not the parts no one ever bothered to write.

This isn't a matter of writing more detailed prompts. You can specify the requirements in greater detail, but the things you need to specify are precisely the "goes without saying" details—and the reason they were never written down is that you assumed they didn't need to be said.

Between plausible and right lies a gap. That gap is where users fall through.

## "Reviewing the diff" and "staying in the loop" are two different things

I used to conflate the two.

Reviewing a diff tells you what the code does, not whether pressing Tab feels right. Those are two different kinds of information. One is structural; the other is experiential. When you only look at the first, the experiential judgment goes unmade, and the agent's plausible answer steps right in to fill the void.

jlongster mentioned that he now spends most of his time inside OpenCode, only opening an editor when necessary. He isn't watching every step the agent takes; he is **constantly running his own product alongside it**. The agent edits the code while he uses the product.

Both can happen at the same time. The conflict isn't between "letting an agent run" and "staying in the loop"—it's mistaking "the agent is running" for "I don't need to use it anymore."

## You can't outsource taste

After reading jlongster's post, I opened the module the agent had taken over and clicked through it from scratch like a new user. At step three, my hand froze: after filling out the form, my fingers hit Enter out of habit, and nothing happened—the confirm button sat in the bottom-right corner of the modal and required a mouse click. The tests passed, and the logic was fine. That feeling of "I can't quite point to what's broken, yet it feels awkward to use" is something a diff review will never catch.

An agent can't give you taste. Not because it's dumb, but because taste comes from using the product, and the agent doesn't use yours. When you hand over taste, you're letting something that has never used your product fill in the blanks. It fills them with whatever is most common in its training data, not what fits your product best.

**You don't need to micromanage every line of code the agent writes, but you must keep the habit of using the product.** Execution can be outsourced; taste cannot.

## The later you catch it, the more it costs

Some will say: issues will surface sooner or later, users will report them, and then you fix them.

Changing `f` to Tab is a one-line fix. But if the agent's awkward workflow has already become the foundation for three other features and users have started building muscle memory around it, changing it later means breaking things.

Even quieter is what usually happens: users won't tell you "this flow feels awkward." They just feel friction, use it less, and eventually churn. Step out of the loop, and you won't even see it happening.

One line from jlongster's post is worth quoting directly: you have the option to step out of the loop because the agent gave it to you. Your users don't—they use what you build every day.

![Outside the loop, you see the diff, not the user](/posts/images/stay-in-the-loop/stay-in-the-loop-02.png)

---

Using agents to move faster is real—provided you are still using what you build. Otherwise you're moving fast, just in the wrong direction without knowing it.

Your users are still in the loop. Why wouldn't you be?
