import { experiments } from "./experiments";
import { estimateMarkdownTokens } from "./markdown-negotiation";
import { primaryProjectUrl, projects } from "./projects";
import { postHref } from "./published-post";
import { rankPosts, type SearchIndexItem } from "./search";
import { siteConfig } from "./site";
import { stamps, type StampId } from "./stamps";
import type { WebMcpToolDescriptor } from "./webmcp";
import type { WebMcpPost } from "./webmcp-post";

export type ShellTone = "default" | "dim" | "accent" | "film" | "ok" | "error";

export type ShellSegment =
  | { kind: "text"; text: string; tone?: ShellTone }
  | { kind: "link"; text: string; href: string };

export type ShellLine = {
  segments: ShellSegment[];
};

export type ShellExecutionResult = {
  lines: ShellLine[];
  clear?: boolean;
  toggleFlip?: boolean;
  navigateTo?: string;
  unlockedShellStamp?: boolean;
};

export type ShellDeps = {
  loadPosts: () => Promise<SearchIndexItem[]>;
  listTools: () => readonly WebMcpToolDescriptor[];
  invokeTool: (name: string, input: unknown) => Promise<unknown>;
  readStamps: () => Partial<Record<StampId, string>>;
  collectShellStamp: () => boolean;
  random?: () => number;
};

const KNOWN_COMMANDS = [
  "help",
  "ls",
  "grep",
  "cat",
  "mcp",
  "open",
  "fortune",
  "fish",
  "flip",
  "clear",
] as const;

const LS_TARGETS = ["posts", "projects", "stamps", "labs"] as const;

const NAMED_ROUTES: Record<string, string> = {
  home: "/",
  "/": "/",
  posts: "/posts/",
  projects: "/projects/",
  photos: "/photos/",
  tags: "/tags/",
  rss: "/rss/",
  desk: "/lab/desk/",
  logos: "/lab/logos/",
  shell: "/lab/shell/",
};

const KOI_SPECIES = ["红白锦鲤", "秋翠锦鲤", "黄金锦鲤", "白别甲", "丹顶锦鲤", "乌鲤"] as const;

const text = (value: string, tone?: ShellTone): ShellSegment => ({
  kind: "text",
  text: value,
  tone,
});

const link = (value: string, href: string): ShellSegment => ({
  kind: "link",
  text: value,
  href,
});

const line = (...segments: ShellSegment[]): ShellLine => ({ segments });

function formatBytesAndTokens(markdown: string): string {
  const bytes = new TextEncoder().encode(markdown).byteLength;
  const tokens = estimateMarkdownTokens(bytes).toLocaleString("zh-CN");
  return `text/markdown · ${(bytes / 1024).toFixed(1)} KB · ≈ ${tokens} tokens`;
}

function summarizeToolResult(result: unknown): unknown {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return result;
  }
  const record = result as Record<string, unknown>;
  if (typeof record.content === "string" && record.content.length > 360) {
    return {
      ...record,
      content: `${record.content.slice(0, 360)}… (${record.content.length} chars)`,
    };
  }
  return record;
}

function parseMcpInput(toolName: string, rawArgs: string): Record<string, unknown> {
  const trimmed = rawArgs.trim();
  if (!trimmed) {
    return {};
  }
  if (trimmed.startsWith("{")) {
    const parsed: unknown = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error('JSON 参数必须是对象，例如 {"query":"harness"}');
    }
    return parsed as Record<string, unknown>;
  }
  if (toolName === "get_post") {
    return { slug: trimmed.replace(/\.md$/, "") };
  }
  return { query: trimmed };
}

function renderMarkdownLines(markdown: string, maxLines = 48): ShellLine[] {
  const rawLines = markdown.replace(/\r\n/g, "\n").split("\n");
  const visible = rawLines.slice(0, maxLines);
  let fenced = false;

  const lines = visible.map((rawLine) => {
    if (rawLine.startsWith("```")) {
      fenced = !fenced;
      return line(text(rawLine, "film"));
    }
    if (!fenced && /^#{1,6} /u.test(rawLine)) {
      return line(text(rawLine, "accent"));
    }
    return line(text(rawLine));
  });

  if (rawLines.length > maxLines) {
    lines.push(
      line(text(`… 其余 ${rawLines.length - maxLines} 行已折叠，点击下方链接读全文`, "dim")),
    );
  }
  return lines;
}

