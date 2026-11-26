---
title: "I Had AI Review Its Own Code — for 10 Rounds"
summary: "I ran 10 rounds of AI code review on the same codebase with the exact same prompt, and every round uncovered new issues—because each refactor reshaped the code and exposed new seams. AI reviewing AI takes a stable rubric, patience to iterate, and a human to decide when to stop."
coverAlt: "I had AI review its own code for 10 rounds"
sourceHash: "a2ba72c53dad61cf"
---

On Saturday, March 28, at 8:32 a.m., I was on round 4 of code review with Codex.

I typed a message to it:

> We've already done several rounds of re-review, yet it seems we keep finding new issues every time.

I meant it as a question, but as soon as I sent it, I realized it was actually the **core** of this post.

Why can AI repeatedly find new issues in code it just reviewed? I didn't really understand this until I finished all 10 rounds myself.

And once I did, I ended up more optimistic about "AI reviewing AI" than when I started—while also having a much clearer sense of its boundaries.

---

## What this project is, and why I ran 10 rounds of review

Some quick background: this is a CLI tool I wrote for querying internal financial data APIs at work. Python + Typer + uv—a fairly standard Python CLI project.

I started on March 5, and the core functionality was done by March 12—8 days and 39 sessions with Codex. Then I set it aside for 16 days.

Why? Because I believe code needs time to "settle." During those 16 days, I used it myself to look up data, hit endpoints, and step on the rakes I had left behind. That real-world usage became new input.

By the morning of March 28, I decided to go back and review it properly. From 7:49 a.m. to 10:18 a.m., **I ran 10 rounds of review in total**. Every single round used the exact same prompt:

```
$friendly-python $piglet  review code: poor module splitting, monolithic files, high cyclomatic complexity.
```

`$friendly-python` and `$piglet` are two Python-related skills—one focused on judging boundaries and change points, the other on branch flattening and tightening conditionals. Put together, they formed the "ruler" for this review.

Notice: **I did not change the prompt between rounds.** That was deliberate.

---

![Ten-round iterative spiral, each round highlighting different findings](/posts/images/ai-review-ai/ai-review-ai-01.png)

## Round 1: It found the "duplicated rendering skeleton" first

In round 1, Codex started by measuring the repo with `wc -l` and branch counts, and zeroed in on three command files: `obj.py`, `subject.py`, and `index.py`.

These three files implement the `obj`, `subject`, and `index` query commands. Each command has to support JSON, CSV, and Table output formats; each also handles username caching and render metrics.

Codex's review report came down to this: **about 60% of the code across these three files is doing the exact same thing, just calling a different service**.

Its proposal: extract a `commands/_common.py` to consolidate output rendering and metrics reporting into one place, leaving each command file with just parameter definitions and service dispatch.

I looked over the plan, agreed with it, and told Codex to go ahead. After making the edits, it ran the full test suite—all 210 tests passed.

I thought that wrapped up the round.

---

## Round 2: It dug up the landmine it had just buried

For round 2, I opened a fresh session with the same prompt. This time, the "large files and high complexity" it flagged were different from the first round. I told it to make a plan based on what it found and implement it step by step.

It split up a batch of modules and ran the tests. Something broke:

```
FAILED tests/unit/test_output_formatters.py::
  test_build_table_from_response_respects_select_order_and_shows_sort
  - RecursionError: maximum recursion depth exceeded
1 failed, 209 passed in 1.47s
```

Out of 210 tests, 209 passed and 1 failed. `RecursionError`.

I pasted the failure output back to Codex and told it to track down the cause. It inspected `formatters/table.py` and came back with something I didn't expect:

> The issue is in the timezone compatibility hook in `table.py`. Earlier, to stay compatible with monkeypatching in the tests, I pointed `table_rendering`'s timezone implementation back to the facade layer, while the default branch routed back into the wrapper function itself, causing infinite recursion on the `DateTime` rendering path.

In plain English: **in round 1, to avoid breaking tests, it added a compatibility hook. That hook wasn't exercised normally, so the tests didn't hit it. In round 2, moving code around tripped right over it—and then in round 2, it dug its own landmine back out.**

It wrote the fix itself too. Afterward, all 210 tests passed.

That made me pause.

We all know AI writes bugs. We've all heard the claim that "AI can't fix its own bugs." **What I saw in that moment was the opposite**: AI buried a landmine in round 1, caught that same landmine itself in round 2, and fixed it.

What was my role in all of this? I copy-pasted the test failure verbatim. Nothing more.

---

![Codebase refactored from monolithic files into layered modules](/posts/images/ai-review-ai/ai-review-ai-02.png)

## Rounds 3 to 6: Every round uncovered something completely different

Here is what Codex found in the next few rounds, **measured with the exact same prompt**:

- **Round 3** (8:21): `logging_setup.py` jammed four concerns—logging setup, formatting, state management, and utility functions—into one file. It needed to be split into four focused modules (`logging_state.py`, `logging_formatter.py`, `logging_utils.py`, and `logging_setup.py`) with the main file acting as a facade.
- **Round 4** (8:32): Mixed responsibilities in the service layer. `query_service.py` handled both `obj` and `subject` queries and needed to be split into `object_query_service.py` and `subject_query_service.py`, with shared parts extracted to `query_payloads.py`.
- **Round 5** (8:49): After restructuring the command skeleton in earlier rounds, I thought we were done. Codex scanned again: wait, **we missed `iid.py`**. That command was still using the old pattern and hadn't been aligned with the new structure. I felt a bit deflated—we'd already standardized this, how did one slip through? Codex's answer: earlier rounds focused on splitting large files, and this file was small enough that it didn't rank high enough in priority. It wasn't overlooked; it just hadn't made the cut yet.
- **Round 6** (9:03): The `index` and `subject` command files could be split further into three layers: a thin entrypoint, parsing, and execution.

