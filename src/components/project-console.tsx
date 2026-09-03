import { ArrowUpRightIcon } from "@phosphor-icons/react/dist/csr/ArrowUpRight";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { useMemo, useState } from "react";
import { rankProjects, type Project } from "@/lib/projects";

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
      width={48}
      height={48}
      loading="lazy"
      decoding="async"
      className="h-12 w-12 shrink-0 rounded-[10px] border border-line bg-white object-contain p-1.5 shadow-sm"
    />
  );
}

function ProjectLinks({ project }: { project: Project }) {
  const links = project.links ?? [{ label: "访问产品", url: project.url }];

  return (
    <div className="project-card-links mt-5 flex flex-wrap gap-x-3 gap-y-2">
      {links.map((link) => (
        <a
          key={link.url}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 whitespace-nowrap font-mono text-[11px] font-medium text-ink-700 underline decoration-ink-300 underline-offset-4 transition-colors duration-(--duration-quick) hover:text-accent hover:decoration-accent focus-visible:rounded-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          {link.label}
          <ArrowUpRightIcon aria-hidden="true" className="h-3 w-3" />
        </a>
      ))}
    </div>
  );
}

function ProjectCard({ project, index }: { project: Project; index: number }) {
  return (
    <article
      data-column={(index % 4) + 1}
      className="project-card min-h-60 focus-within:outline-none sm:min-h-64 lg:min-h-68"
    >
      <div aria-hidden="true" className="project-card-surface">
        <img
          src={project.background}
          alt=""
          width={960}
          height={640}
          loading="lazy"
          decoding="async"
          className="project-card-art"
        />
        <div className="project-card-scrim" />
      </div>

      <div className="relative z-1 flex min-h-60 flex-col p-5 sm:min-h-64 lg:min-h-68">
        <div className="flex items-start justify-between gap-4">
          <ProjectLogo project={project} />
          <span className="font-mono text-[10px] text-ink-400">{project.kind}</span>
        </div>

        <div className="mt-auto pt-8">
          <h2 className="text-xl font-medium tracking-[-0.025em] text-ink-800">{project.name}</h2>
          <p className="mt-1.5 max-w-60 text-[13px] leading-5 text-ink-600">{project.summary}</p>
          <ProjectLinks project={project} />
        </div>
      </div>
    </article>
  );
}

export function ProjectConsole({ projects }: ProjectConsoleProps) {
  const [activeFilter, setActiveFilter] = useState<ProjectFilter>("全部");
  const [query, setQuery] = useState("");
  const visibleProjects = useMemo(
    () => rankProjects(projects, query).filter((project) => matchesFilter(project, activeFilter)),
    [activeFilter, projects, query],
  );
  const projectRows = Array.from({ length: Math.ceil(visibleProjects.length / 4) }, (_, index) =>
    visibleProjects.slice(index * 4, index * 4 + 4),
  );

  return (
    <section className="mx-auto max-w-320 px-3 pb-14 pt-6 sm:px-5 lg:pb-20 lg:pt-10">
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
            <MagnifyingGlassIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-ink-400" />
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

      <div className="mt-5 space-y-3 lg:space-y-3.5">
        {projectRows.map((row) => (
          <div
            key={row[0].id}
            className="project-row grid grid-cols-1 gap-3 sm:grid-cols-2 lg:gap-3.5"
          >
            {row.map((project, index) => (
              <ProjectCard key={project.id} project={project} index={index} />
            ))}
          </div>
        ))}
        {visibleProjects.length === 0 && (
          <div className="flex min-h-48 items-center justify-center rounded-[12px] border border-line bg-surface px-6 text-center">
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
