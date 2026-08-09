import { ArrowUpRightIcon, SearchIcon, XIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { rankProjects, type Project } from "@/lib/projects";
import { cn } from "@/lib/utils";

type ProjectConsoleProps = {
  projects: Project[];
};

const filters = ["全部", "AI", "CLI", "扩展", "数据库"] as const;

type ProjectFilter = (typeof filters)[number];

function matchesFilter(project: Project, filter: ProjectFilter): boolean {
  if (filter === "全部") {
    return true;
  }
  if (filter === "扩展") {
    return project.kind.includes("扩展") || project.tags.includes("浏览器扩展");
  }
  if (filter === "CLI") {
    return project.kind.includes("CLI") || project.tags.includes("CLI");
  }
  return project.tags.includes(filter);
}

function ProjectLogo({ project }: { project: Project }) {
  return (
    <img
      src={project.logo}
      alt=""
      width={40}
      height={40}
      loading="lazy"
      decoding="async"
      className="h-10 w-10 shrink-0 rounded-[9px] border border-line bg-white object-contain p-1"
    />
  );
}

function ProjectDetails({ project }: { project: Project }) {
  return (
    <>
      <div className="min-w-0 lg:w-36 lg:shrink-0">
        <h2 className="truncate text-[15px] font-medium text-ink-800">{project.name}</h2>
        <span className="mt-0.5 block font-mono text-[10px] text-ink-400">{project.kind}</span>
      </div>
      <p className="mt-2 text-[13px] leading-6 text-ink-600 lg:mt-0 lg:min-w-0 lg:flex-1">
        {project.description}
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5 lg:mt-0 lg:w-52 lg:shrink-0">
        {project.tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="rounded-[4px] border border-line bg-surface px-1.5 py-0.5 font-mono text-[9px] text-ink-500"
          >
            {tag}
          </span>
        ))}
      </div>
    </>
  );
}

export function ProjectConsole({ projects }: ProjectConsoleProps) {
  const [activeFilter, setActiveFilter] = useState<ProjectFilter>("全部");
  const [query, setQuery] = useState("");
  const visibleProjects = useMemo(
    () => rankProjects(projects, query).filter((project) => matchesFilter(project, activeFilter)),
    [activeFilter, projects, query],
  );

  return (
    <section className="mx-auto max-w-320 px-3 pb-12 pt-6 sm:px-5 lg:pb-18 lg:pt-10">
      <header className="flex flex-col gap-5 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-400">
            {projects.length} 个在维护
          </p>
          <h1 className="mt-2 flex items-center gap-2 text-3xl font-medium tracking-[-0.04em] text-ink-800 sm:text-4xl">
            工具箱{" "}
            <span aria-hidden="true" className="font-mono text-xl text-accent">
              :)
            </span>
          </h1>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:items-end">
          <label className="flex h-9 w-full items-center gap-2 rounded-[7px] border border-line bg-surface px-2.5 focus-within:border-ink-300 focus-within:ring-2 focus-within:ring-accent/20 sm:w-72">
            <SearchIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-ink-400" />
            <span className="sr-only">搜索工具</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索名称、类型或技术…"
              className="min-w-0 flex-1 bg-transparent font-mono text-xs text-ink-800 outline-none placeholder:text-ink-400 [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                aria-label="清除搜索"
                onClick={() => setQuery("")}
                className="text-ink-400 transition-colors hover:text-ink-700 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                <XIcon aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            )}
          </label>
          <div
            role="group"
            aria-label="筛选工具"
            className="flex max-w-full gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {filters.map((filter) => (
              <button
                key={filter}
                type="button"
                aria-pressed={activeFilter === filter}
                onClick={() => setActiveFilter(filter)}
                className="shrink-0 rounded-[6px] border border-line bg-surface px-2.5 py-1.5 font-mono text-[11px] text-ink-500 transition-colors hover:border-ink-300 hover:text-ink-800 aria-pressed:border-ink-800 aria-pressed:bg-ink-800 aria-pressed:text-paper"
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="border-b border-line">
        {visibleProjects.map((project) => {
          const rowClassName = cn(
            "group -mx-1 flex gap-3 border-b border-ink-100 px-3 py-4 transition-[background-color,box-shadow] last:border-b-0 hover:bg-surface hover:shadow-[inset_3px_0_0_var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40 lg:items-center lg:gap-5 lg:px-4 lg:py-3.5",
          );

          if (project.links) {
            return (
              <article key={project.id} className={rowClassName}>
                <ProjectLogo project={project} />
                <div className="min-w-0 flex-1 lg:flex lg:items-center lg:gap-5">
                  <ProjectDetails project={project} />
                  <span className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 lg:mt-0 lg:w-32 lg:shrink-0 lg:justify-end">
                    {project.links.map((link) => (
                      <a
                        key={link.url}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-[11px] text-ink-600 transition-colors hover:text-accent focus-visible:rounded-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                      >
                        {link.label}
                        <ArrowUpRightIcon aria-hidden="true" className="h-3 w-3" />
                      </a>
                    ))}
                  </span>
                </div>
              </article>
            );
          }

          return (
            <a
              key={project.id}
              href={project.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`访问 ${project.name}`}
              className={rowClassName}
            >
              <ProjectLogo project={project} />
              <div className="min-w-0 flex-1 lg:flex lg:items-center lg:gap-5">
                <ProjectDetails project={project} />
                <span className="mt-3 inline-flex items-center gap-1 font-mono text-[11px] text-ink-500 group-hover:text-accent lg:mt-0 lg:w-32 lg:shrink-0 lg:justify-end">
                  访问
                  <ArrowUpRightIcon aria-hidden="true" className="h-3.5 w-3.5" />
                </span>
              </div>
            </a>
          );
        })}
        {visibleProjects.length === 0 && (
          <div className="flex min-h-48 items-center justify-center px-6 text-center">
            <div>
              <p className="text-sm font-medium text-ink-800">没有匹配的工具</p>
              <p className="mt-1.5 text-xs leading-6 text-ink-500">换个关键词或选择其他分类。</p>
            </div>
          </div>
        )}
      </div>

      <p aria-live="polite" className="mt-3 font-mono text-[10px] text-ink-400">
        显示 {visibleProjects.length} / {projects.length}
      </p>
    </section>
  );
}
