---
title: 'DeepSeek Harness：我最想抄走的，不是它的插件系统'
date: '2026-08-13'
summary: DeepSeek Harness 把主循环也做成插件，但我更想抄走“模型可见即有日志”这条规则。本文沿开发笔记还原它的取舍，以及它离日常工具还有多远。
tags:
  - Agent
  - Coding Agent
  - 开源
  - 系统设计
cover: /posts/cover/deepseek-harness-133-plugins.png
coverAlt: DeepSeek Harness：我最想抄走的，不是它的插件系统
---

# DeepSeek Harness：我最想抄走的，不是它的插件系统

我跑起 `npx @deepseek-ai/dsh web`，进 Settings 打开 Plugins，页面列出 133 个插件。Bash、session、agent loop、sandbox、subagent、Web UI，全挂在同一棵树上。我的第一反应很直接：这也太重了。

接着我去翻 `.agents/notes`，本来只想查 Preset 怎么组装，却在 `2026-08-03-per-session-agent-presets.md` 里撞见一段内存测试：一个 Standard Agent 常驻约 1.31MB，50 个占用 57.8MB，dispose 后基本都能收回来。对象其实能回收，Host 只是从未对空闲 Agent 调用 dispose。

一份 Preset 设计记录会一路写到 GC 和所有权，这比“133 个插件”更能说明项目在做什么。仓库要求每个非平凡改动留下 Agent Note，我便顺着这些记录往回看。

注：本文基于 2026 年 8 月 13 日的代码和 `0.1.0-rc.6` 实测，项目仍是 developer preview。

## Harness 决定模型怎样工作

模型 API 根据消息返回文本或工具调用。Harness 决定每轮放进什么上下文、怎样执行工具、结果如何写回、失败后是否重试，进程退出后又怎么恢复。

同一个模型放进不同 Harness，表现可能差很多。我会先找三个答案：模型见过的内容能否追溯，工具和权限在哪里落地，任务结束后谁负责收尾。

填写 API Key、选择工作区都很正常。差距要到长时间运行后才出现：会话能否恢复，取消能否停干净，插件卸载后还剩什么。

![Harness 把上下文、工具、日志和恢复接成闭环](/posts/images/deepseek-harness-133-plugins/deepseek-harness-133-plugins-01.png)

## DeepSeek 的答案很重，也确实有新东西

DeepSeek Harness 建立在 Cordis 上。模型适配器、工具注册表、会话持久化、Agent loop 和 Web UI 都是插件。官方称之为“没有特权内核”；目前唯一的默认 loop 也可以替换。

每种能力又分成 Service Definition、Provider 和 Consumer。模型看到的 `bash` 不变，执行器可以换成本机、沙箱或远端。多个实现并存时，这个拆法很好用；以目前的包粒度，我不会在小产品里照搬，理解整张依赖图太贵。

![同一种 bash 能力可以替换本机、沙箱或远端执行器](/posts/images/deepseek-harness-133-plugins/deepseek-harness-133-plugins-02.png)

我更想抄的是另一条规则：模型看见的内容，必须能从 Session log 重建。请求头、工具调用、结果和中断的 step 都写进只追加的日志，下一轮消息再由日志推导。回放、排障和恢复共用同一份事实。

![模型可见事件进入同一份 Session log](/posts/images/deepseek-harness-133-plugins/deepseek-harness-133-plugins-03.png)

`cordis_inspect`、`cordis_mount`、`cordis_unmount` 允许 Agent 检查运行时，临时挂载插件，再完整卸载。它们默认关闭，权限接近 Bash，也不跨重启。我会把它留在开发模式。

## 这些设计是怎么长出来的

最早的方向写在 `2026-06-11-event-sourced-sessions.md` 和同日的 `2026-06-11-microkernel-event-taxonomy.md`：先让 Session 成为唯一事实来源，再让扩展通过 Cordis 事件进入。两天后才有三角色的能力拆分。

我很喜欢看 rejected 目录。`2026-06-20-drop-durable-step-boundaries.md` 想删掉 step 起止事件，`2026-06-20-truncate-interrupted-turns.md` 想丢掉崩溃前未完成的 turn。两份都被拒绝，因为回放会失去请求是否完成、最后一段工具工作是否发生的证据。这比架构图更能看出团队对日志的偏执。

7 月加入了沙箱、MCP、自修改工具和持久 PTY，`2026-07-24-agent-loop-observable-state-machine.md` 却删除了一批 loop 事件。回调太多，插件就得理解整段控制流。最后只留下职责明确的扩展点，turn 和 step 仍以日志为准。

8 月开始碰产品层。Profile 组合进程里的 Bundle，Preset 决定单个 Session 的工具和提示词。随后出现 standing mount、host plane、子 Agent 继承等修正。`2026-08-11-preset-authoring-agent-validates-its-own-composition.md` 记录了指南里的四处错误，验证方式也从读 YAML 改成真实 mount。

![开发顺序从日志事实、扩展边界走到 Preset](/posts/images/deepseek-harness-133-plugins/deepseek-harness-133-plugins-04.png)

这批笔记降低了我对产品成熟度的判断。组合的所有权还在移动，团队也刚删掉 TUI、撤掉 Web YAML 编辑器、重做 onboarding。仓库的 pre-release 原则很坦白：先把基础打对，暂时不背兼容包袱。

## pi、Codex，以及我的选择

Pi 也靠插件扩展。它默认只有四个工具，Extension 能替换工具、模型 Provider、上下文压缩和 TUI 组件。DeepSeek Harness 使用了 `pi-ai`，又把依赖注入、服务生命周期和 Agent loop 接入 Cordis。区别在插件负责到哪一层。

Codex 也提供插件、Skills、MCP 和 Hooks，核心 `run_turn` 仍由 Rust 掌握。它要维持 CLI、IDE、桌面端和云端的一致行为，插件边界更窄，产品已经收口。

如果今天选工作工具，我不会从 Codex 迁过去。Web Host 还没有空闲 Agent 回收，Preset 刚经历连续修正；沙箱只明确承诺文件效果，网络和进程可见性不在范围内。

如果我自己写 Harness，我会拿走“模型可见即有日志”和“Preset 必须真实挂载验证”。自修改工具留在开发模式；Cordis 的拆分，等第二种 Provider 出现再引入。

![用户选择 Preset，Cordis 的组合细节留在机器内部](/posts/images/deepseek-harness-133-plugins/deepseek-harness-133-plugins-05.png)

**等到用户只需要选择 Preset，而不用理解 Cordis，我才会把它当成真正的日常工具。**
