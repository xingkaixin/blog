---
title: '我同时用Claude Code和Codex开发：工具是壳，模型才是核'
date: 2026-04-02
summary: Cursor、Claude Code、Codex 是交互界面（壳），背后的大模型才是核心（核）。通过 Fin-Agent 的开发实录，总结出多模型调度的决策逻辑：生态绑定优先，灵活切换次之，成本最后——Agentic 时代工程师的核心竞争力是调度能力，不是工具忠诚度。
tags:
  - Claude Code
  - Codex
  - 模型调度
  - AI编程
cover: /posts/cover/model-core-tools-shell.png
coverAlt: 我同时用Claude Code和Codex开发：工具是壳，模型才是核
---

# 我同时用Claude Code和Codex开发：工具是壳，模型才是核

**Agentic时代工程师生存手册 · 工具篇**

---

经常有人问我："Claude Code和Cursor哪个更好用？"

我通常会说：这个问题本身可能就问偏了。

就像开车，方向盘手感重要，但真正决定性能的是引擎。Cursor、Claude Code、Codex、Windsurf这些是交互界面（壳），背后的大模型——Claude、GPT、Gemini——才是核心（核）。壳决定你怎么跟AI交互，但最终代码写得好不好、理解需求准不准、debug能不能一次到位——这些全看核。

想明白这件事，比选对工具重要十倍。

![壳与核](/posts/images/model-core-tools-shell/model-core-tools-shell-01.png)

---

## Cursor的定价策略

如果你还纠结"壳和核谁更重要"，看看Cursor的定价就懂了。

Cursor允许你切换底层模型——用它自研的，或者Claude、GPT来驱动。如果壳足够强，为什么要让用户换核？

定价也很有意思：Auto模式最便宜，Cursor自动帮你路由，简单任务用轻量模型，复杂任务用强模型。但手动指定Claude或GPT的最新模型，价格明显上升。

翻译一下：我们自己的核不够强，所以在壳的层面做智能调度。但想用真正强的核，得加钱。

Cursor骨子里想做核，但壳才是主业。它知道如果只做个壳，护城河太浅，所以拼命用Auto路由、自研模型来增加壳的价值。

但Claude Code和Codex不一样——壳和核一家的。模型厂商对自己的模型理解最深，调优最细，配合度第三方很难复制。

Cursor的壳确实优秀，IDE集成体验顺。但壳核一体的产品越来越成熟，纯壳会越来越难做。

**核决定壳。**

---

## 我的Fin-Agent开发实录

理论说多了没意思，聊聊我踩过的坑。

11月初开始写一个金融问答工具Fin-Agent，用Claude Agent SDK。SDK当时做了更名，有很多迁移调整的工作，还很新，文档也不全，踩坑是难免的。

一开始我全用Claude Code写。但很快发现额度不够用，很快触及到周限额。项目进度卡住，挺烦的。

后来把前端部分切到Codex。Codex 5月就发布了，我在10月开始了订阅，订阅方案量大管饱。前端组件、数据处理这些不涉及Claude Agent SDK的任务，丢给Codex + GPT-5-Codex处理，省心。

但一回到Agent的工具调用逻辑、对话流编排——这些跟Claude Agent SDK打交道的代码——Codex就抓瞎了。生成的代码经常漏掉关键参数，或者用了过期的API。新的SDK刚发布一个月，版本变动频繁（我从0.2.x升级到0.3.x时就遇到了几个breaking changes），Codex显然还没跟上。

于是形成了现在的分工：
- 后端Claude Agent SDK相关 → Claude Code + Claude 4.5 Sonnet
- 前端、通用逻辑 → Codex + GPT-5-Codex

![分工策略](/posts/images/model-core-tools-shell/model-core-tools-shell-02.png)

没人教我，纯是试出来的。

哦对了，不管用哪个，我都开着Zed编辑器盯着。AI写的代码不一定对，人得把关。

---

## 怎么选？我的决策逻辑

折腾了这段时间，我大概总结了三条：

**第一，看生态绑定。** 你的任务跟哪个厂商的生态绑得深？用Claude Agent SDK，Claude Code配Claude模型最合适，对自家API理解最深。深度用OpenAI的Function Calling，Codex加GPT模型更顺手。

通用任务——写React组件、处理数据——工具不那么关键。

**第二，保持灵活。** 别问"哪个模型最强"，这问题没固定答案。Claude长上下文理解好，但GPT-4o在某些编程场景更准。一个模型卡住了，换一个试试。很多时候问题就解开了，不是因为另一个更强，而是它提供了不同的视角。

**第三，成本。** Codex量大管饱，Claude Code额度紧。没明显偏好的任务，我丢Codex跑，把Claude的额度留给真正需要深度理解的场景。

![决策逻辑](/posts/images/model-core-tools-shell/model-core-tools-shell-03.png)

决策顺序：生态匹配 → 模型表现 → 成本。

---

## 你的核心竞争力，是调度能力

![工程师作为调度](/posts/images/model-core-tools-shell/model-core-tools-shell-04.png)

回到开头那个问题——"Claude Code和Cursor到底哪个好？"

这个问题其实没那么重要。更重要的是：

**你能不能用对手头的任务，快速判断该用什么模型组合？**

工具会迭代。今天的Cursor半年后可能大变样，今天的Claude Code明天可能就更新了。模型也在进化，每隔几周就有新benchmark。把工作流绑定在某一个工具上，等于在高速变化的领域里选了条死路。

聪明的做法是：把自己练成调度者。

了解每个模型的长处和短板，知道什么任务适合什么核，在壳之间灵活切。不用对任何工具忠诚，对问题保持敏感就行。

Agentic时代工程师的新姿态——不是"我是Cursor用户"或"我是Claude Code用户"，而是"我会调度模型"。

工具是壳，模型是核，工程师的核心竞争力在于调度能力。
