---
title: '部署完就再没看过日志？我让 Agent 每天替我巡一遍 Cloudflare'
date: 2026-07-16
summary: Cloudflare 日志没人看，我给 Agent 配了每日巡检：查询过去 24 小时、对比基线、去重后开 issue。适合 loop 的任务，关键是边界清楚、结果容易核对。
tags:
  - Agent
  - Cloudflare
  - 自动化运维
cover: /posts/cover/agent-daily-log-patrol.png
coverAlt: 部署完就再没看过日志？我让 Agent 每天替我巡一遍 Cloudflare
---

# 部署完就再没看过日志？我让 Agent 每天替我巡一遍 Cloudflare

我有个小应用部署在 Cloudflare 上。上线那天，我盯着 dashboard 看了半小时，之后再也没打开过。

问题一直有，只是都由用户替我发现。某个功能挂了三天，直到有人来问“是不是坏了”。日志把过程记得清清楚楚，只是没人看。对一个 side project 来说，“每天检查日志”这种运维纪律，我很清楚自己坚持不下来。

所以我给它配了一个每天早上自己醒来的 Agent。它不改代码，只替我完成第一轮巡检。

![无人巡检 vs Agent 巡检](/posts/images/agent-daily-log-patrol/agent-daily-log-patrol-01.png)

## 它每天检查什么

每天早上八点，Agent 查询过去 24 小时的 Workers 日志和请求数据。我用的是 Cloudflare Workers Observability 的 telemetry query 接口，而不是让它在 dashboard 里模拟点击。

它先找新出现的错误签名、5xx 的量级变化和明显变慢的接口，再把结果和前一天、过去一周的情况对照。小应用半夜零流量很正常，直接按绝对值报警，只会养出一个每天吵你的机器人。

接着判断是否需要开 issue。规则我写得很死：同一个新错误出现超过三次，或者影响到核心路径，才继续；开之前先搜已有 issue，确认不是重复问题。

最后汇报。有事就执行 `gh issue create`，附上时间范围、日志片段、受影响路径和初步定位；没事只留一行：“过去 24 小时 xx 次请求，无新增错误签名。”

某次它发现一个接口从下午两点开始出现新的 TypeError，日志片段已经整理好，初步定位指向前一天合并的 PR。我看完花了一分钟，修掉花了十分钟。要是继续等用户来报，这一分钟会先变成一次道歉。

![适合进 loop 的判断框架](/posts/images/agent-daily-log-patrol/agent-daily-log-patrol-02.png)

## 巡检为什么适合做成 loop

六月很多人在转 Boris Cherny 那句“我不再 prompt Claude，我的工作是写 loop”。真正难的其实不是把定时任务跑起来，而是判断一件事值不值得进 loop。

巡检的输入每天都会更新，Agent 醒来就知道去哪里取数据；每一轮只处理固定的 24 小时，结束位置也清楚。更关键的是，它的输出很便宜就能核对：错误签名在不在、issue 是否重复、时间范围有没有取错，我扫一眼就能判断。

这还不是一个完全自治的闭环。Agent 只能读取日志、整理证据、创建 issue，不能改代码、部署或关闭问题。它给出的初步定位也只是线索，是否处理、怎么处理，仍然由我决定。

这种边界很重要。任务重复，不等于值得全自动；结果容易核对，权限又能限制在低风险动作里，才适合让它每天无人值守地跑。

## 一份可以直接改的规则

我的巡检指令压缩后，大致是这样：

```text
检查过去 24 小时的 Workers 日志和请求数据：

1. 对照前一天和过去一周，找新增错误签名、5xx 变化和延迟异常。
2. 同一新错误超过 3 次，或影响核心路径时，才进入 issue 流程。
3. 创建 issue 前搜索现有 issue，发现重复就追加证据，不要新开。
4. issue 必须包含时间范围、日志片段、受影响路径和初步定位。
5. 没有异常时只输出一行摘要。

允许读取日志和创建 issue；禁止修改代码、部署、关闭 issue。
```

调度器反而是最容易替换的部分。cron 跑 headless CLI 可以，Codex Scheduled Task 也可以。真正需要花时间调的是异常门槛和权限边界：门槛太低，它每天制造噪声；权限太大，一次误判就会从巡检变成事故。

![巡检决策流程](/posts/images/agent-daily-log-patrol/agent-daily-log-patrol-03.png)

**没消息值得放心的前提，是确实有人看过。这个人现在可以不是我。**
