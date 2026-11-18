# Oxlint tsrs 评估

评估日期：2026-11-18。基线提交：`4edb8b8`。

保留 tsrs：本项目的 lint 峰值 RSS 中位数下降 **52.8%**，诊断保持一致。耗时中位数只下降 3.3%，波动大于差异，**本次不能确认加速**。不启用合并类型检查。

## 环境与方法

- Apple M1 Pro，10 核，32 GiB 内存，macOS arm64；Bun 1.4.4、Node 24.22.3。
- Oxlint 均为 1.94.0；对比 tsgolint 7.0.2007 和 tsrs 0.25.0-ts7.1.0-beta。
- 使用 Bun 安装依赖。`.oxlintrc.json`、TypeScript 配置、JS 插件和项目源代码均保持不变。
- 先记录原命令和诊断，再安装 tsrs。每侧预热一次，随后按 Go、Rust 顺序交替运行 7 轮，每次启动新进程；未启用 profiler 或覆盖线程数，tsrs 使用默认 fast 模式。
- 安装前的原始 `bun run lint` 单次记录：退出 0、零诊断、0.88 s、峰值 RSS 476.0 MiB。该记录单独留档，正式对比使用下方预热后的交替样本。
- 计时命令为 `bun run lint --format json`。用 `OXLINT_TSGOLINT_PATH` 指向各自的 `node_modules/.bin/tsgolint` 或 `tsrs-lint`，避免自动选择后端影响对比。
- 耗时由 Python `time.perf_counter()` 包围整个 `/usr/bin/time -lp bun run lint --format json` 调用。内存取 macOS `time` 的 `maximum resident set size`，转为 MiB。这是进程及其后代的最大 RSS 高水位，不是同时刻的进程树内存总和。
- 机器同时有备份、桌面程序和其他构建任务运行；观察到负载从约 4.8 升至 17.8。未停止用户任务，因此耗时结论受噪声限制。

## 测量结果

| 指标                    |        tsgolint |            tsrs |
| ----------------------- | --------------: | --------------: |
| 耗时中位数              |         0.816 s |         0.789 s |
| 耗时范围                |   0.684–1.482 s |   0.570–0.954 s |
| 峰值 RSS 中位数         |       553.7 MiB |       261.4 MiB |
| 峰值 RSS 范围           | 511.2–560.2 MiB | 253.8–267.9 MiB |
| user CPU 时间中位数     |          3.14 s |          2.01 s |
| 每次 lint 诊断 / 退出码 |           0 / 0 |           0 / 0 |

| 轮次 | Go 耗时（s） | Rust 耗时（s） | Go RSS（MiB） | Rust RSS（MiB） |
| ---- | -----------: | -------------: | ------------: | --------------: |
| 1    |       0.8164 |         0.9541 |        553.69 |          259.53 |
| 2    |       0.8508 |         0.6104 |        526.44 |          267.92 |
| 3    |       0.7296 |         0.5868 |        557.63 |          265.69 |
| 4    |       0.6841 |         0.8315 |        559.75 |          261.38 |
| 5    |       1.4819 |         0.8394 |        560.19 |          253.77 |
| 6    |       1.0503 |         0.7895 |        531.47 |          259.89 |
| 7    |       0.7202 |         0.5699 |        511.17 |          265.19 |

每次都检查 JSON 输出：244 个文件、195 条规则、零诊断、退出码 0。两侧的有效配置和文件列表一致；另行捕获的后端请求在排序后完全相同，包含相同的 200 个文件和 25 条类型感知规则。

耗时样本的双侧精确秩和检验 `p = 0.318`，不足以确认加速。内存范围没有重叠，内存收益明确。CPU 时间也降低，但不能将 CPU 时间下降直接当成用户等待时间下降。

非计时 profile 显示，前端仍有 `@shadcn/lint` 的同步 worker 等待（`ask` / `Atomics.wait`）和 Tailwind 初始化开销；替换类型分析后端无法消除这些工作。单独观测的后端 user CPU 时间为 Go 1.97 s、Rust 0.99 s，仅用于定位。原有 `check:source` 完整流程单次耗时 11.49 s，lint 中位数约占 7%；单项收益不能外推为完整验证的同等收益。

