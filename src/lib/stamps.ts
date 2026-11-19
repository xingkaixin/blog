export const STAMP_COLLECTED_EVENT = "site:stamp-collected";
export const OPEN_STAMPS_EVENT = "site:open-stamps";

// 印文是四字印章，中英文页面共用；获取方式的提示在 chromeMessages.stamps.hints
export const stamps = [
  { id: "arrival", seal: "初来乍到" },
  { id: "flip", seal: "颠倒世界" },
  { id: "reader", seal: "手不释卷" },
  { id: "catch", seal: "愿者上钩" },
  { id: "record", seal: "余音绕梁" },
  { id: "pinch", seal: "手下留情" },
  { id: "darkroom", seal: "暗房一游" },
  { id: "lost", seal: "误入歧途" },
  { id: "night", seal: "夜深人静" },
  { id: "shell", seal: "终端潜行" },
] as const;

export type StampId = (typeof stamps)[number]["id"];

const STORAGE_KEY = "site-stamps";
const stampKey = (id: StampId) => `${STORAGE_KEY}:${id}`;

function readLegacyStamps(): Partial<Record<StampId, string>> {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    return stored && typeof stored === "object" ? stored : {};
  } catch {
    return {};
  }
}

/** 已盖的章，值是盖章当天的本地日期。 */
export function readStamps(): Partial<Record<StampId, string>> {
  const collected = readLegacyStamps();
  try {
    for (const { id } of stamps) {
      const date = localStorage.getItem(stampKey(id));
      if (date) {
        collected[id] = date;
      }
    }
  } catch {
    // 浏览器禁止存储时，仍返回已读到的印章。
  }
  return collected;
}

export function collectStamp(id: StampId): void {
  if (readStamps()[id]) {
    return;
  }
  const now = new Date();
  const date = [now.getFullYear(), now.getMonth() + 1, now.getDate()]
    .map((part) => String(part).padStart(2, "0"))
    .join("-");
  try {
    localStorage.setItem(stampKey(id), date);
  } catch {
    // 存不下来就不提示，否则每次进站都会重复盖同一枚章
    return;
  }
  window.dispatchEvent(new CustomEvent<StampId>(STAMP_COLLECTED_EVENT, { detail: id }));
}
