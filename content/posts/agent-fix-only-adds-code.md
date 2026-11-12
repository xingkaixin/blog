---
title: "Agent 修 bug 几乎不删代码，防御一层层叠上去"
date: "2026-11-11"
summary: "Agent 修 bug、代码审查、AGENTS.md：修复 diff 只有判空和 try-catch，或把 A、B 两套方案都留着，往往是把非法状态合法化、把决定推给后人。派活前写三行默认规则，收代码先看删除行数。"
tags:
  - Agent
  - AI编程
  - 代码审查
  - 代码质量
cover: agent-fix-only-adds-code.png
coverAlt: "Agent 修 bug 几乎不删代码，防御一层层叠上去"
---

10 月初放出的一期节目里，Armin Ronacher 和 Mario Zechner 聊 Pi Durable。说到 Coding Agent，Armin 说它肯定能把问题解决，但几乎不可能不加代码就修好一个问题。旁边有人笑着接话，说 Armin 自己大概就常提两百个文件的 PR，Armin 也认了。

下面是我按常见形态拼的例子，不是某一次具体的 diff：字段为空，就在读它之前判空给默认值；请求抛异常，就包一层 try-catch 返回空列表。测试过了，删除行是 0。

可那个字段按设计就不该为空。判空一加，非法状态成了合法状态，下游读它的代码都得跟着处理空值。

maxlv.net 上有篇文章，作者用 Claude Code 的 Agent Team 把三万行的 Go 项目 mihomo 移植到 Rust 时也撞上了。Engineer 想在 Axum router 上加一层 `tower::catch_panic`，理由是“提高健壮性”。QA 的测试计划写的是：spawned tokio task 里出了 panic，进程就得终止，soak test 才能发现故障。panic 被接住，soak test 就看不到故障了。

Armin 6 月在《The Coming Loop》里写过，现在的模型写代码太防御，推理只看眼前，碰到坏状态习惯补一个 fallback，很少从设计上让它出不来。他还引了 Karpathy 的话：模型怕异常怕得要死。放进 loop 里自动跑，这些防御会一轮轮攒下来。

tison 给 ScopeDB 写 T-Digest 时碰到的是另一种情况。各种极值的边界处理，最后几乎都是他自己定的，理由他说得很干脆：“你去让 AI 在 A 或 B 中间选，它能把 A、B 和‘或’都选上。”

老数据要不要兼容，这类答案不在代码里。Agent 很少停下来问，就两套逻辑都留着。

Armin 在 4 月的 State of Agentic Coding #5 里讲过一段旧事（转录没标说话人，我按上下文判断是他）。Xbox One 发布那阵，他参与过《光环：士官长合集》，匹配系统里有大约 15 个布尔变量，很多不该同时成立的状态同时成立了，像是“LLM 出现之前的 LLM 代码”。

他说 LLM 感觉不到这种痛，不会来找你说布尔值太多、该换成状态机，只会接着写。他们自己的代码库里现在也有这种代码，是有几周没仔细看 Agent 提交的东西时混进去的。

**Agent 不觉得这段代码越来越难改，也没人告诉它两套逻辑该留哪套，所以每次修复它都往上加。**

网络超时、第三方服务不响应，靠类型和不变量消不掉，该加防御就加。我主要看坏状态是不是自己代码产生的，是的话回到源头改。

派活前，把拍板规则写进 AGENTS.md。mihomo-rust 写了一份 ADR（架构决策记录）：安全、隐私、路由意图上的分歧算硬错误，拒绝加载配置；性能、兼容上的分歧警告一次，继续运行；拿不准就按硬错误处理，并在 PR 描述里标出来。普通项目我觉得写三行就够：要不要后向兼容，哪类错误必须直接暴露，拿不准时默认往哪边写。@leon7hao 讲并行 vibe coding 的帖子里有这样一句：“当前应用是未发布状态，无需后向兼容，可以做破坏性更新。”

收代码时，先看修复 diff 的删除行数。

![只加不删的防御层](/posts/images/agent-fix-only-adds-code/agent-fix-only-adds-code-01.png)

删除行是 0，或者冒出判空、`fallback`、宽泛的 `catch`，就追问两句：“这个状态是在哪里产生的？这里替我回避了哪个决定？”

DHH 在 Lex Fridman 的节目里说过，Agent 说做完了，另一个 Agent 审过也说做完了，他补一句“看着有点太复杂”，Agent 常常马上承认搞复杂了，把实现砍掉一半。他问，就不能一开始这么写吗。有人提醒他，人也一样。只是人写到一半自己就会嫌烦，Agent 不会，所以合并前，“看着有点太复杂”这句要由人来说。
