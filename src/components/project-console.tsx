import { ArrowUpRightIcon } from "@phosphor-icons/react/dist/csr/ArrowUpRight";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n";
import { projectFilters, projectMessages, type ProjectFilter } from "@/lib/messages/projects";
import { mountProjectLogoEffects } from "@/lib/project-logo/effect";
import { localizeProject, rankProjects, type Project } from "@/lib/projects";
import {
  getCssEasing,
  isDesktopViewport,
  prefersReducedMotion,
  useSlidingPill,
} from "@/lib/sliding-pill";
import { cn } from "@/lib/utils";

type ProjectConsoleProps = {
  projects: Project[];
  locale: Locale;
};

const FILTER_CHIP_CLASS_NAME =
  "shrink-0 rounded-[6px] border border-line bg-surface px-2.5 py-1.5 font-mono text-[11px] text-ink-500 transition-colors hover:border-ink-300 hover:text-ink-800 aria-pressed:text-paper pointer-coarse:min-h-9";

/** 按中文原始数据判断分类，英文版只换显示文案。 */
const filterMatchers: Record<ProjectFilter, (project: Project) => boolean> = {
  all: () => true,
  ai: (project) => project.tags.includes("AI"),
  ios: (project) => project.tags.includes("iOS"),
  cli: (project) => project.kind.includes("CLI") || project.tags.includes("CLI"),
  extension: (project) => project.kind.includes("扩展") || project.tags.includes("浏览器扩展"),
  database: (project) => project.tags.includes("数据库"),
};

function ProjectLogo({ project }: { project: Project }) {
  return (
    <span data-project-logo className="project-logo">
      <img src={project.logo} alt="" width={48} height={48} loading="lazy" decoding="async" />
      <canvas data-logo-outline aria-hidden="true" width={112} height={112} />
      <canvas data-logo-crt aria-hidden="true" width={112} height={112} />
    </span>
  );
}

