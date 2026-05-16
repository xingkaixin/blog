---
title: 你跟 AI 的每一次编码对话，都在悄悄消失
date: 2026-05-16
summary: 从 agent-dump 到 agent-view 再到 CodeSesh，我在"AI 编码 session 可视化"这个方向上折腾了挺久。这篇文章聊聊我为什么一直在做这件事，CodeSesh 到底解决什么问题，以及它跟 Spool 这类工具的区别在哪。
tags:
  - AI 编码
  - 开源
  - 开发工具
cover: /posts/cover/codesesh-ai-coding-sessions-disappearing.webp
coverAlt: codesesh-ai-coding-sessions-disappearing
---

我在"AI 编码 session 可视化"这个方向上已经做了好几个项目了。最早是 agent-dump——一个 Python 写的命令行工具，把 Claude Code、Codex 这些工具的 session 数据导出成 JSON 和 Markdown。后来觉得导出还不够，我想直接在浏览器里看，就做了 agent-view，一个纯前端的 session 回放页面。

用了一阵子之后发现这两个东西天然应该是一体的：扫描 + 可视化，分成两个项目反而增加使用成本。四月中旬我用 TypeScript 重写了整套逻辑，合并成了 CodeSesh。一条 `npx codesesh` 命令搞定扫描、索引、Web UI 启动。

## 我到底想解决什么

我现在主力用 Claude Code 和 Codex 写代码。每天产生的 session 数量不少，这些 session 里沉淀了完整的工程过程——agent 读了哪些文件、执行了什么命令、改了哪几行代码、中间推理链条是怎样的。但用完之后这些数据就沉在磁盘上了，基本不会再被翻出来。

我一直觉得这是浪费。git log 告诉你改了什么，但 session 记录的是你为什么这么改、中间走了哪些弯路。这些信息对我后续做类似任务有参考价值，但如果看不见、搜不到，跟不存在没区别。

## 跟 Spool 的区别

做 AI session 管理的不只有我。Spool 在这个方向上做得不错，如果你想搜到"我上周在某个项目跟 AI 聊了什么"，它的对话级检索体验很好。

CodeSesh 关注的粒度不一样。我想看到的不只是我和 AI 说了什么，而是 AI agent 在整个 session 里具体做了什么：调用了哪些工具、读写了哪些文件、推理过程经历了什么步骤。

举个例子：Claude Code 修一个 bug，一次 session 里可能读了十几个文件、尝试了两三种修法、跑了几轮测试才收敛。Spool 能帮你找到这次对话，但如果你想看到 agent 从读日志到定位根因到验证修复的完整操作链路，需要 CodeSesh 这个粒度。

两个工具解决的不是同一个问题。搜对话找 Spool，复盘过程用 CodeSesh。

## 自己怎么用

做了一个月，几个高频的使用场景：

按项目看 AI 协作时间线。同一个项目我用 Claude Code 做设计决策，用 Codex 做实现和审查，CodeSesh 按项目把不同 agent 的 session 归在一起，能看到一个完整的协作脉络。

回放某次任务的完整路径。有时候 agent 在一个 session 里的排查过程本身就有学习价值——它选择先看哪个文件、怎么缩小范围、为什么放弃第一种方案。这些在 git history 里完全不可见。

用量可见。每个 session 消耗了多少 token、用了哪个模型、估算花了多少钱，都能直接看到。我不是为了省钱，就是想知道自己每天在不同项目上的 AI 用量大概是什么量级。

## 试试

```bash
npx codesesh
```

自动扫描本机 session 数据，浏览器打开本地 Web UI。数据不出你的机器。

当前支持 Claude Code、Cursor、Kimi、Codex、OpenCode。代码开源，加新 agent 写一个适配器注册进去就行。

https://codesesh.xingkaixin.me

感兴趣的话跑一下看看自己的 session 全貌，有想法直接 GitHub 上开 issue 聊。
