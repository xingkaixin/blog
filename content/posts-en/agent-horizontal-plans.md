---
title: "Agent Plans Start at the Database, So You Can't Try Anything Until the Last Layer"
summary: "Agent development plans, vertical slices: models tend to plan by database, service, API, and frontend, leaving nothing testable until the final layer. Switching to vertical slices lets you test each slice with curl or a browser as soon as it's done, with similar cuts for CLIs and libraries."
coverAlt: "Agent plans start at the database, so you can't try anything until the last layer"
sourceHash: "9f8a6b8e830517ac"
---

Ask an agent for a development plan first, and the list it hands back often has the same four lines: database migration, service layer, API, frontend. Everything each step needs is prepared by the step before it. Looking purely at the order, there's nothing wrong with it.

In *Why Software Factories Fail*, Dex Horthy calls this ordering a "horizontal plan"—building layer by layer from the bottom of the stack up. He notes that models love planning this way, and the problem is you have nothing tangible to touch along the way. For almost every feature he builds, he opens a browser to take a look or hits an endpoint with curl every so often. With a horizontal plan, none of that is possible until the final frontend layer is finished.

He offers a point of reference: before AI, few people would write two thousand—or even five hundred—lines of code in a row without checking anything in between.

When he used to write code by hand, he grew it from the middle out. First he'd define the API contract, have the endpoint return mock data, and test it with curl; then he'd build the frontend to consume that mock and tweak it in the browser. The service layer, database migrations, business logic, and error handling were wired in layer by layer afterward, testing and adjusting at each step. He calls this approach vertical slices.

Now, when delegating work to a model, he usually only asks for 1 to 3 slices at a time and reads the code as it goes. When it's code he cares deeply about, or an area where he doesn't trust the model, he checks every single step—course-correcting after 100 to 200 lines is much cheaper than writing over two thousand lines and hunting down what broke afterward.

He also notes that most frontier models won't produce a vertical-slice plan without guidance, and the way you slice depends on the codebase and the task, so he watches the planning step closely himself. That's his experience-based judgment; the article doesn't provide data for it.

When I ask Claude Code or Codex for a plan, the first question I ask once it comes back is: after step one is done, what can I actually try? **If it can't answer, I make it reorder the plan.**

After reordering, the first slice just wires up the endpoint and the page with mocks—enough for curl to reach it and for clicks to work in the browser. Each subsequent slice builds on the last, such as swapping the mock for a real service layer. I assign 1 to 3 slices at a time, run through them myself once they're done, and only then let it move on.

![Start with a testable slice](/posts/images/agent-horizontal-plans/agent-horizontal-plans-01.png)

As for how big a slice should be, Dillon Mulroy's numbers are a useful benchmark. He's a Cloudflare engineer who said in an interview with Jan-Niklas Wortmann that he tries to keep each PR between 300 and 800 lines, stacking them with stacked PRs so his eyes don't glaze over during review. He said AI hasn't changed how he ships at all. He was talking about how many lines to review at once rather than vertical slices, and I use that range as the upper bound for a slice.

Neither Dex nor Dillon covered how to slice tasks without a UI, so here is how I handle them. For a CLI tool, I nail down the commands, flags, and output format first, return dummy data everywhere, and run it in the terminal to check if the flags feel natural and the output looks right. For a library, I start by writing the caller's example code.

Vertical slicing means writing extra mocks that have to be torn out later, and updating them whenever an interface changes. I'm fine with that trade-off: when the direction is wrong, I only lose one slice.