function ProjectLinks({ project, visitLabel }: { project: Project; visitLabel: string }) {
  const links = project.links ?? [{ label: visitLabel, url: project.url }];

  return (
    <div className="mt-5 flex flex-wrap gap-x-3 gap-y-2">
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

function ProjectCard({
  project,
  index,
  visitLabel,
  cardRef,
}: {
  project: Project;
  index: number;
  visitLabel: string;
  cardRef?: (node: HTMLElement | null) => void;
}) {
  return (
    <article
      ref={cardRef}
      data-column={(index % 4) + 1}
      className="project-card focus-within:outline-none sm:min-h-64 lg:min-h-68"
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

      <div className="relative z-1 flex flex-col p-5 sm:min-h-64 lg:min-h-68">
        <div className="flex items-start justify-between gap-4">
          <ProjectLogo project={project} />
          <span className="font-mono text-[11px] text-ink-500">{project.kind}</span>
        </div>

        <div className="mt-6 sm:mt-auto sm:pt-8">
          <h2 className="text-xl font-medium tracking-[-0.025em] text-ink-800">{project.name}</h2>
          <p className="mt-1.5 max-w-60 text-[13px] leading-5 text-ink-600">{project.summary}</p>
          <ProjectLinks project={project} visitLabel={visitLabel} />
        </div>
      </div>
    </article>
  );
}

export function ProjectConsole({ projects, locale }: ProjectConsoleProps) {
  const t = projectMessages[locale];
  const rootRef = useRef<HTMLElement>(null);
  const [activeFilter, setActiveFilter] = useState<ProjectFilter>("all");
  const [query, setQuery] = useState("");
  const visibleProjects = useMemo(() => {
    const allowed = new Set(projects.filter(filterMatchers[activeFilter]).map(({ id }) => id));
    return rankProjects(
      projects.map((project) => localizeProject(project, locale)),
      query,
    ).filter((project) => allowed.has(project.id));
  }, [activeFilter, locale, projects, query]);
  const {
    trackRef: filterTrackRef,
    pillRef: filterPillRef,
    registerButton: registerFilterButton,
    ready: filterPillReady,
  } = useSlidingPill<ProjectFilter>(activeFilter);

  const cardElementsRef = useRef(new Map<string, HTMLElement>());
  const cardRefCallbacksRef = useRef(new Map<string, (node: HTMLElement | null) => void>());
  const cardAnimationsRef = useRef(new Map<string, Animation>());
  const prevRectsRef = useRef<Map<string, DOMRect> | null>(null);

  const registerCard = useCallback((id: string) => {
    let callback = cardRefCallbacksRef.current.get(id);
    if (!callback) {
      callback = (node: HTMLElement | null) => {
        if (node) {
          cardElementsRef.current.set(id, node);
        } else {
          cardElementsRef.current.delete(id);
        }
      };
      cardRefCallbacksRef.current.set(id, callback);
    }
    return callback;
  }, []);

  const cancelCardAnimations = useCallback(() => {
    for (const anim of cardAnimationsRef.current.values()) {
      anim.cancel();
    }
    cardAnimationsRef.current.clear();
  }, []);

  const captureCardRects = useCallback(() => {
    const rects = new Map<string, DOMRect>();
    for (const [id, element] of cardElementsRef.current.entries()) {
      if (!element.isConnected) {
        continue;
      }
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        rects.set(id, rect);
      }
    }
    prevRectsRef.current = rects;
  }, []);

  useEffect(() => {
    return rootRef.current ? mountProjectLogoEffects(rootRef.current) : undefined;
  }, []);

  useEffect(() => cancelCardAnimations, [cancelCardAnimations]);

  useLayoutEffect(() => {
    const prevRects = prevRectsRef.current;
    prevRectsRef.current = null;
    if (!prevRects) {
      return;
    }

    // Cancel active FLIP transforms first so subsequent measurements reflect final grid tracks.
    cancelCardAnimations();

    const reducedMotion = prefersReducedMotion();
    const duration = isDesktopViewport() ? 190 : 280;
    const easing = getCssEasing("--ease-smooth-out", "cubic-bezier(0.22, 1, 0.36, 1)");

    for (const project of visibleProjects) {
      const element = cardElementsRef.current.get(project.id);
      if (!element || typeof element.animate !== "function") {
        continue;
      }

      const nextRect = element.getBoundingClientRect();
      if (nextRect.width <= 0 || nextRect.height <= 0) {
        continue;
      }

      const prevRect = prevRects.get(project.id);
      let anim: Animation | null = null;

      if (prevRect) {
        if (reducedMotion) {
          continue;
        }
        const dx = prevRect.left - nextRect.left;
        const dy = prevRect.top - nextRect.top;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
          continue;
        }
        anim = element.animate(
          [
            { transform: `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0)` },
            { transform: "translate3d(0, 0, 0)" },
          ],
          { duration, easing },
        );
      } else {
        anim = element.animate(
          reducedMotion
            ? [{ opacity: 0 }, { opacity: 1 }]
            : [
                { opacity: 0, transform: "translate3d(0, 8px, 0) scale(0.985)" },
                { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" },
              ],
          { duration: reducedMotion ? 150 : duration, easing },
        );
      }

      cardAnimationsRef.current.set(project.id, anim);
      void anim.finished
        .catch(() => {})
        .finally(() => {
          if (cardAnimationsRef.current.get(project.id) === anim) {
            cardAnimationsRef.current.delete(project.id);
          }
        });
    }
  }, [cancelCardAnimations, visibleProjects]);

  const handleFilterChange = (filter: ProjectFilter) => {
    if (filter === activeFilter) {
      return;
    }
    captureCardRects();
    setActiveFilter(filter);
  };

  const handleQueryChange = (nextQuery: string) => {
    if (nextQuery === query) {
      return;
    }
    captureCardRects();
    setQuery(nextQuery);
  };

  return (
    <section ref={rootRef} className="mx-auto max-w-320 px-3 pb-14 pt-6 sm:px-5 lg:pb-20 lg:pt-10">
      <header className="flex flex-col gap-5 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-400">
            {t.maintained(projects.length)}
          </p>
          <h1 className="mt-2 flex items-center gap-2 text-3xl font-medium tracking-[-0.04em] text-ink-800 sm:text-4xl">
            {t.title}{" "}
            <span aria-hidden="true" className="font-mono text-xl text-accent">
              :)
            </span>
          </h1>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:items-end">
          <label className="flex h-9 w-full items-center gap-2 rounded-[7px] border border-line bg-surface px-2.5 focus-within:border-ink-300 focus-within:ring-2 focus-within:ring-accent/20 sm:w-72">
            <MagnifyingGlassIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-ink-400" />
            <span className="sr-only">{t.searchLabel}</span>
            <input
              type="search"
              value={query}
              onChange={(event) => handleQueryChange(event.target.value)}
              placeholder={t.searchPlaceholder}
              className="min-w-0 flex-1 bg-transparent font-mono text-xs text-ink-800 outline-none placeholder:text-ink-400 [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                aria-label={t.clearSearch}
                onClick={() => handleQueryChange("")}
                className="text-ink-400 transition-colors hover:text-ink-700 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                <XIcon aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            )}
          </label>
          <div
            ref={filterTrackRef}
            role="group"
            aria-label={t.filterLabel}
            className="relative isolate flex max-w-full gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <span
              ref={filterPillRef}
              aria-hidden="true"
              className="sliding-pill absolute left-0 top-0 z-10 origin-center rounded-[6px] bg-ink-800 opacity-0"
            />
            {projectFilters.map((filter) => (
              <button
                key={filter}
                ref={registerFilterButton(filter)}
                type="button"
                aria-pressed={activeFilter === filter}
                onClick={() => handleFilterChange(filter)}
                className={cn(
                  FILTER_CHIP_CLASS_NAME,
                  filterPillReady
                    ? "aria-pressed:border-transparent aria-pressed:bg-transparent"
                    : "aria-pressed:border-ink-800 aria-pressed:bg-ink-800",
                )}
              >
                <span className="relative z-20">{t.filters[filter]}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      {visibleProjects.length > 0 ? (
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-3.5">
          {visibleProjects.map((project, index) => (
            <ProjectCard
              key={project.id}
              cardRef={registerCard(project.id)}
              project={project}
              index={index}
              visitLabel={t.visit}
            />
          ))}
        </div>
      ) : (
        <div className="mt-5 flex min-h-48 items-center justify-center rounded-[12px] border border-line bg-surface px-6 text-center">
          <div>
            <p className="text-sm font-medium text-ink-800">{t.empty}</p>
            <p className="mt-1.5 text-xs leading-6 text-ink-500">{t.emptyHint}</p>
          </div>
        </div>
      )}

      <p aria-live="polite" className="sr-only">
        {t.showing(visibleProjects.length, projects.length)}
      </p>
    </section>
  );
}
