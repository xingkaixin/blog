---
name: migrate-mp-wexin
description: 将 mp-wexin/2026 中标记为 published 的公众号文章迁移到博客。支持单篇迁移或按发布日期批量迁移。当用户说"迁移文章"、"migrate"、"导入"，或提到某篇文章的目录/slug 时触发。
metadata:
  version: "1.0.1"
---

# migrate-mp-wexin

将公众号文章迁移到 Astro 博客，包含：正文复制、封面图、插图迁移、路径更新、frontmatter 生成。

## 用法

```
/migrate-mp-wexin                           # 交互式选择
/migrate-mp-wexin <folder-name>             # 迁移单篇（源目录名，可含中文或空格）
/migrate-mp-wexin 2026/09/<slug> ...        # 按指定顺序迁移多篇
/migrate-mp-wexin --since 2026-06-01        # 迁移该日期之后发布的所有文章
/migrate-mp-wexin --all                     # 迁移所有 published、尚未在博客中的文章
```

## 路径约定

| 位置         | 路径                                                     |
| ------------ | -------------------------------------------------------- |
| 源文章根目录 | `/Users/Kevin/workspace/projects/personal/mp-wexin/2026` |
| 博客根目录   | `/Users/Kevin/workspace/projects/personal/blog`          |
| 博客文章     | `content/posts/<slug>.md`                                |
| 封面图       | `src/assets/cover/<slug>.png`                            |
| 插图母版     | `src/assets/post-images/<slug>/<filename>`               |

frontmatter 中 `cover` 只写封面文件名：`<slug>.png`。正文插图 URL 写成 `/posts/images/<slug>/<filename>`。

`public/cover/`、`public/posts/images/`、`public/search-index.json` 和 `src/lib/generated/` 是生成产物，不要直接复制或编辑。

## 工作流

### 阶段 0：确定待处理文章列表

**指定文章模式**：用户可指定一个或多个文章目录名、slug 或 `2026/<month>/<folder>` 路径。目录名或 slug 在源根目录的月份子目录中查找；带年份的路径从源根目录的父目录解析。按用户给出的顺序处理，确认每篇 `status: published` 且 `published_date` 非空。

**批量模式**（`--since <date>` 或 `--all`）：

```bash
rg --files /Users/Kevin/workspace/projects/personal/mp-wexin/2026 -g meta.yaml | sort
```

读取每个 `meta.yaml`，筛选条件：

- `status: published`
- `published_date` 存在且不为空
- `--since` 模式：`published_date >= 指定日期`
- 对应博客文章 `content/posts/<slug>.md` 不存在（未迁移）

### 阶段 1：逐篇处理（顺序执行，不并发）

对每篇文章按以下步骤处理：

#### 步骤 1：读取源文件

```bash
# 源目录（路径含特殊字符时务必用双引号）
SOURCE_DIR="/Users/Kevin/workspace/projects/personal/mp-wexin/2026/<month>/<folder>"

cat "$SOURCE_DIR/meta.yaml"           # title, date, published_date
cat "$SOURCE_DIR/README.md"           # 文章正文
cat "$SOURCE_DIR/abstract.md" 2>/dev/null   # 摘要（如有）
cat "$SOURCE_DIR/cover.md" 2>/dev/null      # 封面提示词（如有）
```

#### 步骤 2：确定 slug

规则（按优先级）：

1. 文件夹名已是纯英文/连字符形式（如 `agent-guesses-not-debug`）→ 直接用，转小写，下划线改连字符
2. 文件夹名含中文或混合字符 → 根据文章标题和内容翻译为简洁英文 slug（小写、连字符分隔）

**检查已迁移**：

```bash
test -f "/Users/Kevin/workspace/projects/personal/blog/content/posts/<slug>.md" && echo "已存在，跳过"
```

#### 步骤 3：确定封面并移除正文中的重复引用

- 结合源目录、`cover.md` 和正文图片引用确定实际封面文件，不要默认把第一张插图当封面。复制到 `src/assets/cover/<slug>.<ext>`，保留原格式。
- 如果正文也引用了这张封面，删除迁移正文中所有对应图片引用，不将它作为插图复制。博客文章页已展示封面，再保留正文引用会重复显示。
- 按解析后的源文件路径判断；若文件名不同但可能是同一张图，比较文件内容或查看图片确认。仅移除确认与封面相同的图片，保留其他插图和正文文字。源文章不修改。

#### 步骤 4：提取并复制其余插图

从 README.md 中找所有图片引用：

```bash
rg -n '!\[.*?\]\([^)]*\)' "$SOURCE_DIR/README.md"
```

排除步骤 3 中的封面引用，对剩余引用的本地图片：

```bash
mkdir -p "/Users/Kevin/workspace/projects/personal/blog/src/assets/post-images/<slug>"
cp "$SOURCE_DIR/<filename>" "/Users/Kevin/workspace/projects/personal/blog/src/assets/post-images/<slug>/<filename>"
```

#### 步骤 5：更新图片引用

将 README.md 内容中的图片路径：

- `![alt](filename.png)` → `![alt](/posts/images/<slug>/filename.png)`

#### 步骤 6：生成 summary

- 有 `abstract.md` → 使用其全文内容
- 无 `abstract.md` → 根据 README.md 内容，用中文写 1-3 句摘要（50-150 字），直接点出核心论点，不要废话

#### 步骤 7：生成 tags

根据文章内容生成 2-5 个标签，可中文或英文技术术语，YAML 列表格式。

#### 步骤 8：写博客文章

创建 `content/posts/<slug>.md`：

```markdown
---
title: "<meta.yaml 中的 title>"
date: "<published_date>"
summary: <步骤6生成的摘要>
tags:
  - Tag1
  - Tag2
cover: <slug>.png
coverAlt: <文章中文标题>
---

<README.md 正文，重复标题和封面引用已移除，其余图片引用已更新>
```

**注意**：

- `title` 值用引号包裹；使用单引号时，值中的单引号写成两个单引号
- 博客通过 frontmatter 渲染文章标题，正文禁止 H1。移除源文开头与文章标题重复的 H1，其余正文不改写；若正文另有 H1，将其调整为合适的下级标题
- 除上述标题处理、移除重复封面引用和更新插图路径外，README.md 内容直接复制
- `date` 使用 `published_date`，不是 `created`

### 阶段 2：生成并验证

所有文章处理完成后运行 `bun run build`，由现有脚本生成封面、插图和搜索索引，并验证 frontmatter 与文章构建。

逐篇核对迁移后的正文：重复标题和封面引用已移除，其余插图都有对应母版，除上述迁移变更外与源文一致。检查构建日志没有文章渲染错误，并确认生成页面正文完整、只在页面封面位置展示封面。

### 阶段 3：汇总报告

处理完所有文章后输出：

```
迁移完成

成功（N 篇）：
  ✓ <slug> (<title>)
  ...

跳过-已存在（N 篇）：
  - <slug>
  ...

失败（N 篇）：
  ✗ <slug>：<失败原因>
  ...
```

## 常见问题

**路径含空格或中文字符**：所有 bash 路径操作必须用双引号包裹。

**meta.yaml 解析**：用 `cat` 读取后手动提取字段值，不依赖 YAML 解析工具。

**图片引用提取**：用 `rg` 定位 Markdown 图片引用；引用式图片或 HTML `<img>` 也要检查，重复封面的排除规则相同。

**slug 冲突**：生成 slug 前先检查 `content/posts/<slug>.md` 是否存在。