## 诊断差异

### Astro content mapper

直接安装后，tsrs 的普通 lint 报 `Invalid tsconfig`，要求 `--runExternalCode`，退出码为 1。这次失败不计入性能样本。

项目已经通过 `contentMappers` 使用 `@astrojs/ts-content-mapper`，现有 `typecheck` 也已显式传入 `--runExternalCode`。给 `lint` 和 `lint:fix` 增加 tsrs 支持的 `TSRS_LINT_RUN_EXTERNAL_CODE=1` 后，普通 lint 恢复为零诊断。该环境变量由 [tsrs 的 lint CLI](https://github.com/oxc-project/tsrs/blob/main/crates/tsrs_lint/src/cli.rs)读取，没有关闭规则。

### 额外的合并类型检查

在 `astro sync` 后，额外比较 `bun run lint --type-check --format json`：

- Go：1 条 `TS2307`，位于 `src/pages/.well-known/api-catalog.ts`。后端日志确认这个点目录文件不属于发现的 tsconfig，落入 inferred program，因而缺少 `@/` 路径别名。两侧都有该问题。
- Rust：同一条 `TS2307`，另有 2 条 `TS6196`，分别位于 `src/pages/posts/[slug].astro` 和 `src/pages/tags/[tag].astro`。报告的 `ASTRO__MergeUnion` 是 mapper 生成的辅助类型，不存在于原始 Astro 源码。独立 `tsc` 和独立 tsrs 使用相同 app 配置均退出 0，差异出现在 lint 后端报告映射代码诊断的路径。

调查期间还出现过 15 条 `posts` / `never` 类型错误。当时 `.astro/content.d.ts` 的 `DataEntryMap` 为空，独立 TypeScript 与 tsrs 都能复现；`astro sync` 恢复集合声明后，两者均通过。现有 tag archive 测试会从临时页面启动 Astro 构建，但沿用项目 root，生成声明会受影响。正式基准在重新同步后运行。

因此本次只切换 lint 后端，保留原有独立 `typecheck`，不使用 `--type-check` 取代它，也不为消除这些诊断修改规则或生成声明。

## 最终接入

安装 `tsrs` 并移除 `oxlint-tsgolint`。Oxlint 版本和 lint 规则不变。两个 lint 脚本均设置 `TSRS_LINT_RUN_EXTERNAL_CODE=1`，其余验证命令保持不变。

复现对比时，临时用 `bun add -D oxlint-tsgolint@7.0.2007` 安装 Go 后端，先运行 `bun run typecheck` 同步 Astro 声明，再交替执行：

```sh
OXLINT_TSGOLINT_PATH="$PWD/node_modules/.bin/tsgolint" /usr/bin/time -lp bun run lint --format json
OXLINT_TSGOLINT_PATH="$PWD/node_modules/.bin/tsrs-lint" /usr/bin/time -lp bun run lint --format json
```

每侧预热一次，再采集至少 5 轮，检查诊断、退出码、文件数与规则数。完成后用 `bun remove oxlint-tsgolint` 恢复最终依赖。

接入方式参考 [Oxc 公告](https://oxc.rs/blog/2026-11-17-faster-type-aware-linting-with-tsrs)。

## 验证

- `bun install --frozen-lockfile`：通过，未改变其他依赖版本。
- `bun run isok`：退出 0，44 个测试文件、113 项测试全部通过，179 个页面构建成功，生成产物与 Git 索引一致。完整耗时 16.90 s；其中 `check:source` 阶段约 9.12 s。这是单次完整验证记录，不用于声称整体加速。
- 单独运行 tag archive 测试：退出 0，并复现生成声明从 5711 字节变为 5477 字节、丢失 `posts` 集合；随后 `bun run typecheck` 退出 0，声明逐字节恢复。
- `bun run lint:fix --format json`：退出 0，零诊断，244 个文件、195 条规则，没有源码改动。
- 最终确认 `.oxlintrc.json` 与基线逐字节一致，旧 Go launcher 已移除，tsrs launcher 存在。
- `git diff --check`：通过。