function buildHelpLines(): ShellLine[] {
  return [
    line(text("可用命令：", "dim")),
    line(
      text("  ls [posts|projects|stamps|labs]", "accent"),
      text("   列出文章、项目、印章或实验室"),
    ),
    line(text("  grep <关键词>", "accent"), text("                     搜索文章标题、摘要和标签")),
    line(
      text("  cat <slug>", "accent"),
      text("                        读取 Markdown 正文与 token 估算"),
    ),
    line(
      text("  mcp tools", "accent"),
      text("                         列出本站注册的 WebMCP 工具"),
    ),
    line(
      text("  mcp call <tool> [参数|JSON]", "accent"),
      text("       现场调用 search_posts / get_post / list_projects"),
    ),
    line(text("  open <slug|栏目>", "accent"), text("                  跳转到指定文章或页面")),
    line(text("  fortune", "accent"), text("                           随机抽一句站点摘录")),
    line(text("  fish", "accent"), text("                              ASCII 锦鲤池垂钓")),
    line(
      text("  flip", "accent"),
      text("                              颠倒终端 180° 并切换昼夜世界"),
    ),
    line(text("  clear", "accent"), text("                             清空输出")),
  ];
}

async function handleLs(target: string, deps: ShellDeps): Promise<ShellExecutionResult> {
  const scope = (target || "posts").toLowerCase();

  if (scope === "posts") {
    const posts = await deps.loadPosts();
    const latest = posts.slice(0, 10);
    return {
      lines: [
        line(
          text(
            `最近文章（显示 ${latest.length} / ${posts.length} 篇 · 用 grep 或 cat <slug> 深入）：`,
            "dim",
          ),
        ),
        ...latest.map((post) =>
          line(
            text(`${post.date}  `, "dim"),
            text(`${post.slug}  `, "film"),
            link(post.title, postHref(post.slug)),
          ),
        ),
      ],
    };
  }

  if (scope === "projects") {
    return {
      lines: [
        line(text(`工具箱项目（共 ${projects.length} 个）：`, "dim")),
        ...projects.map((project) =>
          line(
            text(project.id.padEnd(12), "film"),
            text(project.kind.padEnd(10), "dim"),
            link(project.name, primaryProjectUrl(project)),
            text(` — ${project.summary}`, "dim"),
          ),
        ),
      ],
    };
  }

  if (scope === "stamps") {
    const collected = deps.readStamps();
    const collectedCount = stamps.filter((stamp) => Boolean(collected[stamp.id])).length;
    return {
      lines: [
        line(text(`颠倒世界集章册（${collectedCount} / ${stamps.length}）：`, "dim")),
        ...stamps.map((stamp) => {
          const date = collected[stamp.id];
          return date
            ? line(text("[✓] ", "ok"), text(`${stamp.seal}  `, "accent"), text(date, "dim"))
            : line(text("[·] ", "dim"), text(`${stamp.seal}  `, "dim"), text("未盖章", "dim"));
        }),
      ],
    };
  }

  if (scope === "labs") {
    return {
      lines: [
        line(text(`实验室（${experiments.length} 项）：`, "dim")),
        ...experiments.map((item) =>
          line(
            text(item.id.padEnd(16), "film"),
            link(item.title, item.href),
            text(`  ${item.href}`, "dim"),
          ),
        ),
      ],
    };
  }

  return {
    lines: [line(text(`未知目录：${scope}。可选 posts / projects / stamps / labs`, "error"))],
  };
}

async function handleGrep(query: string, deps: ShellDeps): Promise<ShellExecutionResult> {
  if (!query) {
    return { lines: [line(text("用法：grep <关键词>，例如 grep Harness", "error"))] };
  }
  const posts = await deps.loadPosts();
  const matches = rankPosts(posts, { query });
  if (matches.length === 0) {
    return { lines: [line(text(`没有命中「${query}」的文章。`, "dim"))] };
  }
  const visible = matches.slice(0, 10);
  return {
    lines: [
      line(text(`命中 ${matches.length} 篇，显示 ${visible.length} 篇：`, "ok")),
      ...visible.map((post) =>
        line(
          text(`${post.date}  `, "dim"),
          text(`${post.slug}  `, "film"),
          link(post.title, postHref(post.slug)),
        ),
      ),
    ],
  };
}

