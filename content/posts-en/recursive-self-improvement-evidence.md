---
title: "Why Agent Self-Improvement Doesn't Prove an Intelligence Explosion Yet"
summary: "Agent self-improvement experiments have shown gains in task performance, but evidence remains thin that an upgraded system can drive the next round of upgrades more efficiently. When reading Weco's experiment, distinguish higher task scores from a stronger capacity to improve."
coverAlt: "Why Agent Self-Improvement Doesn't Prove an Intelligence Explosion Yet"
sourceHash: "a56d19b3843ed085"
---

When I opened Weco's post announcing recursive self-improvement, two numbers stood out first: the system ran continuously for eight days and found a version that outperformed an Agent the team had spent two years tuning by hand. Turning to the "ignition test" in the technical report, however, the conclusion pulled back: when the upgraded Agent was placed in the role responsible for making improvements, it did not yet show a clearly distinguishable advantage.

Those two passages describe the same experiment. It did find a better Agent, and it did not prove that a better Agent will build better versions of itself faster and faster. The [technical report](https://arxiv.org/html/2609.26457v1#S3.SS6) draws that line clearly.

Seeing an Agent automatically edit prompts, add tools, and rewrite search strategies makes it tempting to extrapolate: if it can modify itself, the next generation will modify itself better, and the one after that will accelerate further. A handful of code updates gets told as a self-extending capability curve ending in what people call an "intelligence explosion."

There is a missing verification step in between. Task capability went up, but did the capability to improve the system also go up? Next time I see a "self-evolving" demo, that is the first question I will check.

Weco's experiment has two layers of work. The inner Agent performs research tasks, while the outer Agent modifies the inner Agent's code and decides which version to keep based on evals. Both layers use fixed base models; the changes happen in the search, context management, and verification logic wrapped around those models.

![Observing the target of improvement separately from the improver](/posts/images/recursive-self-improvement-evidence/recursive-self-improvement-evidence-01.png)

Modifications like these can genuinely raise system capability. Between what a model knows and what a system can finish sit plenty of engineering decisions. Pulling out relevant context, feeding failures into the next iteration, and spending budget on more promising attempts can all change how well the same model performs in practice.

So dismissing all progress on the grounds that "the weights didn't change" doesn't explain the experimental results either. A research system completing more effective experiments under the same budget is already a capability gain worth acknowledging.

Still, the fact that the models are fixed cannot be glossed over. What is shown here is the improvement of an Agent system, not a base model completing a new round of training on its own. Writing the two as the same thing misleads readers about which part actually changed.

More importantly, did the process generating the improvements upgrade along with it?

An automated optimizer finding faster implementations over successive steps is not surprising. It can be driven by the exact same search process the entire time, simply refining the target being searched. Better targets do not automatically mean a stronger search process.

Recursive self-improvement draws attention because it proposes that second possibility: that the output of improvement feeds back to strengthen the next round of research, making subsequent improvements more effective. To verify that, you have to put the upgraded system back into the researcher's seat and compare it against the original researcher.

Weco placed an intermediate version, AIDE₄₇, in the outer role and compared it against the research Agent developed by the team. Each group ran three random seeds for 50 steps, reaching similar final levels. The upgraded version's average curve approached the final score earlier, but with too few samples and high variance, it cannot yet be confirmed as a more efficient improver.

![Re-testing the upgraded version as the improver](/posts/images/recursive-self-improvement-evidence/recursive-self-improvement-evidence-02.png)

That sentence bounds what this experiment can establish. It does not prove future systems won't get there, nor does it prove current systems have entered self-acceleration.

**A system getting better and a system getting better at making itself better require two different pieces of evidence.**

"The loop is running" only tells you that attempts are happening continuously. Whether valid improvements can be identified, retained, and put to work in the next round is what determines what the loop actually accumulates.

If the evaluation benchmark stays fixed on a few familiar problems, rising scores may simply reflect adaptation to those problems. Only when gains hold up on unseen tasks is there stronger reason to believe the system found a transferable approach.

If each upgrade uses more calls and longer runtimes, the curve can also climb. That shows higher output from higher input, not necessarily more improvement per unit of research cost.

Budget and transferability therefore need to be read alongside scores. They turn "better than the previous version" into a conditional, checkable claim rather than a showcase of the best single run.

The phrase "self-evolving" also tends to hide another piece of work: who decides what the system should optimize for.

A system needs a standard for comparing candidates. Humans choose the tasks, set the budget, define what counts as success, and check whether the eval misses capabilities that actually matter. Those choices directly determine which versions survive.

Whenever an eval metric leaves a loophole, search learns to game it—for example, writing patches tailored solely to pass a specific test and boost its score. Humans have to keep auditing and patching the criteria to keep the system from routing around the real problem.

Having an Agent edit the code does not make those trade-offs disappear. Whatever the eval overlooks, automated optimization is likely to overlook too.

For practitioners, this distinction is also practical. When an Agent automatically improves its own workflow, you can adopt that useful change right away. There is no need to simultaneously believe it can now keep upgrading itself unattended.

Next time I see a pitch for recursive self-improvement, I will split the claim and check three things: whether the new version holds its gains on tasks not used during optimization; whether comparisons account for the full budget; and whether it still holds an edge when put in charge of the next round of improvements.

If all that's shown is code edits and rising task scores, stop the conclusion at that capability gain.
