---
title: "AI 开始给代码写证明，证明又由谁来检查？"
date: "2026-11-25"
summary: Anthropic 与 Theorem 用 Rocq 和 oft check 核验 1.8 亿行证明的目标类型与公理，但证明只认二进制 SHA-256 与入口断言，前提与编译链仍需人查。
tags:
  - 形式化验证
  - 工程实践
  - 软件工程
  - AI编程
cover: ai-formal-verification.png
coverAlt: AI 开始给代码写证明，证明又由谁来检查？
---

Anthropic 与 Theorem 在 2026 年 10 月发布的[研究报告](https://www.anthropic.com/research/formal-verification)称，Claude 为 123 个开源库的 239 个测试入口生成了形式化证明，证明代码约 1.8 亿行，由定理证明器 Rocq 检查。公开仓库只放出了其中一部分，而在仓库 README 的 LZO 压缩示例旁，写着一句全大写说明“ONLY THE LENGTH”。

顺着链接打开 LZO 测试入口的[源码](https://github.com/theorem-labs/oss-verify-proofs/blob/main/projects/lzo/lzo_compress_target/source/lzo_compress_target.c#L100)，解压返回后的断言就在第 100 行：

```c
assert(r == LZO_E_OK && decompressed_len == size);
```

这条断言只检查解压返回码和恢复长度，没有比较原文与解压内容。同样是三个字节，`abc` 与 `xyz` 长度一致，内容完全不同。想确认解压后的数据还原成原文，源码里缺少逐字节比对。

## 断言没写进去的东西，证明不会替你保证

就连“所有输入都检查了长度”也不成立。入口代码第 45 至 47 行先把超过 `1 << 20`（1 MiB）的 `size` 截断成 `1 << 20`，第 86 至 92 行又跳过压缩后没有变小的输入。超过 1 MiB 的字节和未变小的样本，都不会进入第 100 行断言。

截至 2026 年 11 月 12 日读取的[已证明入口索引](https://github.com/theorem-labs/oss-verify-proofs/blob/main/index/PROOFS.md)与 LZO 入口 [README](https://github.com/theorem-labs/oss-verify-proofs/blob/main/projects/lzo/lzo_compress_target/README.md)，LZO 的 `plain_halts` 等声明仍处于 `open` 状态。

本轮只核对了报告、仓库文档、入口源码与检查脚本，没有独立运行 Rocq。`open` 也不代表程序有 bug，可能只是证明搜索还没找到推导。

即使这份命题日后通过检查，它也只保证覆盖范围内的每次执行以状态 0 或 2 结束，不触发第 100 行断言失败。没有写进断言的内容，证明自然不会替你保证。

仓库里的声明还区分了 `halts` 与 `agreement` 两类性质。`halts` 要求所有覆盖执行终止且退出码落在允许范围内；`agreement` 要求普通构建与检测器构建的可观察行为一致、不触及定义好的错误，但不排除程序一直运行下去。看懂一份证明到底保什么，得先看清它挂在哪个命题名下。

## 1.8 亿行代码不用肉眼看，靠检查脚本卡死

面对 1.8 亿行证明代码，开发者不可能靠肉眼审阅，项目把验收交给检查脚本 [`tools/oft/check.py`](https://github.com/theorem-labs/oss-verify-proofs/blob/main/tools/oft/check.py)。

`oft check` 先核对目标二进制文件的 SHA-256 摘要，构建内存映像与目标命题，再调用 Rocq 内核按形式规则核验提交的推导。按仓库说明，在 16 核机器上完成一次检查最多需要 20 GiB 内存。

提交证明后，包装代码会把它直接填进目标命题的类型定义。只要类型对不上，Rocq 当场拒绝，没法拿一个更弱的结论交差。

检查脚本还会运行 `Print Assumptions`，把证明实际依赖的公理单独重定向到一个文件，再和允许公理清单逐项比对。脚本只读这份独立文件，不混用普通编译日志，清单之外的公理一律拒绝。这样就能堵住把待证结论塞成额外公理的漏洞。

![验收流程：先比对目标命题类型，再单独核查证明实际依赖的公理清单](/posts/images/ai-formal-verification/ai-formal-verification-01.png)

## 过了机器检查，还有三层前提得自己核对

类型与公理都过关后，命题写死的前提条件还得逐条对照。以 LZO 的 `plain_halts` 为例，声明假定只要内存不超过 16 GiB，系统就不会拒绝分配；运行环境不额外拦截请求；驱动程序还会在进入测试入口前，以退出码 2 拦下参数错误、文件不可读或达到 64 MiB 的输入。

公理合规，不代表你的生产部署满足这些条件。

除此之外，检查器只认编译出来的二进制字节，证明针对的是 SHA-256 对应的那份机器码，不管它怎么从 C 源码编出来。[可信组件说明](https://github.com/theorem-labs/oss-verify-proofs/blob/main/docs/trust.md)明确把编译器、构建过程以及源码到二进制的对应关系排除在可信基础之外。

想确认这份证明对应手上的源码，得去核对 `proofs/provenance/` 里记录的上游仓库与提交、编译器、镜像、编译与链接选项以及二进制 SHA-256，并按重构建指南复现哈希。否则就算二进制证明全部通过，依然无法确认它就是仓库里那份源码编出的产物。

省去逐行读证明之后，人依然要信任整条检查链路，包括 Rocq 内核、允许公理、二进制映射工具、包装脚本以及形式化语义模型 LPS。

[系统模型文档](https://github.com/theorem-labs/oss-verify-proofs/blob/main/docs/semantics.md)写明，LPS 建模的是静态链接、单线程的 `riscv64` Linux 进程，系统模型目前尚不完整，研究也限定在特定资源边界内，并没有覆盖真实 Linux 下的全部系统调用与多线程行为。

**形式化证明签收的是特定二进制在限定前提下的性质，未写进断言的需求和源码编译过程都需要另行核对。** 对 LZO 这类内容还原需求，下一步得先把 `memcmp` 这类逐字节比对写进测试入口，重新编译并核对二进制 SHA-256，再重跑检查确认新增断言已经落进目标命题。
