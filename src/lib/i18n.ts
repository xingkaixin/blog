export const locales = ["zh", "en"] as const;

export type Locale = (typeof locales)[number];

export const htmlLang: Record<Locale, string> = { zh: "zh-CN", en: "en" };
export const ogLocale: Record<Locale, string> = { zh: "zh_CN", en: "en_US" };

export const LOCALE_COOKIE = "lang";

const bilingualPaths = new Set(["/", "/projects/", "/photos/", "/rss/"]);

function withTrailingSlash(pathname: string) {
  return pathname.endsWith("/") ? pathname : `${pathname}/`;
}

function basePath(pathname: string) {
  const path = withTrailingSlash(pathname);
  return path === "/en/" ? "/" : path.startsWith("/en/") ? path.slice(3) : path;
}

export function localeFromPath(pathname: string): Locale {
  return pathname === "/en" || pathname.startsWith("/en/") ? "en" : "zh";
}

export function localeFromLang(lang: string): Locale {
  return lang.toLowerCase().startsWith("en") ? "en" : "zh";
}

/** 页面在目标语言下的地址；只有首页、工具箱、照片墙和 RSS 页有英文版，其余返回 null。 */
export function translatedPath(pathname: string, locale: Locale): string | null {
  const base = basePath(pathname);
  if (!bilingualPaths.has(base)) {
    return null;
  }
  return locale === "en" ? `/en${base}` : base;
}

/** 站内链接在当前语言下的地址；没有英文版的页面仍指向中文。 */
export function localizedHref(href: string, locale: Locale): string {
  return translatedPath(href, locale) ?? href;
}

export function hasEnglishVersion(href: string): boolean {
  return translatedPath(href, "en") !== null;
}

/** 浏览器的首选语言；没有可用的语言偏好时返回 null，不替访客做决定。 */
export function preferredLocale(acceptLanguage: string | null): Locale | null {
  const ranges = (acceptLanguage ?? "")
    .split(",")
    .map((part, order) => {
      const [tag = "", ...parameters] = part.split(";").map((value) => value.trim());
      const quality = parameters
        .map((parameter) => /^q=([01](?:\.\d{0,3})?)$/iu.exec(parameter)?.[1])
        .find((value) => value !== undefined);
      return {
        tag: tag.toLowerCase(),
        quality: quality === undefined ? 1 : Number(quality),
        order,
      };
    })
    .filter((range) => range.tag && range.tag !== "*" && range.quality > 0)
    .toSorted((left, right) => right.quality - left.quality || left.order - right.order);
  const first = ranges[0];
  if (!first) {
    return null;
  }
  return first.tag === "zh" || first.tag.startsWith("zh-") ? "zh" : "en";
}

export function cookieLocale(cookie: string | null): Locale | null {
  const value = cookie
    ?.split(";")
    .map((part) => part.trim().split("="))
    .find(([name]) => name === LOCALE_COOKIE)?.[1];
  return value === "zh" || value === "en" ? value : null;
}

/** 双语页面的 getStaticPaths：同一个页面文件生成中文根路径和 /en/ 两份。 */
export function bilingualStaticPaths() {
  return [{ params: { lang: undefined } }, { params: { lang: "en" } }];
}
