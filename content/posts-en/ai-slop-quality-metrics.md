---
title: "Can a Single Score Measure AI Code Quality?"
summary: "Line counts, duplication, and complexity can surface clues about AI slop, but a total score cannot replace maintenance judgment. Use metrics to locate problems, then watch how the code handles the next requirement change—otherwise you end up optimizing for good numbers by creating a different kind of bad code."
coverAlt: "Can a Single Score Measure AI Code Quality?"
sourceHash: "306255bef337385e"
---

In the SlopCodeBench paper, there is a 117-line function that piles nearly every branch in the implementation into one place—`find_matches_in_file()` at the final checkpoint of the code_search task. The paper's explanation is that when an agent runs into a new requirement, it strongly favors tacking the new logic onto an existing function.

That [paper](https://arxiv.org/html/2603.24755v1#S2.SS3) splits requirements into multiple rounds and hands them to an agent, carrying over its own implementation from the previous round and tracking with numbers how the code structure degrades turn by turn. Compared to arguing in the abstract over whether "AI code is garbage," this kind of quantitative measurement is clearly more informative.

Yet metrics like these bring a new temptation: can we compute a slop quality score for a repository and use it to gate whether code gets merged?

The paper separately measures the proportion of redundant code and the degree to which complexity concentrates in high-complexity functions. Those structural signals point to places worth inspecting, but they do not directly measure how long it will take the next person to modify the code safely.

The word "slop" now carries too many meanings. Some people use it for duplicated code, some for unnecessary abstractions, and others simply mean an implementation doesn't match their habits. Add "this was written by AI," and provenance gets mixed into quality judgment too.

Those issues shouldn't be lumped under a single label. Duplicated logic can be checked, and branches in a function can be counted, but whether an abstraction is necessary depends on what role it plays in the current project. Origin alone explains none of those trade-offs.

Human-written code can just as easily force every small change across a dozen files. An agent-written implementation that respects existing boundaries and is easy to inspect shouldn't be condemned just because of how it was produced.

Turning gut feelings into metrics is appealing for a reason. At minimum, it gives everyone a shared reference point to discuss the same code, cutting down on pointless back-and-forth between "this feels off to me" and "looks fine to me."

In a September [post](https://earendil.com/posts/measuring-code-sloppiness/), Earendil surveyed several attempts to track slop using added lines, redundancy, and complexity. The author also pointed out that added lines can be a useful clue, but the moment you optimize directly for them, the meaning shifts.

When a diff suddenly grows huge, it is worth asking why. Jumping from "added lines might expose a problem" to "fewer added lines is always better," however, rewards a different kind of bad code: cramming information together and hiding once-explicit handling inside hard-to-read expressions.

Likewise, complexity concentrated in a large function may mean new logic kept getting pasted into the same spot. Splitting the function changes the statistics, but not necessarily the cost of understanding it.

If reading one entry point means jumping through several single-use helper functions and piecing the conditions back together in your head, the code is still hard to read. Prettier local numbers don't guarantee the reader has fewer things to keep track of.

![Splitting functions mechanically still forces readers to piece conditions back together](/posts/images/ai-slop-quality-metrics/ai-slop-quality-metrics-01.png)

There are also times when splitting a function genuinely clarifies responsibilities, and times when new lines fill in genuinely needed behavior. A metric cannot tell which case you are looking at.

**Quality scores are useful for locating problems, not for deciding on their own whether a change should be merged.**

Handing the grading to a model as a judge doesn't sidestep this either. A model still needs a rubric to explain what it is evaluating. Giving a 9 out of 10 just turns the discussion into a number.

If the rubric favors short functions, it can reward mechanical splitting; if it favors complete architecture, it can reward layers that aren't needed yet. Having reasons and terminology behind a score doesn't mean the rubric fits this project.

A more useful response points to concrete burdens: where the same rule is implemented more than once, which places a condition change will touch, and which intermediate states a reader has to hold in mind. That kind of feedback can be verified or disputed.

As for whether those burdens ever materialize, you have to watch for them in the next requirement change. Code generated in one shot only faces requirements that are already known; whether it works today and how much it costs to keep it working are questions at two different points in time.

What makes SlopCodeBench valuable is that it asks the agent to keep maintaining its own implementation. When the next round of requirements arrives, the previous workspace is kept, but the conversation context is wiped and the old code isn't replaced with a reference solution. Burdens created by earlier choices stick around—they can't be erased by starting fresh each time.

This is also a reminder not to fixate only on the final score. If code starts with great metrics and then requires major rewrites every time new behavior is added, that initial score missed the relevant risk.

Of course, future requirements can never be predicted in full. You can't conclude an earlier design was wrong just because a new requirement calls for a refactor. Building every abstraction upfront for a change that never happens adds maintenance burden of its own.

A more reasonable way to evaluate is to pick changes likely to happen in the project and compare how different implementations hold up against the same change. Tests check whether existing behavior stayed intact; change scope, duplicated logic, and the explanation needed to take over the code fill in how hard it is to keep maintaining.

![Observe maintenance burden through the next real change](/posts/images/ai-slop-quality-metrics/ai-slop-quality-metrics-02.png)

None of these observations add up to a universal leaderboard. A function that is clear enough in a small utility may need a different structure in a long-lived service. The paper's metrics only capture a subset of structural traits, and its eval tasks, models, and session conditions differ from real teams—so a score like that shouldn't be lifted straight into production merge gates.

I would use metrics first to locate anomalies: why the code suddenly grew, why complexity clustered, why duplication increased. Then I would go back to the change itself and judge whether the added burden came from the requirements or was invented by the implementation.

When reviewing a cleanup change, I check along one specific rule: how many places had to be edited before versus now, and which intermediate states you had to track before versus what's left now. How many lines were deleted or how much a score went up comes after those questions.
