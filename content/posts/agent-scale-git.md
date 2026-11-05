---
title: "Anthropic 一天合并 3 万次代码，先撑不住的是 Git"
date: "2026-11-02"
summary: "Git、CI 和合并队列：Anthropic 日均合并从 2,500 涨到 3 万次，最后把 monorepo 迁出了 Git；GitHub 9 月的 commit 是一年前的五倍多。普通团队不必迁出 Git，但有三处可以先改。"
tags:
  - Git
  - CI
  - Agent
  - 工程效率
cover: agent-scale-git.png
coverAlt: "Anthropic 一天合并 3 万次代码，先撑不住的是 Git"
---

Anthropic 的 monorepo 9 月每天合并超过 30,000 个代码改动，5 月还只有 2,500 个左右。他们 10 月 13 日的工程博客里说，先跟不上的是源码管理、构建和 CI，这几样当初是按人的规模搭的。最后他们把这个仓库从 Git 迁了出去。

他们换上的新系统叫 Scion，七个人做了五个月就迁完了。博客说迁移期间合并量涨了 10 倍，可 2,500 到 30,000 算下来是 12 倍，两处统计的时间段大概不一样。他们自己也说，Scion 只适合几万名工程师或大量 agent 共用的超大 monorepo，一般用途别拿它替 Git。

GitHub 10 月 6 日也发了一篇，标题是 Building Git infrastructure for agent-scale development。9 月 GitHub 上有 73.8 亿次 commit，是一年前的五倍多，push 和 Actions 运行也都超过了 30 亿次。

GitHub 那篇还写了 agent 怎么用 Git：在循环里几乎每做一个动作就 commit 或打 checkpoint。这种跑法下 agent 的速度卡在单次 push 的耗时上。GitHub 每个仓库默认存 5 份副本，每次写入所有副本都要参与，push 的速度由最慢的那份决定。

主干开发和合并队列又让写入都落在同一个 ref 上。push 完，CI 和代码扫描会去拉这个分支最新的提交，GitHub 给的频率是每分钟数千次。

Anthropic 的客户端几乎全是 agent 和 CI 任务。Git 让每个 clone 都是完整仓库，好处是断网也能干活，可这些客户端一直连着服务端，用不上离线，完整副本却照样要拉。他们主干的历史接近 100 GB，压缩后的工作副本超过 25 GB，CI 每天大约 2,500 万次 checkout。他们算过，每次都全量拉的话，一天超过 600 PB。我拿 2,500 万乘 25 GB 验了一下，是 625 PB，对得上。

迁移前，他们靠几百个内部 Git 镜像扛这个量。

Scion 的客户端只留一个有上限的对象缓存，用到哪些文件才去取。要查 blame、翻历史，或者做合并和 rebase，都是调服务端。举的例子是，CI 要拿某个 commit 和 merge base 之间的 diff，问服务端就行，不少 CI 任务因此用不着本地仓库。迁移后，按 CPU 和内存算，这套基础设施的占用只剩原来 Git 镜像的两百分之一，CI 那边另外腾出了 25% 的 CPU。

合并队列的常规做法是加一把全局仓库锁，Anthropic 说他们没法照着做，因为一轮测试还没跑完，几百上千个改动可能已经合进去了。他们改成合并后、部署前跑自动化测试。并发改动会冲突，他们的说法是，Claude 修好这些冲突，通常比人发现冲突还快。他们预计 6 到 12 个月内，会有更多团队碰上这类问题。

**普通团队的仓库和 agent 数量离这个规模很远，我不建议迁出 Git。** Scion 有几处做法可以借，都是我从它的设计里推的，没实测过。

CI 里有的 job 只是要读一个 diff 或者查一次 blame，也完整 clone 了整个仓库，换成 shallow clone、sparse checkout，或者调平台 API 拿 diff，都比 clone 便宜。改之前，先拿 job 日志里 checkout 那一步的耗时和整个 job 比一下。

![CI 只从服务端取需要的 diff](/posts/images/agent-scale-git/agent-scale-git-01.png)

本地开多个 agent、各自 clone 一份的，可以换成 `git worktree`，共用一个对象库。

合并队列我会放到最后。把慢的集成测试挪到合并后、部署前，队列会变短，代价是主干上有还没测完的提交，部署前测试挂了，得有人马上找出是哪个改动。主干红了经常半天没人管的团队，不适合这么改。
