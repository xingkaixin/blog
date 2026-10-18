import type { Locale } from "@/lib/i18n";
import { chromeMessages } from "@/lib/messages/chrome";
import { siteShortcuts } from "@/lib/site-shortcuts";
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

export type SearchPaletteItem = SearchPaletteLink | SearchPaletteThemeCommand;

export type SearchPaletteGroup = {
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
  return [...routeLinks, themeItem];
}

export function buildSearchPalette(
  query: string,
  posts: SearchIndexItem[] | null,
  locale: Locale = "zh",
): SearchPaletteGroup[] {
  const t = chromeMessages[locale].search;
  const routeItems = routeItemsFor(locale);
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return [
      ...(posts ? [{ label: t.latest, items: posts.slice(0, 4).map(postItem) }] : []),
      { label: t.jump, items: routeItems },
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

  return [
    { label: t.posts(matchedPosts.length), items: matchedPosts },
    { label: t.tags, items: matchedTags },
    { label: t.projects, items: matchedProjects },
    { label: t.commands, items: matchedRoutes },
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