By round 4, when I sent that message—**"We've already done several rounds of re-review, yet it seems we keep finding new issues every time"**—

it didn't give me some feel-good platitude about how "AI gets better the more it reviews." Instead, its answer amounted to this:

> Because each round of refactoring redraws module boundaries. New boundaries create new seams, and those seams expose designs that looked reasonable under the old structure. That isn't a shallow review—that's the structure itself evolving.

I read that twice.

It's pointing out a simple truth: **review isn't a one-off event; it's iterative**. Once you refactor, the "shape" of the code changes, and problems that used to be hidden come into view. A design that worked fine before may no longer work in the new shape.

I already knew that in theory. What I hadn't realized was that **"AI reviewing AI" naturally fits this iterative loop**. AI doesn't get fatigued or think "I already checked this file." Every time, it reads from scratch and measures everything again against the rubric you gave it.

---

## Rounds 7 to 9: Honestly, I wanted to stop

By round 7 (9:34), I was starting to second-guess myself—should I stop here? Six rounds had already produced a lot of refactoring, and the code was much cleaner than when the core features finished 8 days ago. Would pushing further just be busywork?

I ran one more round anyway.

This time Codex flagged `config_store.py`—a file that had always looked "good enough." It packed five separate responsibilities into a single `ConfigStore` class: value serialization, coercion, flattening, layer merging, and dotted-key checks. The first six rounds left it alone because there were bigger fires elsewhere, making this file look fine by comparison.

By round 7, with the other parts cleaned up, it had become the heaviest file left in the repo.

After splitting `config_store.py`, **I kicked off round 8**.

Round 8 caught something subtler: **query summaries were implemented independently across three different formatters**. Each formatter had its own copy of condition rendering, logic expansion, and sort-field parsing. The first seven rounds missed it because they were focused on "files that are too big," whereas this was duplicated logic spread across three files that were each small on their own.

Round 9 found that `where`/`cond` parsing had separate rule definitions in the command layer and the service layer, and needed a single source of truth.

At that point, **I had to admit it was finding genuinely new things every round**, and none of them were obvious from the previous round's vantage point. It wasn't AI slacking off—**structural evolution was bringing new issues to the surface**.

---

## Round 10: `just isok` passes

At 10:06 a.m., in round 10, I had Codex run my full verification command `just isok`—running `ruff`, `pyright`, `ty`, and `pytest` end to end.

The result: **all 221 tests passed, with 92% coverage**.

Notice that number: we started round 1 with 210 tests. Ten rounds later, there were 221. **Those extra 11 tests were regression tests added by the AI itself during the review**—every time it uncovered a new edge case, it wrote targeted tests to lock in the behavior.

That's when it clicked for me: **the output of 10 rounds of review isn't just "better code"—it's also "more tests."** In every pass, the AI was turning its findings into trackable regression tests.

That was a byproduct I hadn't anticipated.

In the afternoon, I started one more session (session #50) to update `README` and `AGENTS.md` to match the latest code. That closed out March 28 for this project.

---

![AI looking into a mirror to self-review, with three objects on the desk: a ruler, an hourglass, and a wrench](/posts/images/ai-review-ai/ai-review-ai-03.png)

## So, is "AI reviewing AI" actually reliable?

Coming back to the question at the top, here is my verdict:

**AI reviewing AI is not "send a prompt and let AI glance at it."** It requires three things at the same time: a stable ruler (`$friendly-python $piglet`), the patience to measure repeatedly (10 rounds, 2.5 hours), and the follow-through to actually apply the fixes. Reviewing without fixing is worth zero.

**AI beats humans at parts of this, but a human has to decide when to stop.** It doesn't get tired of rereading code it just saw, and it won't cut corners on running tests. Left unchecked, though, AI can review forever and keep finding new things every round. Whether a fix is worth making—and how far to take it—is your call. I nearly stopped at round 7 and gambled on one more; at round 10 I decided to stop. Neither of those calls came from the AI.

**What's actually valuable is your ruler.** Those two skills weren't whipped up on the spot—they were honed over time. AI's default review perspective is so generic it's barely a review at all. Spend the time up front to decide what standards you want AI to measure your code against. Writing those standards down is where the real work begins.

---

## One last thing

![Metaphor of settling: sediment layers in a glass jar alongside a 16-day calendar](/posts/images/ai-review-ai/ai-review-ai-04.png)

That evening, I took a screenshot of `git log` from March 5 to March 28: core features built in 8 days, then a 16-day gap, then 11 commits in a single day on March 28.

I stared at that chart for a while.

The mainstream narrative says AI makes writing code fast. What my 10 rounds of review showed me is this: **writing is fast; reviewing is slow**. Most people skip the review time. That's not efficiency—that's debt.

Those 16 days weren't empty either. I spent them querying data, hitting edge cases, and letting the code settle. Without that settling period, the 10 rounds of review on March 28 wouldn't have found nearly as much.

---

*Next post will be about those 16 days—without them, these 10 rounds would have been empty.*
