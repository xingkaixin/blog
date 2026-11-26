---
title: "AI Built Another Helper: Search the Repo Before Writing Code"
summary: "Before an AI adds a helper, have it search the repo for existing implementations with the same responsibility and explain whether to reuse or create a new one, catching duplicate abstractions before code generation."
coverAlt: "AI Built Another Helper: Search the Repo Before Writing Code"
sourceHash: "8b3e815d20a53c62"
---

When a TypeScript project has been running long enough, you might see something like this in the repo: `isObject`, `isPlainObject`, `isRecord`, `isDictionary`—different names doing roughly the same thing. They sit in four separate directories, each only a few lines long, and each looks reasonable on its own.

A few months later, an Agent picks up a new task and writes the exact same check in a fifth directory.

This kind of duplication is hard to catch during the task itself. Tests pass, types check out, and the PR even looks clean. The problem only surfaces the next time a rule changes: you have to update the same logic in five places, and each one has a slightly different idea of what an "object" is.

The Agent isn't trying to reinvent the wheel. It simply completed the local task you gave it, because you didn't ask it to look at what's already in the repo first.

## Right in Isolation, Wrong Together

In the summer of 2026, `isRecord` suddenly became a meme around Codex-generated code. Many developers found the function popping up everywhere in their repos, and some even used this command to measure how much of their codebase it had taken over:

```bash
rg -o 'isRecord' . | wc -l
```

Following the meme, the tldraw team searched back and found they had written a version of `isRecord` back in 2022. Searching further on GitHub turned up tldraw and its forks at the top, followed by a growing wave of Codex-generated code. It's hard to prove whether that was the sole source of the model's preference, but one pattern is clear: models bring their own familiar idioms into your repository.

![The tldraw team tracing the origin of isRecord](/posts/images/search-before-create/source-tldraw-isrecord.png)

There's nothing inherently wrong with that. Humans also bring habits from their last company when writing code. The difference is that Agents generate code much faster. A single default idiom can spread across a dozen files in a few days, whereas humans usually only notice the duplication later during maintenance.

A snippet that looks right inside its own file might already be the sixth copy in the repo. Looking at those five lines alone isn't enough to decide whether a helper should be added—you have to check whether something with a different name and the same responsibility is already sitting in the repo.

![The fifth copy looks reasonable too](/posts/images/search-before-create/search-before-create-01.png)

## Make "Search First" Part of the Task Order

The lightest fix isn't a repo-wide refactor. It's adding a search step before anything new gets written.

```text
Before adding a new helper, component, type, or shared function, search the repository to see if an implementation with the same responsibility already exists.

List the following first:
- Candidate implementations found and their locations;
- How they differ from the current requirement;
- Why they can be reused, or why a new one is necessary.

Do not create a new abstraction until this step is complete.
```

You can't just search by name here. An existing function might be called `isDictionary`, while the new task reaches for `isRecord`. Running a single exact-text search makes it easy to conclude that nothing exists.

A more reliable order is to search by concept first, then by usage. If you want to add a date formatting function, search for the date library, `format` calls, and how existing pages render dates. If you want to add an empty-state component, look at how neighboring pages handle missing data instead of only searching for the name `EmptyState`.

Agents are well suited for this. They can inspect symbols, call sites, and page structures at the same time, then lay out the closest matches. You don't have to flip through files one by one—you just need to judge whether the candidates it found actually share the same responsibility.

![Four-step search before creating](/posts/images/search-before-create/search-before-create-02.png)

## Reuse Doesn't Mean Cramming Into Old Code

"Search first" can also swing to the opposite extreme: to prove it's following the reuse rule, an Agent forces a new requirement into a barely related old function, tacking on four parameters and three branches.

That's why the search has to be followed by explaining the differences.

Suppose the repo already has an `isRecord` that only accepts internal business records with `id` and `type` fields, while the new task needs to check an arbitrary JSON object. The names are close, but the semantics differ. Reusing the old function would blur the boundary; adding a more accurate implementation is the right call here.

To decide whether to reuse, look at three facts: whether the input/output semantics match, whether the reasons for change match, and whether they should change together in the future. If you can't answer yes to at least two of the three, don't force a merge just to keep the file count down.

So don't just give an Agent a vague "reuse where possible." "Where possible" has no boundary, leaving it to guess. Find candidates first, then explain the differences—that gives human judgment something concrete to work with.

## Surface Duplication Before Generation

If a project has already accumulated a batch of duplicate implementations, start with high-frequency patterns instead of cleaning up everything at once. Use `rg` to find common helper names, similar error handling, and repeated constants, pick the ones most likely to keep spreading, and consolidate them into explicit shared entry points.

Then write those entry points into your project rules: where dates live, which module handles permission checks, how API errors are constructed. The rules don't need to be long—one path plus one sentence on purpose is far more useful than "keep code consistent."

An Agent will diligently finish the single file in front of it. Repo-wide consistency still depends on someone setting the order of operations for it.

Searching once more before writing new code rarely just saves the five lines in front of you—it saves the round of rework months later when you have to maintain five different names for the same thing.
