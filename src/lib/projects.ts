export interface Project {
  name: string;
  description: string;
  logo: string;
  url?: string;
  tags?: string[];
}

export const projects: Project[] = [
  {
    name: "CodeSesh",
    description:
      "一个地方看遍所有 AI 编程会话。自动扫描本地文件系统，在统一 Web UI 中呈现 Claude Code、Cursor、Kimi 等多工具的对话历史，支持回放、成本统计与全文搜索。",
    logo: "/projects/codesesh.svg",
    url: "https://codesesh.xingkaixin.me",
    tags: ["AI", "CLI", "开发者工具"],
  },
  {
    name: "Skills",
    description:
      "统一管理 Claude Code 的外部 skill 仓库。聚合上游 vendor skill 与自定义 sources，对外提供标准化的 skills 目录。",
    logo: "/projects/skills.svg",
    url: "https://skills.xingkaixin.me",
    tags: ["AI", "SKILLS"],
  },
  {
    name: "Unquote",
    description:
      "检测并递归展开 JSON 中的字符串化值，专为 AI 模型输出和 MCP/Agent 工具调用中的嵌套 JSON 设计。支持 JSONL、语法高亮与路径显示。",
    logo: "/projects/unquote.svg",
    url: "https://unquote.xingkaixin.me",
    tags: ["工具", "JSON", "JSONL"],
  },
  {
    name: "Agent Dump",
    description:
      "AI 编程助手会话导出工具。支持 Claude Code、OpenCode、Codex、Kimi 等多工具，提供交互式选择、批量导出和 Token 统计。",
    logo: "/projects/agent-dump.svg",
    url: "https://agent-dump.xingkaixin.me",
    tags: ["AI", "CLI"],
  },
  {
    name: "DDLBuilder",
    description:
      "多数据库建表语句生成器。通过表单实时生成 MySQL、PostgreSQL、Oracle 等九种数据库的 DDL，支持分区表、索引、权限配置与 SQL 导入解析。",
    logo: "/projects/ddlbuilder.svg",
    url: "https://ddl.xingkaixin.me",
    tags: ["工具", "数据库"],
  },
  {
    name: "DB Ferry",
    description:
      "多数据库迁移 CLI 工具。通过声明式 task.toml 配置，在 Oracle、MySQL、PostgreSQL、SQLite 等数据库间流式传输数据，支持断点续传与批量校验。",
    logo: "/projects/db-ferry.svg",
    url: "https://db-ferry.xingkaixin.me",
    tags: ["CLI", "数据库"],
  },
];
