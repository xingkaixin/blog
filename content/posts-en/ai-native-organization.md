---
title: "Does Everyone Using AI Make a Company AI-Native?"
summary: "An AI-native organization cannot be measured by account usage alone. Whether employees can access valid materials, whether working practices can be reused by colleagues, and whether someone owns failures determine if individual gains become part of the team's daily work."
coverAlt: "Does Everyone Using AI Make a Company AI-Native?"
sourceHash: "0ca9a8e3efd6352d"
---

While many teams are still running trainings because employees aren't writing good enough prompts, an unexpected department order has emerged: inside OpenAI, besides engineering, the earliest group to hand off large parts of its daily work to Agents was legal. Legal's early adoption is hard to explain by technical proficiency alone.

The explanation from interviewees is straightforward. Coding adopted early because local codebases and command-line environments were already there. Legal adopted early because the contracts, regulations, and past case files needed for review were already organized in documents that models could open directly. As for why other business functions have struggled to get off the ground, the bottleneck is often on the input side—the materials needed to get the work done are scattered across systems that Agents simply cannot reach. That is what minutes 13–15 of [this interview](https://www.youtube.com/watch?v=TR8RDUzQaMo) are about.

This made me rethink the label "AI-native company." Provisioning accounts for employees and telling everyone to use them more will raise usage rates. Whether the organization actually becomes better at getting work done requires a different check.

I would start by looking at a real task: what materials are needed to finish it, how much of that an Agent can actually read, and which steps still require a human to ferry information around. When a task stalls, the cause may happen well before the question of whether an employee knows how to use AI.

When people do their jobs, they usually rely on more than a single formal document. The latest decision might be sitting in a chat thread, a spreadsheet hasn't been updated yet, a client just added a condition in an email attachment, and the project owner knows which version is already obsolete. Those pieces get stitched together through relationships between people.

Switch to an Agent, and it can usually only judge based on the subset fed into it. When materials are missing, the model may not clearly report what is absent. It might even produce a complete, fluent answer that relies on outdated terms.

Output like that creates a false impression: the tool is connected, and an answer came out, so the work environment must be ready. In reality, the employee still has to dig up attachments, verify versions, ask the owner, and feed the corrected materials back in.

The employee gets better at talking to AI, yet the overall wait time for the task may not shrink at all.

![Input materials are still moved around by humans](/posts/images/ai-native-organization/ai-native-organization-01.png)

So before blaming low adoption on employees being "resistant to change," you have to inspect the conditions they are working with. With the same tool and the same training, completing a task against directly accessible files is a very different problem from working with data scattered across half a dozen systems.

That doesn't mean opening up all data to AI either. Beyond being findable, materials need clear signals for whether they are still valid, whether they belong to the current task, and whether the current employee is authorized to use them. Pulling in expired documents or unauthorized information only introduces a different class of failure into the workflow.

Model capability matters too. Being able to read a file doesn't guarantee the model understands it; being able to call an API doesn't guarantee it can see a complex task through. Access conditions have to be verified alongside capability—you can't substitute "everything is connected" for an actual delivery.

Even after access improves, an organization can still end up with only a handful of people using it well.

A skilled employee knows how to pick the right materials, spot when an output is wrong, and supply the context the model missed. The final result carries their judgment. Hand the exact same prompt to a colleague, and they may not be able to reproduce the result.

At that point, sharing prompts only transfers a small slice of the workflow. Which materials to pick, how to confirm the version, when to stop, and who signs off on the output—people still have to keep going back to that one skilled person to ask.

**An individual knowing how to use AI does not automatically become a capability the team can reuse.**

I prefer a plain test for this shift: the next time a colleague does the same job, do they still need to call that power user over?

If mechanical questions drop away and what remains is judgment that genuinely requires experience, the process is starting to become reusable. If colleagues still have to ask the original operator which attachment to pick or where to pull the numbers, the capability is still locked inside that one person.

[The public preview of the interview summary](https://natesnewsletter.substack.com/p/ai-native-workplace-adoption) mentions finance staff building apps and colleagues building tools for other colleagues. That points to a concrete direction: turning steps that repeatedly need manual help into entry points that anyone else can use.

This example doesn't require every company to build a suite of internal apps. For recurring tasks, it may be enough to fix where source materials live, mark which version is active, and leave the verification steps somewhere the team can find them.

![Enable colleagues to reuse independently while keeping an owner](/posts/images/ai-native-organization/ai-native-organization-02.png)

The size of the solution should match the problem. One-off explorations don't need to be packaged into systems. Work that repeats every week—and always sends people back to the same person for help—is what's worth standardizing.

Nor can the original operator just walk away. Data sources shift, departments change their definitions, and tools break. Once people start relying on a shared entry point, someone has to own spotting errors and maintaining the rules.

Otherwise, a successful demo turns into one more unmaintained internal tool. Account usage goes up, and the time spent fixing things and double-checking results goes up right along with it.

That is why I think "AI-native" should at least pass an outcome-based check. Can materials be obtained under proper permissions? Can working practices be handed over for others to use? And when something breaks, is there still a clear owner to step in? Activity inside a chat box cannot answer any of those questions.

OpenAI's experience only offers clues. It sits close to model R&D, has strong internal motivation to dogfood, and operates with tools and organizational conditions unlike most companies. The order in which its departments adopted AI cannot be used directly to predict another company's transition path.

The next time adoption rates come up, I would pick one recurring team task and trace it from gathering materials all the way to accepting the result. Note where the waiting happens and which steps still depend on one specific person, then decide whether to fix data access, clean up the workflow, or add more usage training.
