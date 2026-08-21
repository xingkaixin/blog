---
title: '多开几个 agent 并行干活，为什么越干越乱'
date: '2026-08-17'
summary: 多 agent 并行开发常漏掉一件事：共享接口由谁拍板。Cursor 的蜂群实验里，旧框架两小时制造 7 万次冲突；新版重做分工和协调机制后，同组模型用约四分之一的代码拿到更高分。
tags:
  - Agent
  - 多智能体
  - 软件工程
  - Cursor
cover: /posts/cover/agent-swarm-context.png
coverAlt: 多开几个 agent 并行干活，为什么越干越乱
---

# 多开几个 agent 并行干活，为什么越干越乱

![封面：多开几个 agent 并行干活，为什么越干越乱](/posts/images/agent-swarm-context/agent-swarm-context-cover.png)

前阵子我同时开了三个 Claude Code：一个改后端接口，一个补前端页面，一个写测试。三个窗口一起刷屏，看着确实很像多了三名队友。

晚上合并时，两个 agent 都碰过同一个工具函数；写测试的那个，还在按照旧接口补用例。我先读完三份 diff，才敢决定保留谁的版本。并行省下来的时间，又在这里还了回去。

我的第一反应是 prompt 写得不够细。读到 Cursor 的 Wilson Lin 发布的[蜂群实验报告](https://cursor.com/cn/blog/agent-swarm-model-economics)后，我才发现自己的分工里一直少了一个问题：后端、前端和测试都依赖的那份接口，到底谁说了算？

## 旧蜂群两小时就被叫停了

Cursor 给蜂群一份 835 页的 SQLite 文档，要求它用 Rust 从零实现数据库。没有源码、测试套件、SQLite 二进制文件和网络，最后用 [sqllogictest](https://www.sqlite.org/sqllogictest/doc/trunk/about.wiki) 检查结果。

旧版 Grok 4.5 蜂群不到两小时提交了 68,000 次。暂停前，它已经制造了超过 70,000 次合并冲突，其中一个文件被 1,173 个 agent 改过。

新版四小时里的冲突不到一千次。换成同一组 Opus 配置对比，新版用了约四分之一的代码，得分还从 97% 升到了满分。

![忙碌的蜂群与有效产出的对比](/posts/images/agent-swarm-context/agent-swarm-context-01.png)

Cursor 这次同时改了版本控制、冲突仲裁、设计文档等机制，所以不能把分数变化全算在规划器和 worker 分工头上。让我想起自己那次冲突的，是报告里一个小得多的细节。

## 代码库里长出了三个 SQL 包

旧蜂群最后长出了 54 个 crate，其中有三个互不相干的 SQL 包。比两段代码撞在同一行更麻烦的是，三个 agent 各自决定了一遍 SQL 层应该怎么设计。

新版把规划器和 worker 分开。规划器负责拆任务、定设计，不写实现；worker 只处理分到手的那一小块。规划器的上下文不会被底层代码塞满，worker 也不用一边写代码，一边猜整个项目接下来要往哪走。Cursor 把这称为上下文效率。

![规划器拆任务、worker 分头执行](/posts/images/agent-swarm-context/agent-swarm-context-02.png)

我当时给三个会话写的分工是“后端、前端、测试”。三个任务都有名字，接口却没有负责人。后端 agent 可以顺手改签名，前端 agent 可以自己补字段，测试 agent 还可能把另一版行为写进断言。

**如果两个 agent 都能改一份接口定义，它们拿到的不是两块任务，而是两份互相覆盖的设计权。**

## 三个会话，先把这几行写清

三个窗口可以照开，但别同时开工。先用一个规划会话，把设计决定和可修改的范围落进 `design.md`，不写代码。最少要写清这几项：

```text
设计负责人：规划会话
共享接口：签名 / 唯一修改者
执行 A：任务范围 / 可改文件
执行 B：任务范围 / 可改文件
验收：命令 / 预期结果
```

这份文件写完，两个执行会话才开工。执行中发现设计有问题，就把问题退回规划会话，不在自己的分支上悄悄发明另一套接口。

真出现冲突，再开一个干净会话，把两边的 diff 和 `design.md` 一起交给它。Cursor 的蜂群也让中立的第三方 agent 处理合并，避免两个当事 worker 互相覆盖。

![设计文档、执行会话与合并仲裁](/posts/images/agent-swarm-context/agent-swarm-context-03.png)

`design.md` 替代不了 Cursor 自建的版本控制系统和可编译引用。它只解决一件小事：合并时不用临场猜谁说了算。Cursor 已经把实验产出的 [minisqlite](https://github.com/cursor/minisqlite) 开源，完整数据也能在原报告里查到。

我那三个终端窗口还在。区别是，现在只有一个窗口能改接口。
