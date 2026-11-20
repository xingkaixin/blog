---
title: "Code Mode：为什么 Coding Agent 开始让模型写代码调工具"
date: "2026-11-16"
summary: Code Mode 让 Coding Agent 把工具依赖、容错与筛选放进脚本，省去中间 JSON 开销。对照 Codex、Pi、OpenCode 与 Claude Code，说明它与 Bash 的宿主边界、接口变化及写入不回滚的代价。
tags:
  - Coding Agent
  - MCP
  - 上下文工程
cover: agent-codemode-tools.png
coverAlt: Code Mode：为什么 Coding Agent 开始让模型写代码调工具
---

[Armin Ronacher 10 月 6 日的文章](https://lucumr.pocoo.org/2026/10/6/codemode/)里有一段真实的 Pi 会话代码，任务是先找出 Sentry 的组织，再查每个组织下的项目。按普通工具调用的流程，组织列表会先全部回到对话上下文，模型读出每个组织的 `slug` 和 `regionUrl` 后，再发下一轮请求。

这段会话把两步写进了同一段 JavaScript，直接从组织对象里取值调项目接口：

```js
await tools.mcp__sentry__find_projects({
  organizationSlug: org.slug,
  regionUrl: org.regionUrl,
})
```

外围用 `Promise.allSettled` 等全部组织查完。遇到请求被拒或工具返回 `isError`，脚本就给对应组织记一条错误；成功时，只把组织标识和项目 slug 返回给模型，项目详情全部留在脚本里处理。

普通 JSON 工具调用其实也能[并行执行](https://platform.claude.com/docs/en/agents-and-tools/tool-use/parallel-tool-use)。Code Mode 多出来的，是把先找组织、再查项目的依赖关系，连同局部容错和字段筛选写进程序。底层请求和限流照常发生，但中间不必每次停下来让模型决定下一步。

除了中间数据太大，工具本身的声明和返回文本也在占用上下文。Pi 早期不接 MCP，9 月底官方文章[“You Said No MCP!”](https://earendil.com/posts/you-said-no-mcp/) 就批评过，许多 MCP Server 按直接交给模型调用的方式设计，返回大段文本，宿主和模型还得拆开处理。

把工具声明改成按需查询也能压低初始开销。[Cloudflare 今年 2 月发布的 MCP Server](https://blog.cloudflare.com/code-mode-mcp/) 只留 `search` 和 `execute` 两个入口，模型写 JS 去查 OpenAPI 定义，官方文章称入口说明约 1000 token，全量展开则是 117 万 token。这组数字没有复现，只比较了初始接口说明，不能当作完整任务的总用量；普通工具调用同样可以做延迟加载。

让模型生成可执行代码调工具，2024 年的 [CodeAct 论文](https://arxiv.org/abs/2402.01030)做过实验，2025 年 9 月 [Cloudflare 博客](https://blog.cloudflare.com/code-mode/)提出 Code Mode 这个叫法，两个月后 [Anthropic](https://www.anthropic.com/research/code-execution-with-mcp) 也发文讨论用代码执行调 MCP。到了 2026 年，四家主流 Coding Agent 陆续跟进。Codex 在 3 月 [0.114.0](https://github.com/openai/codex/releases/tag/rust-v0.114.0) 放出实验版 `code_mode`，到 [0.163.0 源码](https://github.com/openai/codex/blob/83086188ae0614bd882818ff1aa23f3194962012/codex-rs/features/src/lib.rs#L1160)仍标着开发中。Pi 在 9 月底 [0.99.0](https://github.com/earendil-works/pi/blob/1402973a9dbe8c627341e04c9744c54953e285ca/packages/coding-agent/CHANGELOG.md#L391) 加入 Codemode，OpenCode 10 月发 [2.0](https://anoma.ly/notes/opencode-2-0/) 时也把它列为重要变化，Claude Code 则在 11 月 12 日（UTC）发布的 [v2.1.323](https://github.com/anthropics/claude-code/releases/tag/v2.1.323) 中新增实验性 [Code Mode](https://code.claude.com/docs/en/code-mode)。

Claude Code 默认关闭该功能，需通过 `CLAUDE_CODE_EXPERIMENTAL_CODE_MODE=1` 在终端交互会话中开启（项目配置里的该变量会被忽略）。它通过 `REPL` 工具执行模型编写的 JS，官方示例在同一段脚本里搜索文件、调用 `edit` 修改并跑测试，最后只返回文件路径与测试输出；对话界面默认只展示 `edit` diff 等工具结果，按 `Ctrl+O` 展开 `Code` 行才能看到源码。

把 MCP 包装成 CLI 交给 Bash 调用是另一条路，[mcporter](https://github.com/openclaw/mcporter) 就是这样让 Agent 用 Shell 调服务。但 CLI 的 `--help` 只给模型看用法，不会自动变成宿主可校验的工具定义。

更关键的差别在执行环境。Armin 专门区分了宿主和 Bash。Bash 可能跑在项目工作区、Docker 容器或远程机器上，向模型传图片、调度子 Agent 的通道却在宿主手里。脚本在容器里 `cat` 一遍图片，不能把图像放进模型输入；容器里的 Python 要调宿主注册的 Sentry 工具，还得用环境变量和 Unix socket 另搭通信链路。

凭据和权限也能留在宿主侧。把查询封装成工具后，脚本只传参数，由宿主拿密钥发请求，不必把密钥放进项目容器。Pi 用编译成 WASM 的 QuickJS 跑脚本，不直接开放文件系统和网络，每次调 `tools.xxx()` 仍要过宿主的[参数校验、hooks 和权限检查](https://github.com/earendil-works/pi/blob/1402973a9dbe8c627341e04c9744c54953e285ca/packages/coding-agent/src/extensions/codemode/tool.ts)；宿主若开放了写入工具，脚本照样能对外写入。

Claude Code 的脚本调用同样经过宿主 `deny`/`ask` 规则与 `PreToolUse` hooks（可匹配 `REPL` 读取 `tool_input.code`）。但在 `auto` 模式下，分类器只在运行前审一遍源码，看不到运行时从搜索结果拼出的路径；若前一段未结束就启动新代码，前一段会失去分类器审查并触发带倒计时的确认，强约束仍须依赖规则、hooks 或沙箱。

![Code Mode 编排宿主工具，Bash 操作项目文件](/posts/images/agent-codemode-tools/agent-codemode-tools-01.png)

图里画的是宿主工具和项目终端的分工，Bash 本身也能作为宿主工具供 Code Mode 调用。公开实现细节的 Codex、Pi、OpenCode 三家，执行引擎也不一样。Codex 在独立进程里用 V8 isolate 执行 [`exec`](https://github.com/openai/codex/blob/83086188ae0614bd882818ff1aa23f3194962012/codex-rs/code-mode-protocol/src/description.rs) 传入的源码，通过 `text()` 选出返回文本；Pi 运行[编译成 WASM 的 QuickJS](https://github.com/earendil-works/pi/blob/1402973a9dbe8c627341e04c9744c54953e285ca/packages/coding-agent/docs/codemode.md)；OpenCode 则用 Acorn 解析代码，跑一套[自研的 JavaScript 子集解释器](https://github.com/anomalyco/opencode/blob/ba06ff9e0bf2dcefbbbc3a1d6094f3572d77c84e/packages/codemode/src/interpreter/execute.ts)。

多次脚本调用之间的状态保留，Codex、Pi、OpenCode 三家各有做法。Codex 和 Pi 都提供显式的 `store/load` 保存可序列化值，其中 Pi 会把成功脚本的存储写入会话记录以支持恢复，Codex 只承诺在当前会话运行时内保留；OpenCode 每次执行都会新建解释状态，核查的版本里没有对应的内建 `store/load`。由于没有跑三家同任务对比测试，不能凭 V8、QuickJS 或子集解释器的名称排出速度名次。

Claude Code 文档未披露 `REPL` 底层 JS 引擎与跨调用 `store/load` 接口，主要标明了会话与耗时边界：前台最长 10 分钟（含权限确认），`auto` 或 `bypassPermissions` 模式下可转后台最长跑 2 小时，且开启过 Code Mode 的会话后续 `--resume` 或 `--continue` 只能在保持开启的终端里恢复。

把编排逻辑交给脚本后，工具接口的稳定性反而更关键。Armin 提到过一种容易让脚本出错的设计，工具在小批量查询时返回一种结构，到了最大批次为了省 token 又换成另一种结构。模型先试几个条目时脚本能跑通，扩大查询范围就可能在按字段取值时报错。脚本按字段读数据，工具就得保持返回结构稳定，不能让调用方猜这次拿到的是文本还是对象。

嵌套调用目前也容易卡住。Armin 贴过外层 Code Mode 调用内层 Code Mode 的代码，字符串会多出一层转义，内层也调不到外层宿主的工具。Cloudflare 那个 MCP Server 里的代码同样只能访问它开放出来的 API，拿不到外层宿主的 Bash 或图片工具。

**给 Agent 接入 Code Mode，先拿只读查询来试，把写操作留在逐项确认的流程里。** 可以先挑出调用日志里返回体大、最终只取几个字段的查询放进脚本筛选，同时记下原始返回量和最终传回模型的字段量，看清到底省掉了多少中间数据。

写入一旦在半途出错，代价完全不同。如果一段脚本连续发起三次写入，前两次成功、第三次报错，已经写入的结果不会因为脚本中断而自动撤回，重跑之前还得先核对哪些动作已经完成。
