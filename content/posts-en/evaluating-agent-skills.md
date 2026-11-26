---
title: "Over 40,000 Skills in Open-Source Repos—Why 99% Fail Automated Testing"
summary: "Everyone is writing Agent Skills, yet almost no one tests them. Relying on gut-feel checks leads to frequent false triggers and 3x token burn. Here is how to build a lightweight Skill Eval with 15 test cases."
coverAlt: "Over 40,000 Skills in Open-Source Repos—Why 99% Fail Automated Testing"
sourceHash: "bb216d7155f15d70"
---

Last week, while debugging a project's build script, the Agent in my terminal suddenly started acting erratically.

I only asked it to "format a local JSON config file." Instead, it eagerly pulled up a massive database migration Skill, started frantically searching the repository for SQLite table schemas, and ran five file-system scans—burning through over ten thousand tokens.

I checked that Skill's `SKILL.md` and found an overly broad description right at the top:

```yaml
---
name: schema-migration-helper
description: 帮助处理各种配置文件、数据结构与数据库 schema 的变更和格式化任务。
---
```

When trigger boundaries are unclear, check [how description and Skill files are organized](/en/posts/skill-is-a-folder/) first, then verify with negative test cases.

After writing this Skill, the author probably ran a quick local test like "help me modify a database column," saw it work, called it a day, and pushed it to the repo.

A recent academic study from SkillsBench found that over 47,000 standalone Agent Skills have already accumulated across more than 6,300 open-source repositories.

Yet over 99% of these Skills have never gone through a single automated test.

Software engineers would never ship core business logic to production without unit tests. But when dealing with Agent Skills that directly control an LLM's execution path, most people still rely on gut-feel checks: "run it once or twice manually, feels good enough, ship it."

## Three Hidden Risks of Gut-Feel Skill Checks

A Skill that passes a quick local run is often fragile in real-world engineering environments:

1. **Over-triggering and capability hijacking**: When the `description` in the YAML frontmatter is too generic, the model mistakenly activates the Skill on simple everyday tasks, eating up valuable context.
2. **Silently outputting deprecated APIs**: As LLMs and third-party SDKs evolve, functions hardcoded in examples become obsolete. Misled by outdated instructions, the model stubbornly generates code with deprecated parameters.
3. **Bloated token bills**: Untested Skills easily nudge the model into calling redundant tools and jumping between unrelated files, multiplying call costs several times over.

To turn a team's Skill library into a reliable asset, you need a repeatable, lightweight Eval.

## Three Principles for Testing Skills

Writing tests for Agent Skills follows a different logic from traditional unit tests. The key is holding three boundaries:

### 1. Verify the Final Output, Not the Intermediate Path

LLMs are stochastic and have room to reason—they can reach the right answer through different paths.

Your tests do not need to assert whether the model called `grep` before `read`. Instead, assert measurable deliverables: does the generated code pass compiler checks, are the types valid, and do key dependencies target the latest SDK?

### 2. Negative Testing Is the First Line of Defense

Traditional unit tests verify that "input A produces output B." In Skill testing, negative tests carry even more weight.

You need 2 to 3 completely unrelated everyday tasks (such as "write a quicksort" or "adjust frontend button padding"). Feed them to the Agent and assert that the Skill **never activates**. Only by passing negative tests can you prove the `description` draws a clean trigger boundary.

### 3. Monitor Token Usage and Call Frequency

Your test script should log `total_tokens` and elapsed time for each run. If a doc tweak keeps the feature working but triples average token consumption, that is a serious quality regression.

## Building a Lightweight Eval with 15 Test Cases

Setting up automated tests does not require a heavy framework. A list of test cases plus a few lines of assertion scripts is enough to get running.

For a standard Skill, 10 to 15 test cases cover most scenarios:
- **Core functionality cases (5–7)**: Verify that basic business goals are delivered.
- **Deprecated API guardrail cases (3–4)**: Assert that the output contains no deprecated functions or parameters.
- **Edge-case input cases (2–3)**: Pass incomplete context and verify that the Agent proactively asks for missing information.
- **Negative control cases (2–3)**: Ensure unrelated tasks never accidentally trigger the Skill.

![Skill Eval combining core, deprecated API, edge-case, and negative test cases](/posts/images/evaluating-agent-skills/evaluating-agent-skills-01.png)

Run the cases in batch via a local CLI, focusing on two deterministic assertion layers:

```python
def evaluate_case(test_case: dict, output: dict):
    # 负向测试：无关任务绝不激活当前 Skill
    if test_case.get("must_not_trigger"):
        assert "schema-migration-helper" not in output.get("applied_skills", [])
        return

    # 结果断言：检查结构并拦截已废弃的实现
    code = output.get("response_text", "")
    assert re.search(r"class\s+AddAvatarUrl", code), "缺失目标类定义"
    assert "deprecated_sql_helper" not in code, "命中了废弃实现"
```

Hook this script into GitHub Actions. Whenever the team edits `SKILL.md`, CI automatically runs the test suite. Changes only merge when core capabilities pass, negative tests have zero false triggers, and token consumption stays steady.

**Moving from writing prompts by feel to guarding quality with reproducible automated tests is the baseline you have to meet before bringing Agents into serious production.**
