import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  completeShellInput,
  executeShellCommand,
  type ShellDeps,
  type ShellLine,
  type ShellSegment,
  type ShellTone,
} from "@/lib/agent-shell";
import { loadSearchIndex, type SearchIndexItem } from "@/lib/search";
import { THEME_TOGGLE_EVENT } from "@/lib/site-events";
import { collectStamp, readStamps, STAMP_COLLECTED_EVENT } from "@/lib/stamps";
import { cn } from "@/lib/utils";
import { invokeBlogWebMcpTool, listBlogWebMcpTools } from "@/lib/webmcp";

type KeyedSegment = ShellSegment & { key: string };

type KeyedLine = {
  key: string;
  segments: KeyedSegment[];
};

type TerminalEntry = {
  id: number;
  command?: string;
  lines: KeyedLine[];
};

function keyLines(entryId: number, lines: ShellLine[]): KeyedLine[] {
  let lineCounter = 0;
  return lines.map((shellLine) => {
    const lineKey = `${entryId}-l${lineCounter++}`;
    let segCounter = 0;
    return {
      key: lineKey,
      segments: shellLine.segments.map((segment) => ({
        ...segment,
        key: `${lineKey}-s${segCounter++}`,
      })),
    };
  });
}

type AgentShellProps = {
  featuredSlug: string;
};

const TONE_CLASS: Record<ShellTone, string> = {
  default: "text-ink-600",
  dim: "text-ink-400",
  accent: "text-accent",
  film: "text-film",
  ok: "text-ink-800",
  error: "text-accent",
};

const INTRO_LINES: ShellLine[] = [
  {
    segments: [
      { kind: "text", text: "欢迎进入 ", tone: "default" },
      { kind: "text", text: "行开心的颠倒世界", tone: "accent" },
      {
        kind: "text",
        text: " Agent 终端漫游器（直连本站 WebMCP 工具与 Markdown 静态数据）。",
        tone: "default",
      },
    ],
  },
  {
    segments: [
      {
        kind: "text",
        text: "点击上方快捷命令，或直接输入 ls / grep / cat / mcp / fish / flip，按 Tab 自动补全。",
        tone: "dim",
      },
    ],
  },
];

