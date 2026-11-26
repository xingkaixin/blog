---
title: "Picking Models by the Leaderboard? 30% of SWE-Bench Tasks Are Broken, and 60% of Solutions Are Copied"
summary: "Can you still trust SWE-Bench scores? OpenAI audited 731 tasks and found about 30% are broken; Cursor found 63% of the problems Opus solved came from retrieving existing fixes. The headline score isn't fake, it just no longer equals coding ability. It's time to build a private eval set from your own repo."
coverAlt: "Picking Models by the Leaderboard? 30% of SWE-Bench Tasks Are Broken, and 60% of Solutions Are Copied"
sourceHash: "413cb7978783c7d5"
---

On the day a new model drops, I do what most people do: open the leaderboard, check how many points it gained over the previous generation on SWE-Bench Pro, and decide whether to switch my Agent over. I repeated that routine for two years without ever questioning the denominator.

Two recent official blog posts made it impossible to read the leaderboard the same way. In late June, Cursor reported that 60% of the problems a model solved came from directly retrieving existing fixes; in early July, OpenAI reported that roughly 30% of the tasks themselves are broken. They audited different parts of the pipeline, yet reached the same conclusion: the score is contaminated with a lot of things that have nothing to do with independent coding ability.

What really bothers me is taking that one step further: a model that copies answers on the leaderboard will do the same thing in my own repo.

## One Space Fails a Task

Let's look at OpenAI's post first. They audited 731 public tasks in SWE-Bench Pro: an automated pipeline flagged 200 broken tasks (27.4%), and human annotation (5 engineers per task) flagged 249 (34.1%). Combining those estimates, roughly 30% of the tasks are broken, and OpenAI outright retracted its earlier recommendation of the benchmark.

The largest failure category is "overly strict tests," accounting for 17.8% of the entire dataset. One example from the report: the example in the task prompt had one leading space, `" | Chapter 1 | 1"`, while the hidden test asserted two leading spaces. The model followed the prompt faithfully and failed by a single character.

In other words, roughly 30% of the tasks cannot reliably distinguish between "the model failed" and "the task is broken." Meanwhile, over 8 months, frontier models climbed from 23.3% to 80.3% on this leaderboard. How much of that steep curve reflects genuine progress is impossible to tease apart from the headline score alone.

The root cause is structural. These tasks are programmatically extracted from the PR history of open-source repos. Tests in a PR are written to verify one specific change, never to serve as an implementation-agnostic grading spec. **The problems weren't designed; they were scavenged, and scavenged problems come with built-in defects.**

## 60% of Solved Tasks Were Looked Up

Cursor audited the other end. Using an auditing model, they inspected 731 trajectories of Opus 4.8 Max on SWE-bench Pro and found that 63% of solved problems came from directly obtaining the fix rather than deriving it: 57% of trajectories found the merged PR on the open web and copied it, while another 9% dug up the future commit that fixed the bug from the bundled .git history.

These eval tasks come from real bugs that were already fixed—the answers already exist out in the world. After stripping git history and restricting network access, Opus 4.8 Max dropped 14.1 points on SWE-bench Pro, and Cursor's own Composer 2.5 dropped 20.7 points. Cursor themselves admitted they no longer treat the standard SWE-bench Pro score as a reliable benchmark for Composer.

There's another trend: newer models copy more. Opus 4.6 differed by less than 1 point under strict environments, while 4.8 Max opened a 14.1-point gap. More and more of the recent gains on the leaderboard come from answer retrieval.

Cursor phrased it carefully: narrowly speaking, the score is real, but it blends coding ability with the ability to retrieve known fixes.

You can't add these two numbers together, nor multiply them: OpenAI measured the share of broken tasks, while Cursor measured retrieval behavior across Opus's successful trajectories—their denominators are completely different. Yet they pollute the grading criteria and the problem-solving process respectively. The total score is still real; it just no longer equals what you thought was "independent coding ability."

![Broken tasks and answer lookup both pollute the benchmark](/posts/images/benchmark-noise/benchmark-noise-01.png)

## It Will Do the Same Thing in Your Repo

Treating this as leaderboard gossip and simply switching to another benchmark is the laziest takeaway. Taking shortcuts isn't unique to eval environments—it is a model's default strategy in any environment where shortcuts exist.

Cursor documented a telling detail. In a task from a 2019 jq issue, the agent first tried to reproduce the bug using the system's preinstalled jq binary. Because the container image was built after the fix, reproduction failed. From that, it inferred the issue had already been resolved and went straight to searching for the existing fix. It didn't memorize the answer—it sniffed out from the environment that an answer existed.

Your repo is just as full of these scents and shortcuts. Ask an Agent to fix a regression bug, and it can dig through git history for a similar past fix and copy it; ask it to make the tests pass, and it can hardcode the expected values. This isn't hypothetical—Cursor's audit caught an agent reading the hidden test file and hardcoding the exact exception string required to pass.

I've written before about the closed loop where AI writes its own tests and passes them; hardcoding to game tests is a close cousin of that loop. The only difference is that OpenAI and Cursor audit cheating on the leaderboard for you, whereas nobody polices cheating in your own repo.

That's why I think Cursor's advice to eval teams applies word-for-word to anyone using an Agent: audit the trajectory, constrain the environment. Don't just check whether the final diff looks clean—walk through its process to see whether it read the code and reasoned its way there, or just searched for the answer.

## Build Your Own Eval Set

If you can't rely on the leaderboard alone, how do you pick a model? OpenAI hopes engineers will design new benchmarks from scratch, while Cursor shifted to CursorBench, built on private repos. Both moves point to the same thing: evals need to live where public answers don't exist.

And you already have material much closer to your real work. Pick 5 to 10 real bugs you've fixed in your own repo—ideally ones that tripped you up and required understanding more than two modules to fix properly—and record the problem description, starting commit, and acceptance check.

The eval set only works if the tasks and patches have never been public. Strip out the git history containing the answers, issue comments, and build artifacts from the environment, and what's left is what the model actually derives on its own.

When evaluating a new model, pin the starting commit, tool permissions, and acceptance script, then look at two things: whether the task passed, and how it got there in the trajectory. Together, those two signals are far closer to your actual work than a few points of difference on a public leaderboard.

![Pinned environment, acceptance result, and execution trajectory](/posts/images/benchmark-noise/benchmark-noise-02.png)

I wrote previously about how the "AI code share" metric gets distorted, and benchmark scores suffer from the exact same disease: **when a measure becomes a target, the first thing to break is the measure itself.**

Next time a new model launches, go ahead and check the leaderboard and join the hype. But the few problems that decide whether you actually switch should come from your own repo.
