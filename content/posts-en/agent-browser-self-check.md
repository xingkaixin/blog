---
title: "After an Agent Writes Frontend Code, I Make It Click Through First"
summary: "Don't jump in as soon as the frontend changes are done. Put browser self-checks into your Definition of Done so the agent walks the core paths, checks the console, and attaches screenshots first—leaving only the final UX judgment to you."
coverAlt: "After an Agent Writes Frontend Code, I Make It Click Through First"
sourceHash: "7bdd2dcbfc0505fb"
---

"Done," the agent said.

I opened the page. The modal popped up, and I couldn't close it no matter where I clicked. I took a screenshot, described what happened, and sent it back. It fixed the issue in a few seconds, and I refreshed and clicked again. That afternoon, I repeated the same routine on the same page dozens of times: the agent wrote the code, I clicked through the browser, and every round waited on me to verify before moving on.

In that whole loop, the slowest part was my own hand.

![Old workflow vs. new workflow](/posts/images/agent-browser-self-check/agent-browser-self-check-01.png)

## "Done" Isn't Done

I used to assume an agent's handoff boundary was the code: once the files were edited and the tests passed, it could report completion. Anything in the browser was on me—someone had to click through it eventually.

That split has an obvious waste. Whether a modal closes, whether an empty form throws an error, whether the page updates after clicking save—none of that is a taste judgment. It's behavioral verification with clear pass/fail answers. The agent can already start the dev server, drive the page, read the console, and take screenshots, yet it stops right after writing code and waits for me to do the most mechanical part.

What I changed later wasn't the prompt, it was the definition of "done." A frontend task isn't finished until it has passed a browser self-check.

## The Rule I Put in My Projects

Now I write this directly into my project rules:

```text
Before reporting a frontend change as done, you must complete browser verification yourself:

1. Start the local server and confirm the target page loads.
2. Walk through the core interaction paths affected by this change.
3. Check the console—no new errors are allowed.
4. Verify key states against the acceptance criteria and provide screenshots.
5. If you find an issue, fix it and re-run the flow. Never hand unverified results to the user.
```

This rule changes the order of delivery. After writing modal logic, the agent has to open the page itself, trigger the modal, click close, and check both the page state and the console. If it won't close, it goes back to the code and fixes it before ever saying "done." By the time the result reaches me, the cheapest bugs have already been caught in the previous round.

Screenshots aren't decoration either. At a minimum, they prove the agent opened the right page and reached the state it claims to have tested. When multiple steps are involved, I also ask it to list the exact path it took in its summary, so "the page loads" doesn't quietly get passed off as "the feature is verified."

"Walk the core paths" can't be left as a vague slogan. For a new modal, I spell out the path: open the entry point, trigger the modal, submit an empty form, fill in valid data, close and reopen. Each step maps to an observable outcome. That way the agent knows where to go, and I can tell from its report whether it skipped any steps.

Verification scope needs to stay tight, too. If you changed a modal, test the modal's paths; if it involves responsive layout, check desktop and mobile widths. Having the agent aimlessly click through the entire site is slow and makes it hard to know what "everything looks good" actually covered.

![Five-step browser self-check rule](/posts/images/agent-browser-self-check/agent-browser-self-check-02.png)

## Don't Reach for a Browser When an Assertion Will Do

The browser isn't the first choice for every check.

API responses, data transformations, and permission checks can be pinned down cleanly in automated tests—keep them there. Tests run faster and point straight to where things broke. Save the browser for what structured tools can't cover: real rendering, cross-component state, focus, modals, forms, and whether an end-to-end interaction actually holds together.

The order should be: verify with the cheapest, most deterministic tool first, then let the browser cover the final stretch. Otherwise, having the agent click through the whole page after every single-line edit just turns automation into slower manual QA.

![Layered verification methods](/posts/images/agent-browser-self-check/agent-browser-self-check-03.png)

## What Humans Should Actually Verify

Browser self-checks eliminate the first round of mechanical verification, not the human using the product.

An agent can check a list to confirm a button responds; whether that button feels right in that spot is something only I know by using it. You can check whether colors hit the design tokens, but whether the hierarchy feels comfortable or the copy reads awkwardly still takes human judgment. As I wrote in my previous post, looking only at the diff without actually using the product misses the issues only fingers and eyes can catch.

So I still open the page in the end, just no longer to check for the agent whether a modal closes or if there's red text in the console. What I pick up is a version that already works, leaving my attention for whether the interaction feels natural, whether the information is clear, and whether the feature actually feels like my product.

**A frontend task shouldn't stop when the code is written; it should at least get to the point where the page has actually been clicked.**
