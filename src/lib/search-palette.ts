import type { Locale } from "@/lib/i18n";
import { chromeMessages } from "@/lib/messages/chrome";
import { siteShortcuts } from "@/lib/site-shortcuts";
import { experiments } from "./experiments";
import { buildPostTaxonomy } from "./post-tags";
import { localizedProjects, primaryProjectUrl, rankProjects, type Project } from "./projects";
import { postHref } from "./published-post";
import { rankPosts, type SearchIndexItem } from "./search";
import { matchesSearchQuery, normalizeSearchText } from "./search-text";
import { searchNavigation } from "./site-navigation";

export type SearchPaletteLink = {
  id: string;
  kind: "link";
  glyph: string;
  title: string;
  hint: string;
  href: string;
  reload: boolean;
};

export type SearchPaletteThemeCommand = {
  id: string;
  kind: "theme";
  glyph: string;
  title: string;
  hint: string;
};

export type SearchPaletteStampsCommand = {
  id: string;
  kind: "stamps";
  glyph: string;
  title: string;
  hint: string;
};

export type SearchPaletteItem =
  | SearchPaletteLink
  | SearchPaletteThemeCommand
  | SearchPaletteStampsCommand;

export type SearchPaletteGroup = {
  id: string;
  label: string;
  items: SearchPaletteItem[];
};

type SearchablePaletteItem = SearchPaletteItem & { keywords: string };

function routeItemsFor(locale: Locale): SearchablePaletteItem[] {
  const routeLinks: Array<SearchPaletteLink & { keywords: string }> = searchNavigation(locale).map(
    (route) => ({
      ...route,
      kind: "link",
      glyph: "›",
    }),
  );
  const themeItem: SearchPaletteThemeCommand & { keywords: string } = {
    id: "action-theme",
    kind: "theme",
    glyph: "›",
    title: chromeMessages[locale].flipWorld,
    hint: siteShortcuts.theme.hint,
    keywords: "主题 亮色 暗色 翻转世界 theme dark light flip",
  };
  const stampsItem: SearchPaletteStampsCommand & { keywords: string } = {
    id: "action-stamps",
    kind: "stamps",
    glyph: "›",
    title: chromeMessages[locale].stamps.title,
    hint: "",
    keywords: "集章册 印章 盖章 成就 stamp book seal",
  };
  return [...routeLinks, themeItem, stampsItem];
}

export function buildSearchPalette(
  query: string,
  posts: SearchIndexItem[] | null,
  locale: Locale = "zh",
): SearchPaletteGroup[] {
  const t = chromeMessages[locale].search;
  const routeItems = routeItemsFor(locale);
  const experimentItems: SearchablePaletteItem[] = experiments.map((item) => ({
    id: `experiment-${item.id}`,
    kind: "link",
    glyph: "◇",
    title: locale === "en" ? item.englishTitle : item.title,
    hint: item.href,
    href: item.href,
    keywords: item.keywords,
    reload: false,
  }));
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return [
      ...(posts ? [{ id: "latest", label: t.latest, items: posts.slice(0, 4).map(postItem) }] : []),
      { id: "experiments", label: t.experiments, items: experimentItems },
      { id: "commands", label: t.jump, items: routeItems },
    ];
  }

  const taxonomy = posts ? buildPostTaxonomy(posts) : null;
  const matchedPosts = posts ? rankPosts(posts, { query }).slice(0, 8).map(postItem) : [];
  const matchedTags =
    taxonomy?.tags
      .filter(({ tag, href }) => href !== null && matchesSearchQuery(tag, normalizedQuery))
      .slice(0, 5)
      .map<SearchPaletteLink>(({ tag, count, href }) => ({
        id: `tag-${encodeURIComponent(tag)}`,
        kind: "link",
        glyph: "⌗",
        title: t.tagTitle(tag, count),
        hint: t.filter,
        href: href!,
        reload: false,
      })) ?? [];
  const matchedProjects = rankProjects(localizedProjects(locale), query)
    .slice(0, 6)
    .map(projectItem);
  const matchedRoutes = routeItems.filter((item) =>
    matchesSearchQuery(`${item.title} ${item.hint} ${item.keywords}`, normalizedQuery),
  );
  const matchedExperiments = experimentItems.filter((item) =>
    matchesSearchQuery(`${item.title} ${item.hint} ${item.keywords}`, normalizedQuery),
  );

  return [
    { id: "posts", label: t.posts(matchedPosts.length), items: matchedPosts },
    { id: "tags", label: t.tags, items: matchedTags },
    { id: "projects", label: t.projects, items: matchedProjects },
    { id: "experiments", label: t.experiments, items: matchedExperiments },
    { id: "commands", label: t.commands, items: matchedRoutes },
  ].filter((group) => group.items.length > 0);
}

function postItem(post: SearchIndexItem): SearchPaletteLink {
  return {
    id: `post-${post.slug}`,
    kind: "link",
    glyph: "#",
    title: post.title,
    hint: post.date,
    href: postHref(post.slug),
    reload: false,
  };
}

function projectItem(project: Project): SearchPaletteLink {
  return {
    id: `project-${project.id}`,
    kind: "link",
    glyph: "+",
    title: project.name,
    hint: project.kind,
    href: primaryProjectUrl(project),
    reload: true,
  };
}
