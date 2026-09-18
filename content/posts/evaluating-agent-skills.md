---
title: '开源仓库里 4 万多个 Skill，为什么 99% 都经不起自动化测试？'
date: '2026-09-16'
summary: 每个人都在写 Agent Skill，却几乎没人给它写测试。当 Skill 仅靠直觉验收，极易频繁误触发并消耗 3 倍 Token。拆解如何用 15 个用例搭建轻量级 Skill Eval。
tags:
  - Agent
  - AI编程
  - 软件测试
cover: evaluating-agent-skills.png
coverAlt: '开源仓库里 4 万多个 Skill，为什么 99% 都经不起自动化测试？'
---

上周在排查一个项目的构建脚本时，发现终端里的 Agent 突然表现得极不正常。

我只是让它“把本地的一个 JSON 配置文件格式化一下”，它却非常殷勤地拉起了一个庞大的数据库迁移 Skill，开始在仓库里疯狂搜索 SQLite 表结构，顺便调用了五次文件系统扫描，硬生生消耗了我上万个 Token。

去翻这个 Skill 的 `SKILL.md`，开头的描述写得极其宽泛：

```yaml
---
name: schema-migration-helper
description: 帮助处理各种配置文件、数据结构与数据库 schema 的变更和格式化任务。
---
```

作者在写完这个 Skill 后，随手在本地试了一句“帮我改下数据库字段”，看到能跑通，就觉得大功告成并把它推上了仓库。

学术界近期在 SkillsBench 的一项统计中发现：开源社区 6300 多个仓库里已经堆积了超过 47,000 个独立的 Agent Skill。

但这里面超过 99% 的 Skill，从来没有经历过任何一次自动化测试。

软件工程师不会在没有单元测试的情况下把核心业务代码推向生产；但在面对直接控制大模型执行路径的 Agent Skill 时，大家却普遍停留在“手动跑一两次、感觉差不多就发版”的直觉验收阶段。

## 直觉验收的 Skill，藏着三大隐患

一个在本地随手跑通的 Skill，在复杂工程环境里往往极其脆弱：

1. **过度触发与能力抢占**：因为 YAML 前置元数据里的 description 过于泛化，模型面对日常简单任务时也会误激活该 Skill，强行抢占宝贵的上下文。
2. **静默输出废弃 API**：随着大模型版本与第三方 SDK 迭代，写死在示例里的函数早已被官方废弃。模型在旧指令误导下，会顽固地生成带过期参数的代码。
3. **Token 账单膨胀**：未经测试的 Skill 容易诱导模型调用多余工具，在无关文件间来回跳转，消耗数倍的调用成本。

要让团队的 Skill 库成为可靠资产，必须给它建立一套可重复运行的轻量 Eval。

## 测试 Skill 的三大原则

给 Agent Skill 写测试，逻辑和传统的单元测试不同。核心在于守住三个边界：

### 1. 检验最终产物，不追踪中间路径

大模型具有随机性与推理空间，它可能通过不同路径得出正确答案。

测试不需要断言它先调用了 `grep` 还是 `read`，而是断言可量化的交付结果：生成的代码能否通过编译器检查、类型是否合规、关键依赖是否命中了最新 SDK。

### 2. 负向测试是第一防线

传统单测验证“输入 A 得到结果 B”，但在 Skill 测试里，负向测试的权重更高。

必须准备 2 到 3 个完全无关的日常任务（比如“写一个快速排序”或“调整前端按钮边距”）。把这些任务喂给 Agent，断言当前 Skill **绝对不被激活**。只有通过负向测试，才能证明 description 划清了触发边界。

### 3. 监控 Token 水位与调用频次

测试脚本需要记录每次运行的 `total_tokens` 和耗时。如果对文档的一次修改虽然让功能跑通，却让平均 Token 消耗翻了三倍，这本身就是严重的质量倒退。

## 15 个用例搭建轻量 Eval

搭建自动化测试并不需要引入庞大框架，一个测试用例列表加几行断言脚本就足够运转。

标准 Skill 准备 10 到 15 个用例即可覆盖大部分场景：
- **核心功能用例（5-7 个）**：验证基础业务目标能否交付；
- **废弃 API 护栏用例（3-4 个）**：断言产物不包含已被弃用的旧函数与旧参数；
- **边界输入用例（2-3 个）**：传入残缺上下文，验证 Agent 能否主动询问缺失信息；
- **负向控制用例（2-3 个）**：确保无关任务不会误唤醒该技能。

![Skill Eval 用核心、废弃 API、边界和负向用例共同验收](/posts/images/evaluating-agent-skills/evaluating-agent-skills-01.png)

利用本地 CLI 批量执行用例，核心只做两层确定性断言：

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

把这套脚本挂进 GitHub Actions。每当团队修改 `SKILL.md` 时，CI 自动跑一遍测试集。只有核心能力通过、负向测试零误触发、且 Token 消耗平稳时才允许合入。

**从凭感觉写提示词，到用可复现的自动化测试守护质量，这是把 Agent 推进到严肃生产时必须补齐的底线。**
