import { ArrowRightIcon } from "@radix-ui/react-icons";
import { Badge } from "@/components/ui/badge";
import { usePageMeta } from "@/lib/page-meta";
import { projects } from "@/lib/projects";
import { siteConfig } from "@/lib/site";

export function ProjectsPage() {
  usePageMeta({
    title: "工具箱",
    description: "Kevin 发布和维护的 AI、CLI、数据库与开发者工具。",
    url: `${siteConfig.url}/projects`,
    type: "webpage",
  });

  return (
    <section className="px-4 pb-20 pt-10 sm:px-6 lg:px-10 lg:pt-14">
      <div className="mx-auto max-w-350 space-y-8">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-ink-400">Projects</p>
          <h1 className="mt-3 text-4xl tracking-[-0.05em] text-ink-800">工具箱</h1>
        </div>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project, index) => (
            <ProjectCard key={project.name} project={project} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ProjectCard({ project, index }: { project: (typeof projects)[number]; index: number }) {
  const Wrapper = project.url ? "a" : "div";
  const wrapperProps = project.url
    ? {
        href: project.url,
        target: "_blank" as const,
        rel: "noopener noreferrer" as const,
      }
    : {};

  return (
    <Wrapper
      {...wrapperProps}
      className={`group block fade-in ${project.url ? "cursor-pointer" : ""}`}
      style={{ animationDelay: `${index * 90}ms` }}
    >
      <div className="hover-lift flex h-full flex-col overflow-hidden rounded-4xl border border-[#d7cfc2] bg-[#faf7f1]/96 p-5 shadow-[0_24px_60px_-52px_rgba(31,24,18,0.3),inset_0_1px_0_rgba(255,255,255,0.88)]">
        <div className="flex items-start gap-4">
          <img
            src={project.logo}
            alt={`${project.name} logo`}
            width={48}
            height={48}
            className="h-12 w-12 shrink-0 rounded-xl border border-[#e4dbcf] bg-white/88 object-contain p-1.5"
          />
          <div className="min-w-0 flex-1">
            <h3 className="text-xl tracking-[-0.03em] text-ink-800">{project.name}</h3>
            <p className="mt-2 text-sm leading-7 text-ink-600">{project.description}</p>
          </div>
        </div>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-6">
          {project.tags && (
            <div className="flex flex-wrap gap-2">
              {project.tags.map((tag) => (
                <Badge key={tag} className="border-[#d9d1c4] bg-white/88">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
          {project.url && (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-700">
              访问
              <ArrowRightIcon
                aria-hidden="true"
                className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
              />
            </span>
          )}
        </div>
      </div>
    </Wrapper>
  );
}
