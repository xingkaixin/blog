# 文章英文翻译准则

本站所有已发布中文文章（`content/posts/<slug>.md`）均对应一份 AI 翻译的英文版本，存放在 `content/posts-en/<slug>.md`。本文档是批量翻译与后续新增文章翻译的统一规范，执行翻译的 Agent 必须严格遵守，保证全站英文译文风格、结构与契约一致。

## 1. 文件路径与命名

- 中文原文：`content/posts/<slug>.md`
- 英文译文：`content/posts-en/<slug>.md`
- `<slug>` 必须与中文原文文件名**逐字符一致**（区分大小写），目录保持平铺，禁止子目录。
- 草稿（中文 frontmatter 含 `draft: true`）不要求翻译。

## 2. Frontmatter 契约

英文文件只保存需要翻译的字段与原文哈希；`date`、`updated`、`tags`、`cover`、`draft` 全部由构建代码从中文原文自动继承，**禁止**在英文 frontmatter 中重复写入或修改这些字段。

```yaml
---
title: "English Title Here"
summary: "Concise English summary matching the Chinese summary."
coverAlt: "Concise English description of the cover image."
sourceHash: "<16-char lowercase hex sha256>"
---
```

字段规则：

- `title`：自然、准确的英文标题。用双引号包裹，内部双引号转义为 `\"`。不要在结尾加句号。
- `summary`：忠实对应中文 `summary` 的核心观点，1–3 句直白英文。用双引号包裹，禁止换行。
- `coverAlt`：中文 `coverAlt` 的自然英文表述。若中文 `coverAlt` 只是 slug 或文件名占位符，改写为简洁的英文标题或封面描述。用双引号包裹。
- `sourceHash`：对中文原文 `content/posts/<slug>.md` 全文计算的 SHA-256 前 16 位小写十六进制字符串。必须通过命令获取，不要手算：
  ```bash
  bun scripts/validate-post-translations.ts hash <slug>
  ```

## 3. 翻译风格与语气

- **直白、自然、克制的美式技术博客 / 随笔英文**。
- 保留作者的第一人称口吻（`I` / `we`）和论述节奏，保持短句和清晰段落，不要写成学术论文腔，也不要堆砌华丽修辞。
- 避免典型 AI 翻译套话（如 "In today's rapidly evolving landscape", "It is worth noting that", "Let's delve into", "In conclusion" 等）。
- **忠实原文，不增删内容**：
  - 不删减段落、例子、数据、日期、引用或观点。
  - 不自行脑补原文没有的背景解释、免责声明或总结段落。
  - **不要**在正文开头或结尾添加 "This post is AI-translated..." 之类的声明——页面模板会统一渲染 AI 翻译提示栏与原文切换按钮。

## 4. 术语与专有名词

- 保留原文已有的英文产品名、模型名、工具名、框架名、协议、命令、标识符和缩写（如 `Claude Code`、`Codex`、`MCP`、`WebMCP`、`Astro`、`Cloudflare Workers`、`Harness`、`Spec`、`Agent`、`LLM`、`Token`、`Prompt`、`Vibe Coding`、`Git`、`CLI`、`CI`、`PR`）。
- 常见中文技术词统一用行业惯用英文：
  - 大模型 → `LLM` / `large language model`
  - 上下文 / 上下文窗口 → `context` / `context window`
  - 上下文压缩 → `context compaction`
  - 提示词 → `prompt`
  - 幻觉 → `hallucination`
  - 代码审查 → `code review`
  - 回归测试 → `regression test`
  - 基准测试 / 评测 → `benchmark` / `eval`
  - 脚手架 / 工程底座 / 运行外壳 → `harness`（视语境）
  - 个人博客作者名保留 `XingKaiXin`。
- 影视、书籍、地名使用标准英文名（例如：《最后生还者》→ _The Last of Us_，《足球教练》→ _Ted Lasso_，《新闻编辑室》→ _The Newsroom_，清迈 → Chiang Mai，契迪龙寺 → Wat Chedi Luang，塔佩门 → Tha Phae Gate，宁曼路 → Nimman Road，松德寺 → Wat Suan Dok，静心湖 → Ang Kaew Lake，上海话 → Shanghainese）。
- 中文口语、俗语或互联网表达按语义自然意译，不逐字生硬直译；如果原文专门讨论某个中文词/方言/中文 Prompt 示例，可在英文解释旁用括号保留原中文词以便读者理解。

## 5. Markdown 结构、代码与媒体（严格校验项）

以下结构会由 `bun scripts/validate-post-translations.ts check` 自动校验，违反将报错：

1. **标题层级**：
   - 正文**禁止出现 H1（`# `）**，文章标题由 frontmatter 渲染。
   - 保持与原文一致的 `##` / `###` / `####` 标题层级和结构。
2. **图片引用**：
   - **所有图片 URL 必须与中文原文完全一致且顺序一致**（如 `/posts/images/<slug>/foo.png`），不得删除、重命名或修改路径。
   - 图片的 `alt` 文本翻译为自然英文（`![English alt](/posts/images/<slug>/foo.png)`）。
   - 如果文章包含 HTML `<img>` 标签，同样保留 `src` 不变，仅翻译 `alt`。
3. **代码块与行内代码**：
   - 围栏代码块（` ``` ` 或 `~~~`）的**数量与语言标识必须与原文一致**。
   - 代码块内的命令、代码逻辑、配置键名、JSON/YAML 结构、终端输出**原样保留**，不要改写代码行为；仅在代码中有大段面向读者的中文解释性注释时，可翻译注释内容（不影响代码本身）。
   - 行内代码（`` `...` ``）里的命令、路径、参数、变量名原样保留。
4. **链接**：
   - 外部链接 URL 原样保留，只翻译链接文字。
   - 站内链接指向博客双语路径时改写为英文前缀：
     - `/posts/<other-slug>/` → `/en/posts/<other-slug>/`（如带有中文锚点 `#...`，移除锚点以免失效）
     - `/projects/` → `/en/projects/`
     - `/photos/` → `/en/photos/`
     - `/rss/` → `/en/rss/`
   - 指向非双语页面（如 `/tags/...`、`/lab/...`）的站内链接保持原路径不变。
5. **排版格式**：
   - 保留原有的引用块（`>`）、列表、表格、加粗、斜体、水平分割线（`---`）和段落分隔。
   - 表格列数与行数与原文对应。

## 6. 校验命令

每篇翻译完成后运行：

```bash
bun scripts/validate-post-translations.ts check <slug>
```

全量检查所有文章：

```bash
bun scripts/validate-post-translations.ts check
```