async function handleCat(rawSlug: string, deps: ShellDeps): Promise<ShellExecutionResult> {
  const slug = rawSlug
    .trim()
    .replace(/^\/?posts\//, "")
    .replace(/\/$/, "")
    .replace(/\.md$/, "");
  if (!slug) {
    return { lines: [line(text("用法：cat <slug>，先用 ls posts 查看文章 slug", "error"))] };
  }

  const raw = (await deps.invokeTool("get_post", { slug })) as WebMcpPost;
  const unlocked = deps.collectShellStamp();

  const lines: ShellLine[] = [
    line(text(raw.title, "accent")),
    ...renderMarkdownLines(raw.content),
    line(
      text(`[${formatBytesAndTokens(raw.content)}] · `, "dim"),
      link("在阅读页打开全文 →", postHref(raw.slug)),
    ),
  ];

  if (unlocked) {
    lines.push(line(text("✓ 彩蛋盖章：「终端潜行」已收录进集章册", "ok")));
  }

  return { lines, unlockedShellStamp: unlocked };
}

async function handleMcp(rest: string, deps: ShellDeps): Promise<ShellExecutionResult> {
  const trimmed = rest.trim();
  if (!trimmed || trimmed === "tools") {
    const tools = deps.listTools();
    return {
      lines: [
        line(text(`已注册 WebMCP 工具（${tools.length} 个只读工具）：`, "dim")),
        ...tools.map((tool) =>
          line(
            text(`  ${tool.name.padEnd(16)}`, "accent"),
            text(`${tool.title} — ${tool.description}`),
          ),
        ),
        line(
          text(
            '示例：mcp call search_posts harness 或 mcp call search_posts {"query":"Agent","limit":3}',
            "dim",
          ),
        ),
      ],
    };
  }

  const callMatch = /^call\s+(\S+)(?:\s+([\s\S]*))?$/.exec(trimmed);
  if (!callMatch) {
    return {
      lines: [line(text("用法：mcp tools 或 mcp call <tool> [关键词|JSON]", "error"))],
    };
  }

  const [, toolName, rawArgs = ""] = callMatch;
  const input = parseMcpInput(toolName, rawArgs);
  const result = await deps.invokeTool(toolName, input);
  const unlocked = deps.collectShellStamp();
  const formatted = JSON.stringify(summarizeToolResult(result), null, 2);

  const lines: ShellLine[] = [
    line(text(`→ webmcp.call("${toolName}", ${JSON.stringify(input)})`, "ok")),
    ...formatted.split("\n").map((jsonLine) => line(text(jsonLine))),
  ];
  if (unlocked) {
    lines.push(line(text("✓ 彩蛋盖章：「终端潜行」已收录进集章册", "ok")));
  }
  return { lines, unlockedShellStamp: unlocked };
}

async function handleFortune(deps: ShellDeps): Promise<ShellExecutionResult> {
  const posts = await deps.loadPosts();
  const rand = deps.random ?? Math.random;
  const pool: Array<{ quote: string; source: string; href?: string }> = [
    { quote: siteConfig.motto, source: siteConfig.title, href: "/" },
    ...posts
      .filter((post) => post.summary.trim().length > 0)
      .map((post) => ({
        quote: post.summary,
        source: `《${post.title}》 · ${post.date}`,
        href: postHref(post.slug),
      })),
  ];
  const pick = pool[Math.floor(rand() * pool.length)] ?? pool[0];
  return {
    lines: [
      line(text(`「${pick.quote}」`, "film")),
      pick.href
        ? line(text("  —— ", "dim"), link(pick.source, pick.href))
        : line(text(`  —— ${pick.source}`, "dim")),
    ],
  };
}

async function handleFish(deps: ShellDeps): Promise<ShellExecutionResult> {
  const rand = deps.random ?? Math.random;
  const roll = rand();
  if (roll > 0.86) {
    const posts = await deps.loadPosts();
    const bottle = posts[Math.floor(rand() * posts.length)];
    if (bottle) {
      return {
        lines: [
          line(text("~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~", "dim")),
          line(text("   [🍾] 钓上的不是鱼，是一只漂流瓶！", "film")),
          line(text("   旧文：", "dim"), link(bottle.title, postHref(bottle.slug))),
          line(text("~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~", "dim")),
        ],
      };
    }
  }

  const species = KOI_SPECIES[Math.floor(rand() * KOI_SPECIES.length)] ?? KOI_SPECIES[0];
  const length = 32 + Math.floor(rand() * 27);
  return {
    lines: [
      line(text("~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~", "dim")),
      line(text("       ><(((°>    ", "accent"), text(`${species} · ${length} cm`, "film")),
      line(text("  ~ ~  ", "dim"), text("「别提竿，他还没点合并。」", "ok"), text("  ~ ~", "dim")),
      line(text("~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~", "dim")),
    ],
  };
}

async function handleOpen(target: string, deps: ShellDeps): Promise<ShellExecutionResult> {
  const key = target.trim();
  if (!key) {
    return {
      lines: [line(text("用法：open <slug|posts|projects|photos|rss|desk|logos>", "error"))],
    };
  }
  const routeName = key.toLowerCase();
  if (Object.hasOwn(NAMED_ROUTES, routeName)) {
    const route = NAMED_ROUTES[routeName];
    return {
      lines: [line(text(`正在前往 ${route} …`, "ok"))],
      navigateTo: route,
    };
  }
  const slug = key.replace(/^\/?posts\//, "").replace(/\/$/, "");
  const posts = await deps.loadPosts();
  const match = posts.find((post) => post.slug === slug);
  if (!match) {
    return { lines: [line(text(`找不到文章：${slug}`, "error"))] };
  }
  const href = postHref(match.slug);
  return {
    lines: [line(text(`正在打开 ${href} …`, "ok"))],
    navigateTo: href,
  };
}

export async function executeShellCommand(
  rawInput: string,
  deps: ShellDeps,
): Promise<ShellExecutionResult> {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { lines: [] };
  }

  const spaceIndex = trimmed.indexOf(" ");
  const command = (spaceIndex === -1 ? trimmed : trimmed.slice(0, spaceIndex)).toLowerCase();
  const rest = spaceIndex === -1 ? "" : trimmed.slice(spaceIndex + 1).trim();

  try {
    switch (command) {
      case "help":
      case "?":
        return { lines: buildHelpLines() };
      case "clear":
        return { lines: [], clear: true };
      case "ls":
        return await handleLs(rest, deps);
      case "grep":
        return await handleGrep(rest, deps);
      case "cat":
        return await handleCat(rest, deps);
      case "mcp":
        return await handleMcp(rest, deps);
      case "open":
        return await handleOpen(rest, deps);
      case "fortune":
        return await handleFortune(deps);
      case "fish":
        return await handleFish(deps);
      case "flip":
        return {
          lines: [
            line(text("世界已颠倒 180°（再敲一次 flip 或点击顶部恢复按钮翻回来）", "accent")),
          ],
          toggleFlip: true,
        };
      default:
        return {
          lines: [line(text(`command not found: ${command}（输入 help 查看全部命令）`, "error"))],
        };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      lines: [line(text(`执行失败：${message}`, "error"))],
    };
  }
}

export function completeShellInput(rawInput: string, slugs: readonly string[]): string {
  const input = rawInput.trimStart();
  if (!input) {
    return rawInput;
  }

  if (!input.includes(" ")) {
    const match = KNOWN_COMMANDS.find((cmd) => cmd.startsWith(input.toLowerCase()));
    return match ? `${match} ` : rawInput;
  }

  const parts = input.split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const current = parts.at(-1) ?? "";

  if (cmd === "ls" && parts.length === 2) {
    const match = LS_TARGETS.find((target) => target.startsWith(current.toLowerCase()));
    return match ? `ls ${match}` : rawInput;
  }

  if (cmd === "mcp" && parts.length === 2) {
    const match = ["tools", "call"].find((sub) => sub.startsWith(current.toLowerCase()));
    return match ? `mcp ${match} ` : rawInput;
  }

  if (cmd === "mcp" && parts[1] === "call" && parts.length === 3) {
    const match = ["search_posts", "get_post", "list_projects"].find((name) =>
      name.startsWith(current.toLowerCase()),
    );
    return match ? `mcp call ${match} ` : rawInput;
  }

  const slugCompleting =
    ((cmd === "cat" || cmd === "open") && parts.length === 2) ||
    (cmd === "mcp" && parts[1] === "call" && parts[2] === "get_post" && parts.length === 4);

  if (slugCompleting && current) {
    const match = slugs.find((slug) => slug.toLowerCase().startsWith(current.toLowerCase()));
    if (match) {
      parts[parts.length - 1] = match;
      return parts.join(" ");
    }
  }

  return rawInput;
}
