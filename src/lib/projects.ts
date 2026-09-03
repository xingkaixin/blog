import { normalizeSearchText, searchTerms } from "./search-text";

export interface ProjectLink {
  label: string;
  url: string;
}

interface ProjectDetails {
  id: string;
  name: string;
  kind: string;
  description: string;
  logo: string;
  tags: string[];
}

export type Project = ProjectDetails &
  ({ url: string; links?: never } | { url?: never; links: [ProjectLink, ...ProjectLink[]] });

export const projects: Project[] = [
  {
    id: "quotecue",
    name: "QuoteCue",
    kind: "浏览器扩展",
    description:
      "一款为 AI 对话设计的浏览器扩展。选中 ChatGPT、Claude、DeepSeek 或 Kimi 回复中的片段添加批注，把多处引用与评论整理成一条结构化追问；草稿按会话保存在本地。",
    logo: "/projects/quotecue.png",
    links: [
      { label: "网站", url: "https://quotecue.xingkaixin.me/" },
      {
        label: "Chrome",
        url: "https://chromewebstore.google.com/detail/quotecue/gbppndnpgjmgmbepccdcbfmdjjiehofp",
      },
      {
        label: "Edge",
        url: "https://microsoftedge.microsoft.com/addons/detail/icopgahikmamgfagjdjjdfobfnhicbie",
      },
    ],
    tags: ["AI", "Chrome", "Edge", "浏览器扩展"],
  },
  {
    id: "yomitomo",
    name: "Yomitomo",
    kind: "桌面应用",
    description:
      "Yomitomo 是面向深度阅读的本地阅读伙伴，把网页阅读、文本批注、讨论线程和 AI 助手放进同一个阅读现场。它的目标是让用户在阅读时直接留下判断、追问和上下文，并让 AI 助手围绕原文参与批注。",
    logo: "/projects/yomitomo.png",
    url: "https://yomitomo.app",
    tags: ["AI", "阅读工具"],
  },
  {
    id: "voicen",
    name: "Voicen",
    kind: "iOS 应用",
    description:
      "一款 iOS 原生语音笔记应用。点击即可开始录音，后台自动完成语音转写和大语言模型润色，保存为包含原始音频与整理文本的笔记。",
    logo: "/projects/voicen.png",
    url: "https://voicen.xingkaixin.me/",
    tags: ["AI", "iOS", "语音笔记"],
  },
  {
    id: "codesesh",
    name: "CodeSesh",
    kind: "Web / CLI",
    description:
      "一个地方看遍所有 AI 编程会话。自动扫描本地文件系统，在统一 Web UI 中呈现 Claude Code、Cursor、Kimi 等多工具的对话历史，支持回放、成本统计与全文搜索。",
    logo: "/projects/codesesh.svg",
    url: "https://codesesh.xingkaixin.me",
    tags: ["AI", "CLI", "开发者工具"],
  },
  {
    id: "skills",
    name: "Skills",
    kind: "CLI",
    description:
      "统一管理 Claude Code 的外部 skill 仓库。聚合上游 vendor skill 与自定义 sources，对外提供标准化的 skills 目录。",
    logo: "/projects/skills.svg",
    url: "https://skills.xingkaixin.me",
    tags: ["AI", "SKILLS"],
  },
  {
    id: "unquote",
    name: "Unquote",
    kind: "Web / 扩展",
    description:
      "检测并递归展开 JSON 中的字符串化值，专为 AI 模型输出和 MCP/Agent 工具调用中的嵌套 JSON 设计。支持 JSONL、语法高亮与路径显示。",
    logo: "/projects/unquote.svg",
    links: [
      { label: "网站", url: "https://unquote.xingkaixin.me" },
      {
        label: "Chrome",
        url: "https://chromewebstore.google.com/detail/unquote/ohcepfneflaihakpkkgmnbdgjhnmcjeg",
      },
      {
        label: "Edge",
        url: "https://microsoftedge.microsoft.com/addons/detail/amdbhljchamjbhknbamkcemccmelegdp",
      },
    ],
    tags: ["工具", "JSON", "JSONL"],
  },
  {
    id: "agent-dump",
    name: "Agent Dump",
    kind: "CLI",
    description:
      "AI 编程助手会话导出工具。支持 Claude Code、OpenCode、Codex、Kimi 等多工具，提供交互式选择、批量导出和 Token 统计。",
    logo: "/projects/agent-dump.svg",
    url: "https://agent-dump.xingkaixin.me",
    tags: ["AI", "CLI"],
  },
  {
    id: "ddlbuilder",
    name: "DDLBuilder",
    kind: "Web 应用",
    description:
      "多数据库建表语句生成器。通过表单实时生成 MySQL、PostgreSQL、Oracle 等九种数据库的 DDL，支持分区表、索引、权限配置与 SQL 导入解析。",
    logo: "/projects/ddlbuilder.svg",
    url: "https://ddl.xingkaixin.me",
    tags: ["工具", "数据库"],
  },
  {
    id: "shipit",
    name: "Shipit",
    kind: "Web 工具",
    description:
      "在浏览器中把产品 Logo、截图、名称、版本与发布信息生成 5 秒产品发布短片，支持实时预览、1080p/4K 与 MP4 本地导出。",
    logo: "/projects/shipit.png",
    url: "https://shipit.xingkaixin.me/",
    tags: ["工具", "Web", "视频"],
  },
  {
    id: "db-ferry",
    name: "DB Ferry",
    kind: "CLI",
    description:
      "多数据库迁移 CLI 工具。通过声明式 task.toml 配置，在 Oracle、MySQL、PostgreSQL、SQLite 等数据库间流式传输数据，支持断点续传与批量校验。",
    logo: "/projects/db-ferry.svg",
    url: "https://db-ferry.xingkaixin.me",
    tags: ["CLI", "数据库"],
  },
];

export function primaryProjectUrl(project: Project): string {
  return project.url ?? project.links[0].url;
}

export function rankProjects(items: Project[], query: string): Project[] {
  const terms = searchTerms(query);
  if (terms.length === 0) {
    return items;
  }

  return items
    .map((project, index) => {
      const name = normalizeSearchText(project.name);
      const kind = normalizeSearchText(project.kind);
      const description = normalizeSearchText(project.description);
      const tags = project.tags.map(normalizeSearchText);
      const termScores = terms.map((term) => {
        const nameBoost = name.includes(term) ? 8 : 0;
        const tagBoost = tags.some((tag) => tag.includes(term)) ? 5 : 0;
        const kindBoost = kind.includes(term) ? 3 : 0;
        const descriptionBoost = description.includes(term) ? 1 : 0;
        return nameBoost + tagBoost + kindBoost + descriptionBoost;
      });
      return {
        project,
        index,
        matched: termScores.every((score) => score > 0),
        score: termScores.reduce((sum, score) => sum + score, 0),
      };
    })
    .filter((result) => result.matched)
    .toSorted((left, right) => right.score - left.score || left.index - right.index)
    .map((result) => result.project);
}
