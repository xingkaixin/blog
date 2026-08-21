---
title: '给 App 加个聊天框，不叫 Agent-first'
date: '2026-08-10'
summary: Agent-first 的关键不是在 App 里塞聊天框，而是让 UI、Agent 与 MCP 共用同一套业务 action。先改一个高频动作，再决定入口长什么样。
tags:
  - Agent
  - 系统设计
  - MCP
  - 工程实践
cover: agent-first-action-layer.png
coverAlt: 给 App 加个聊天框，不叫 Agent-first
---

camelAI 最早给每个用户配一台虚拟机。Agent 有完整的 Linux、持久磁盘和 Bash，能装依赖、跑命令、部署应用，权限比大多数聊天机器人都大。

后来他们把这套架构拆了。Agent 搬进 Cloudflare Durable Object，文件放进 SQLite 和 R2，Bash 也被拿掉，只能调用团队预先定义的方法。按团队的复盘，成本降了，凭证更容易管，小模型也比以前好用。

我读到这次迁移时，刚好又看到 Builder.io 演示了一种 Agent-first App：在待办页面点“完成”，和对 Agent 说“把这条待办标记为完成”，走的是同一个 action。

这两个项目做法不同，指向的却是同一件事：给 App 接入 Agent，改造重点落在业务动作，不在界面。

## 聊天框只是多了一条旁路

给现有 App 加 Agent，最顺手的做法是在右下角塞一个聊天框，再给模型接几个 API。UI 继续走原来的前端事件和后端接口，Agent 走 tool call，实在没有接口就开浏览器点，或者进 Bash 里绕一圈。

演示通常能跑。问题要等业务规则变化时才冒出来。

比如“关闭工单”这个动作，UI 会检查工单是否还有未完成任务，Agent 的 tool 却只改了状态字段；UI 按当前用户判断权限，Agent 拿服务账号直接越过；网页上失败会提示缺哪项信息，tool 只返回一句 `request failed`。

同一个动作有了两套实现，也就有了两套权限、校验和错误处理。再接 Slack、语音或别人的 Agent，每多一个入口，旁路就多一条。

如果 Agent 必须模仿用户点击页面，或者靠 Bash 拼出一次业务操作，说明 App 还没有把自己的能力说清楚。聊天框只是把这个缺口遮住了。

![UI 和 Agent 分走两条执行路径，就会留下两套规则](/posts/images/agent-first-action-layer/agent-first-action-layer-01.png)

## 真正该共用的是业务动作

Builder.io 的 Agent-Native 案例里，UI、Agent、HTTP、MCP 和 CLI 都建立在 action 上。页面按钮和 tool call 只是不同入口，真正执行“新增待办”“完成任务”的代码只有一份。

这比“所有页面都配一个聊天框”多走了一步，也少留了一笔账。

以“退款订单”为例，action 只接收订单号和原因，操作者身份由可信的调用上下文注入。它在内部检查订单状态、退款权限与幂等键，最后写入退款记录和审计日志。UI 按钮负责收集输入，Agent 负责从对话里整理参数，两边都不能另写一套退款规则。

这样做以后，换入口不会改变业务后果。按钮、语音和 MCP 调用拿到相同的成功结果，也撞上相同的失败条件。

这里不需要把整个 App 重构成某种新框架。真正值得抽出来的，是会改变业务状态的动作。弹窗怎么开、列表怎么筛、鼠标悬停显示什么，仍然属于 UI；创建订单、关闭工单、发起退款，才需要成为人和 Agent 共用的能力。

**Agent-first 的最小单位不是聊天框，而是一个能被不同调用者安全执行的业务动作。**

![UI 和 Agent 共用同一个 action](/posts/images/agent-first-action-layer/agent-first-action-layer-02.png)

## 为什么拿掉 Bash，Agent 反而好用了

camelAI 的迁移把这个判断推得更远。他们原本让 Agent 在虚拟机里自由使用 Bash，但每个用户一台常驻机器，计算和磁盘成本都很重。更麻烦的是凭证：Agent 要调用外部服务，就得拿到密钥，或者经过一层越来越难维护的代理。

新架构把常用能力收成显式方法。读写文件有专门工具，部署走 `deploy_project`，生成的 JavaScript 在临时 V8 isolate 里执行，凭证留在沙箱外。只有构建前端和运行 Python notebook 这类确实依赖 Linux 的任务，才临时拉起容器，跑完就关。

团队还观察到，工具变少以后，小模型更容易完成任务。原因不神秘：以前模型面对一整台 Linux，要自己决定命令、参数、目录和凭证；现在它只需要在少量业务方法中选择。原来每次都要推理的产品知识，已经被写进工具。

这不代表 coding agent 都该失去 Shell。面对陌生代码库和开放任务，Shell 仍然是最通用的手。垂直 App 的情况相反：产品允许用户做什么，本来就是一个有限集合。还让 Agent 依赖 Bash，往往是在用模型的临场发挥补产品接口的欠账。

![拿掉通用 Bash，留下显式方法](/posts/images/agent-first-action-layer/agent-first-action-layer-03.png)

## 先改一个动作

真要把现有 App 改成 Agent-first，不必先做聊天界面，也不用一次重写所有 API。

先挑一个用户经常做、会改变业务状态的动作，比如“把 issue 标记为已解决”。顺着现有按钮往下找，直到找到真正写状态的那段代码，然后把四件事收进同一个入口：最少需要哪些参数，谁有权执行，失败时返回什么，重复调用会不会产生第二次副作用。

接着让 UI 和 Agent 都只调用它，再补一组契约测试：无论请求来自按钮还是 tool call，相同输入都应该得到相同状态和审计记录。以后接 Slack 或 MCP，只加薄薄的一层参数转换，不再复制业务规则。

camelAI 拆掉虚拟机后，用户照样能让 Agent 读文件、改项目、部署应用。被删掉的是一条昂贵又难管的通用旁路，留下的是产品真正愿意承诺的能力。

下次准备给 App 加 Agent，先别画聊天框。打开一个现有按钮，看看它背后的动作能不能被 Agent 直接、安全地调用。

**如果 UI 和 Agent 走的是两条执行路径，你做的只是一个会聊天的旁路。**