export function AgentShell({ featuredSlug }: AgentShellProps) {
  const tools = useMemo(() => listBlogWebMcpTools(), []);
  const quickCommands = useMemo(
    () => [
      { label: "ls posts", cmd: "ls posts" },
      { label: "mcp call", cmd: "mcp call search_posts Agent" },
      { label: "cat markdown", cmd: `cat ${featuredSlug}` },
      { label: "ls stamps", cmd: "ls stamps" },
      { label: "fish", cmd: "fish" },
      { label: "flip 180°", cmd: "flip" },
    ],
    [featuredSlug],
  );

  const [entries, setEntries] = useState<TerminalEntry[]>(() => [
    { id: 0, lines: keyLines(0, INTRO_LINES) },
  ]);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [stampUnlocked, setStampUnlocked] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const historyCursorRef = useRef(-1);
  const nextIdRef = useRef(1);
  const slugsRef = useRef<string[]>([featuredSlug]);
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadPosts = useCallback(async (): Promise<SearchIndexItem[]> => {
    const posts = await loadSearchIndex();
    slugsRef.current = posts.map((post) => post.slug);
    return posts;
  }, []);

  const syncStamp = useCallback(() => {
    setStampUnlocked(Boolean(readStamps().shell));
  }, []);

  useEffect(() => {
    syncStamp();
    window.addEventListener(STAMP_COLLECTED_EVENT, syncStamp);
    return () => {
      window.removeEventListener(STAMP_COLLECTED_EVENT, syncStamp);
      abortRef.current?.abort();
    };
  }, [syncStamp]);

  useEffect(() => {
    void loadPosts().catch(() => undefined);
  }, [loadPosts]);

  useEffect(() => {
    const viewport = outputRef.current;
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [entries]);

  const runCommand = useCallback(
    async (raw: string) => {
      const cmd = raw.trim();
      if (!cmd) {
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setRunning(true);
      setHistory((prev) => (prev.at(-1) === cmd ? prev : [...prev, cmd]));
      historyCursorRef.current = -1;

      const deps: ShellDeps = {
        loadPosts,
        listTools: () => tools,
        invokeTool: (name, toolInput) => invokeBlogWebMcpTool(name, toolInput, controller.signal),
        readStamps,
        collectShellStamp: () => {
          const alreadyCollected = Boolean(readStamps().shell);
          collectStamp("shell");
          syncStamp();
          return !alreadyCollected;
        },
      };

      const result = await executeShellCommand(cmd, deps);
      if (controller.signal.aborted) {
        return;
      }

      setRunning(false);
      if (result.clear) {
        setEntries([]);
        return;
      }

      const entryId = nextIdRef.current++;
      setEntries((prev) => [
        ...prev,
        { id: entryId, command: cmd, lines: keyLines(entryId, result.lines) },
      ]);

      if (result.toggleFlip) {
        setFlipped((current) => !current);
        window.dispatchEvent(new CustomEvent(THEME_TOGGLE_EVENT));
      }

      if (result.navigateTo) {
        window.location.assign(result.navigateTo);
      }
    },
    [loadPosts, syncStamp, tools],
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get("slug")?.trim();
    const initialCmd = params.get("cmd")?.trim();
    if (slug) {
      void runCommand(`cat ${slug}`);
    } else if (initialCmd) {
      void runCommand(initialCmd);
    }
  }, [runCommand]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cmd = input;
    setInput("");
    void runCommand(cmd);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Tab") {
      event.preventDefault();
      setInput((current) => completeShellInput(current, slugsRef.current));
      return;
    }

    if (event.key === "ArrowUp") {
      if (history.length === 0) {
        return;
      }
      event.preventDefault();
      const nextCursor =
        historyCursorRef.current === -1
          ? history.length - 1
          : Math.max(0, historyCursorRef.current - 1);
      historyCursorRef.current = nextCursor;
      setInput(history[nextCursor] ?? "");
      return;
    }

    if (event.key === "ArrowDown") {
      if (historyCursorRef.current === -1) {
        return;
      }
      event.preventDefault();
      const nextCursor = historyCursorRef.current + 1;
      if (nextCursor >= history.length) {
        historyCursorRef.current = -1;
        setInput("");
      } else {
        historyCursorRef.current = nextCursor;
        setInput(history[nextCursor] ?? "");
      }
    }
  };

  return (
    <section
      data-theme="dark"
      aria-label="Agent 终端漫游器"
      className="relative flex min-h-[calc(100dvh-61px)] flex-col bg-paper font-mono text-ink-800"
    >
      {flipped && (
        <div className="fixed bottom-6 left-1/2 z-30 -translate-x-1/2">
          <button
            type="button"
            onClick={() => {
              setFlipped(false);
              window.dispatchEvent(new CustomEvent(THEME_TOGGLE_EVENT));
            }}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-surface px-4 text-xs text-ink-800 shadow-lg transition-colors hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            已进入颠倒终端 · 点一下翻回来
          </button>
        </div>
      )}

      <div
        className={cn(
          "mx-auto flex w-full max-w-320 flex-1 flex-col transition-transform duration-500 ease-out motion-reduce:transition-none",
          flipped && "rotate-180",
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center gap-2.5 text-xs text-ink-500">
            <span className="rounded-[4px] bg-accent-soft px-2 py-0.5 text-[10px] font-medium tracking-wider text-accent">
              WebMCP READY
            </span>
            <span>/lab/shell</span>
            <span className="hidden text-ink-400 sm:inline">· Accept: text/markdown</span>
          </div>

          <div className="flex flex-wrap gap-1.5" role="group" aria-label="快捷命令">
            {quickCommands.map((item) => (
              <button
                key={item.label}
                type="button"
                disabled={running}
                onClick={() => {
                  void runCommand(item.cmd);
                  inputRef.current?.focus();
                }}
                className="rounded-[5px] border border-line bg-paper px-2.5 py-1 text-[11px] text-ink-600 transition-colors hover:border-accent hover:text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:opacity-50"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="flex min-h-0 flex-col">
            <div
              ref={outputRef}
              role="log"
              aria-live="polite"
              onClick={() => {
                if (window.getSelection()?.isCollapsed !== false) {
                  inputRef.current?.focus();
                }
              }}
              className="min-h-[420px] flex-1 overflow-y-auto px-4 py-5 text-[13px] leading-6 sm:px-6"
            >
              {entries.map((entry) => (
                <div key={entry.id} className="mb-4 last:mb-0">
                  {entry.command && (
                    <div className="mb-1 text-ink-800">
                      <span className="mr-2 text-accent" aria-hidden="true">
                        $
                      </span>
                      <span>{entry.command}</span>
                    </div>
                  )}
                  <div className="space-y-0.5 whitespace-pre-wrap break-words">
                    {entry.lines.map((shellLine) => (
                      <div key={shellLine.key} className="min-h-[1.2em]">
                        {shellLine.segments.map((segment) =>
                          segment.kind === "link" ? (
                            <a
                              key={segment.key}
                              href={segment.href}
                              target={segment.href.startsWith("http") ? "_blank" : undefined}
                              rel={
                                segment.href.startsWith("http") ? "noopener noreferrer" : undefined
                              }
                              className="text-ink-800 underline decoration-ink-300 underline-offset-4 transition-colors hover:text-accent hover:decoration-accent"
                            >
                              {segment.text}
                            </a>
                          ) : (
                            <span
                              key={segment.key}
                              className={TONE_CLASS[segment.tone ?? "default"]}
                            >
                              {segment.text}
                            </span>
                          ),
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {running && <div className="text-xs text-ink-400">正在执行…</div>}
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-2.5 border-t border-line bg-surface px-4 py-3 sm:px-6"
            >
              <label htmlFor="agent-shell-input" className="shrink-0 text-xs text-accent">
                guest@upside-down:~$
              </label>
              <input
                ref={inputRef}
                id="agent-shell-input"
                type="text"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入 help、ls posts、mcp call search_posts Agent 或 flip"
                autoComplete="off"
                spellCheck={false}
                className="min-w-0 flex-1 bg-transparent text-[13px] text-ink-800 placeholder:text-ink-400 focus:outline-none"
              />
              <button
                type="submit"
                disabled={running}
                className="inline-flex h-8 shrink-0 items-center rounded-[6px] bg-accent px-3 text-xs text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:opacity-50"
              >
                执行 ↵
              </button>
            </form>
          </div>

          <aside className="flex flex-col gap-4 border-t border-line bg-surface/60 p-4 text-xs lg:border-l lg:border-t-0 lg:p-5">
            <div className="rounded-[8px] border border-line bg-surface p-3.5">
              <p className="mb-2.5 text-[10px] uppercase tracking-[0.14em] text-ink-400">
                已注册 WebMCP 工具
              </p>
              <ul className="divide-y divide-line/70">
                {tools.map((tool) => (
                  <li
                    key={tool.name}
                    className="flex items-center justify-between py-1.5 text-[11.5px]"
                  >
                    <span className="text-ink-700">{tool.name}</span>
                    <span className="text-[10px] text-film">READ-ONLY</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-[8px] border border-line bg-surface p-3.5">
              <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-ink-400">常用命令</p>
              <p className="leading-6 text-ink-500">
                ls [posts|projects|stamps|labs]
                <br />
                grep &lt;关键词&gt; · cat &lt;slug&gt;
                <br />
                mcp tools · mcp call &lt;tool&gt;
                <br />
                open · fortune · fish · flip
              </p>
            </div>

            <div
              className={cn(
                "mt-auto flex items-center gap-3 rounded-[8px] border p-3 transition-colors",
                stampUnlocked
                  ? "border-accent bg-accent-soft"
                  : "border-dashed border-ink-200 bg-paper",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "grid size-12 shrink-0 place-items-center rounded-full font-serif text-[11px] font-bold leading-tight",
                  stampUnlocked
                    ? "-rotate-6 border-2 border-accent text-accent"
                    : "border border-dashed border-ink-300 text-ink-400",
                )}
              >
                <span className="h-[2em] [writing-mode:vertical-rl]">终端潜行</span>
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-ink-800">
                  {stampUnlocked ? "已盖章 · 终端潜行" : "彩蛋印章 · 未解锁"}
                </p>
                <p className="mt-0.5 text-[11px] leading-4 text-ink-500">
                  {stampUnlocked ? "已收录进本机集章册" : "执行一次 cat 或 mcp call 解锁"}
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
