---
title: '给 agent 做 CLI：你随手写的报错，是它的下一步指令'
date: 2026-06-29
summary: 给 agent 做 CLI，报错不是日志，是接口。拆完飞书 lark-cli 的 35 万行源码，它只要求贡献者内化一条规则：你写的每条错误信息，都会被 AI 解析以决定下一步动作。typed error、stdout/stderr 分流、_notice 递话、lint 护栏，四个能直接抄的设计。
tags:
  - AI编程
  - CLI
  - Agent
  - lark-cli
cover: /posts/cover/agent-friendly-tool.png
coverAlt: 给 agent 做 CLI：你随手写的报错，是它的下一步指令
---

# 给 agent 做 CLI：你随手写的报错，是它的下一步指令

翻 agent 的 session 回放，我看到自己写的 CLI 吐了一条错：`Error: request failed`。然后 agent 把同一条命令原样重试了三次，三次拿到同一行字，最后开始换着花样编造根本不存在的 flag。

不能怪它。这条报错是我顺手写的，写给人看。人看到 request failed，会去查网络、看配置、翻文档；agent 没有这些带外手段，它的全部世界就是你输出的那几行字。那行字没说下一步该干什么，它就只能猜。

前几天我把飞书官方的 lark-cli 源码拆了一遍。35 万行 Go，AGENTS.md 开头就把话挑明：这个 CLI 的主要消费者是 AI Agent，你的代码是被机器读取的。整个仓库只要求贡献者内化一条规则：**你写的每条错误信息，都会被 AI 解析以决定下一步动作。**

它的整套架构，几乎都是从这一句推出来的。对照着看，我那个 CLI 错得很系统。

## 报错不是日志，是接口

lark-cli 的错误是结构化的：每个错误带 `type`、`subtype`、`param`、`hint` 四个字段。参数校验失败，`param` 里写明是哪个 flag；前置状态不满足，`hint` 里写清楚先去做什么。报错回答的问题，从“出了什么事”变成了“下一步做什么”。

这事做到了什么程度：仓库里有一份 `ERROR_CONTRACT.md`，错误怎么分类、什么场景用什么构造器、下层的 typed error 要原样透传不许再包一层，写得像 API 文档。裸的 `fmt.Errorf` 在命令层直接过不了 lint。报错在这个项目里是一等公民，和接口签名一个待遇。

道理想通了很简单：人能容忍一条含糊的报错，因为人有别的路可走；agent 的下一步完全由这行字决定。报错的信息密度，直接决定它接下来是修复还是瞎猜。而猜错的每一轮，烧的都是你的 token。

![裸报错与结构化报错对 agent 行为的差别](/posts/images/agent-friendly-tool/agent-friendly-tool-01.png)

## stdout 是数据，stderr 是其它一切

lark-cli 的第二条纪律：JSON 数据走 stdout，进度、警告、提示，一律走 stderr。

我的 CLI 犯过反例：把“正在拉取数据...”的进度提示打进了 stdout。人看终端毫无问题，agent 拿管道接输出，JSON 前面多了一行中文，解析直接失败。对人，输出混在一起是审美问题；对 agent，是功能性故障。

这条纪律还有半句：进了 stdout 的每一个字段，都会进 agent 的 context。无关字段不只是占地方，它会稀释 agent 的注意力，把后续推理带偏。所以 lark-cli 内置了 `--jq`，裁剪发生在信息进入 LLM 之前。给 agent 的输出，够用就好，不是越全越好。

![stdout 与 stderr 的双通道分流](/posts/images/agent-friendly-tool/agent-friendly-tool-02.png)

## 工具可以反过来给 agent 递话

最有意思的是 `_notice` 机制。CLI 有新版本了，或者本地 skill 文件和二进制版本漂移了，lark-cli 不是在 stderr 打一行给人看的提醒，而是把 `_notice.update`、`_notice.skills` 字段嵌进 JSON envelope，放在 agent 一定会读到的位置。agent 看到，自己就会去跑 `lark-cli update`。

这是个方向上的反转：工具不只被动接命令，还会把“你该做的维护动作”递到 agent 眼前。人会忽略升级提示，agent 不会，前提是你把提示放在它的视野里。

文档也是同一个思路。lark-cli 用 `go:embed` 把 26 个 skill 域的说明书直接打进二进制，agent 读到的文档和它正在用的工具版本严格一致。给人的文档挂在网站上，过期了人会皱皱眉；给 agent 的文档过期，它会一本正经地按旧语法调用，然后你回到第一节，看它对着报错瞎猜。

![_notice 机制：工具把维护动作递到 agent 眼前](/posts/images/agent-friendly-tool/agent-friendly-tool-03.png)

## 约定靠护栏，不靠自觉

真正让我服气的不是这些设计，是它们的落地方式：全部写进了 lint。

forbidigo 用正则禁了一批调用：`fmt.Print*` 必须换成框架的输出通道，不然会绕过 `--jq` 污染 stdout；`fmt.Errorf` 作为最终错误直接报 lint 错，必须用 typed error；业务层禁止裸 HTTP、禁止直接碰 `os.*`。“每条报错都会被 AI 解析”这句话写在文档里，没人能一直记得住；写进 lint，就没人绕得过去。

我的 CLI 没有 35 万行，但这一层最值得抄。一个人维护的工具，没有第二双眼睛帮你盯 review，护栏就是那双眼睛。约定能被工具链强制的，就不要指望自觉。

---

给人做 CLI，界面是 UI，报错是兜底。给 agent 做工具——CLI、SDK、被它调用的内部脚本——正好反过来：**你输出的每一行，都是它 prompt 的一部分。**

回去我把那条 `request failed` 改了：错误类型、出错的参数、下一步建议，三样补齐。再看回放，agent 第一次重试就带上了正确的参数。工具没变聪明，是我终于把话说清楚了。