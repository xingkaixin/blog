import { ArrowsOutLineVerticalIcon } from "@phosphor-icons/react/dist/csr/ArrowsOutLineVertical";
import { ArrowUpRightIcon } from "@phosphor-icons/react/dist/csr/ArrowUpRight";
import { ClockCounterClockwiseIcon } from "@phosphor-icons/react/dist/csr/ClockCounterClockwise";
import { FlaskIcon } from "@phosphor-icons/react/dist/csr/Flask";
import { ShuffleIcon } from "@phosphor-icons/react/dist/csr/Shuffle";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  getThemeGravityY,
  mountGravityWorld,
  STICKER_FILTER,
  type GravityBodySpec,
  type GravityWorldHandle,
} from "@/lib/gravity-world";
import { projects } from "@/lib/projects";
import { THEME_TOGGLE_EVENT } from "@/lib/site-events";
import { readStamps, STAMP_COLLECTED_EVENT, stamps, type StampId } from "@/lib/stamps";
import { cn } from "@/lib/utils";

export type DeskPhotoCard = {
  id: string;
  label: string;
  src: string;
  href: string;
};

type DeskItem =
  | {
      kind: "polaroid";
      key: string;
      label: string;
      src: string;
      href: string;
      width: number;
      height: number;
    }
  | {
      kind: "seal";
      key: string;
      id: StampId;
      seal: string;
      width: number;
      height: number;
    }
  | {
      kind: "slip";
      key: string;
      text: string;
      tag: string;
      width: number;
      height: number;
    }
  | {
      kind: "sticker";
      key: string;
      name: string;
      logo: string;
      href: string;
      width: number;
      height: number;
    };

const FEATURED_SEALS: readonly StampId[] = ["arrival", "flip", "record", "darkroom"];
const DESK_SLIPS = [
  { key: "slip-upside-down", text: "欢迎来到颠倒世界", tag: "NOTE · A" },
  { key: "slip-thoughtful", text: "先想清楚，再动手", tag: "NOTE · B" },
  { key: "slip-shortcut", text: "按下 ⌘J 倒转天花板", tag: "SHORTCUT" },
  { key: "slip-harness", text: "Agent Harness · 50mm", tag: "FIELD" },
] as const;

function buildInitialSpecs(
  items: readonly DeskItem[],
  width: number,
  height: number,
  inverted: boolean,
): GravityBodySpec[] {
  const safeWidth = Math.max(width, 320);
  const cols = Math.max(3, Math.floor(safeWidth / 138));
  return items.map((item, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const cellW = safeWidth / cols;
    const x = Math.min(
      Math.max((col + 0.5) * cellW + (index % 2 === 0 ? -8 : 8), 72),
      safeWidth - 72,
    );
    const offsetY = 92 + row * 94;
    const y = inverted ? Math.min(height - 72, offsetY) : Math.max(72, height - offsetY);
    return {
      x,
      y,
      width: item.width,
      height: item.height,
      restitution: item.kind === "sticker" ? 0.32 : 0.18,
      angle: ((index % 5) - 2) * 0.08,
    };
  });
}

function SealChars({ seal }: { seal: string }) {
  return (
    <span className="grid grid-cols-2 gap-x-0.5 text-center font-serif text-[12px] leading-[13px] font-semibold">
      <span>{seal.charAt(2)}</span>
      <span>{seal.charAt(0)}</span>
      <span>{seal.charAt(3)}</span>
      <span>{seal.charAt(1)}</span>
    </span>
  );
}

export function GravityDesk({ photoCards }: { photoCards: readonly DeskPhotoCard[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const worldRef = useRef<GravityWorldHandle | null>(null);
  const pointerDownRef = useRef<{ x: number; y: number; index: number } | null>(null);

  const [ready, setReady] = useState(false);
  const [inverted, setInverted] = useState(false);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [collectedStamps, setCollectedStamps] = useState<Partial<Record<StampId, string>>>({});
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const items = useMemo<DeskItem[]>(() => {
    const uniqueProjects = projects.filter(
      (project, index, list) =>
        list.findIndex((candidate) => candidate.logo === project.logo) === index,
    );
    const sealItems: DeskItem[] = FEATURED_SEALS.map((id) => {
      const entry = stamps.find((item) => item.id === id) ?? stamps[0];
      return {
        kind: "seal",
        key: `seal-${id}`,
        id: entry.id,
        seal: entry.seal,
        width: 58,
        height: 58,
      };
    });
    const polaroids: DeskItem[] = photoCards.map((card) => ({
      kind: "polaroid",
      key: `photo-${card.id}`,
      label: card.label,
      src: card.src,
      href: card.href,
      width: 108,
      height: 132,
    }));
    const slips: DeskItem[] = DESK_SLIPS.map((slip) => ({
      kind: "slip",
      key: slip.key,
      text: slip.text,
      tag: slip.tag,
      width: 152,
      height: 44,
    }));
    const stickers: DeskItem[] = uniqueProjects.map((project) => ({
      kind: "sticker",
      key: `sticker-${project.id}`,
      name: project.name,
      logo: project.logo,
      href: project.links?.[0]?.url ?? project.url ?? "/projects/",
      width: 44,
      height: 44,
    }));
    return [...polaroids, ...sealItems, ...slips, ...stickers];
  }, [photoCards]);

  useEffect(() => {
    const syncStamps = () => setCollectedStamps(readStamps());
    syncStamps();
    window.addEventListener(STAMP_COLLECTED_EVENT, syncStamps);
    return () => window.removeEventListener(STAMP_COLLECTED_EVENT, syncStamps);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }
    const { width, height } = container.getBoundingClientRect();
    const isDark = getThemeGravityY(document.documentElement.dataset.theme) < 0;
    const specs = buildInitialSpecs(items, width, height, isDark);

    const world = mountGravityWorld({
      container,
      specs,
      getElement: (index) => itemRefs.current[index] ?? null,
      onGravityChange: (gravityY) => setInverted(gravityY < 0),
      onDraggingChange: setDraggingIndex,
    });
    worldRef.current = world;
    setReady(true);

    return () => {
      worldRef.current = null;
      world.destroy();
    };
  }, [items]);

  const selectedItem = selectedIndex === null ? null : (items[selectedIndex] ?? null);

  const handleReset = () => {
    const container = containerRef.current;
    if (!container || !worldRef.current) {
      return;
    }
    const { width, height } = container.getBoundingClientRect();
    worldRef.current.reset(buildInitialSpecs(items, width, height, inverted));
    setSelectedIndex(null);
  };

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-5 px-5 py-8 sm:px-8 sm:py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-400">
            <FlaskIcon aria-hidden="true" className="h-3.5 w-3.5 text-accent" />
            <span>LAB · GRAVITY DESK</span>
          </div>
          <h1 className="font-sans text-[28px] font-medium leading-[1.15] tracking-[-0.04em] text-ink-800 sm:text-[34px]">
            颠倒引力桌
          </h1>
          <p className="max-w-xl text-sm text-ink-500">
            桌面上的项目贴纸、拍立得、朱印和字条都会响应真实碰撞。按{" "}
            <kbd className="rounded-[4px] border border-line bg-surface px-1.5 py-0.5 font-mono text-[11px] text-ink-700">
              ⌘J
            </kbd>{" "}
            或切换昼夜，整张桌子会倒转吸附到天花板。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => window.dispatchEvent(new Event(THEME_TOGGLE_EVENT))}
          >
            <ArrowsOutLineVerticalIcon aria-hidden="true" className="h-4 w-4 text-accent" />
            <span>{inverted ? "恢复正立 · ⌘J" : "倒转重力 · ⌘J"}</span>
          </Button>
          <Button type="button" variant="secondary" onClick={() => worldRef.current?.shake()}>
            <ShuffleIcon aria-hidden="true" className="h-4 w-4" />
            <span>摇晃桌面</span>
          </Button>
          <Button type="button" variant="ghost" onClick={handleReset}>
            <ClockCounterClockwiseIcon aria-hidden="true" className="h-4 w-4" />
            <span>复位</span>
          </Button>
        </div>
      </header>

      <div className="relative overflow-hidden rounded-xl border border-line bg-ink-50 shadow-[var(--shadow-card)]">
        <div
          ref={containerRef}
          data-ready={ready ? "" : undefined}
          style={{
            backgroundImage:
              "radial-gradient(color-mix(in srgb, var(--ink-800) 9%, transparent) 1px, transparent 1.3px)",
            backgroundSize: "20px 20px",
          }}
          className="relative h-[min(68vh,580px)] min-h-[420px] w-full select-none overflow-hidden"
        >
          <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-between px-4 font-mono text-[10px] tracking-[0.1em] text-ink-400">
            <span>{inverted ? "↑ CEILING LOCKED · -1.6G" : "DESK SURFACE · 320MM × 180MM"}</span>
            <span>{inverted ? "DARK SIDE B" : "↓ FLOOR · +1.6G"}</span>
          </div>

          {items.map((item, index) => {
            const isDragging = draggingIndex === index;
            const isSelected = selectedIndex === index;
            return (
              <button
                type="button"
                key={item.key}
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                onPointerDown={(event) => {
                  if (!event.isPrimary) {
                    return;
                  }
                  pointerDownRef.current = { x: event.clientX, y: event.clientY, index };
                  worldRef.current?.grab(event, index);
                }}
                onClick={(event) => {
                  const down = pointerDownRef.current;
                  pointerDownRef.current = null;
                  if (
                    event.detail === 0 ||
                    (down &&
                      down.index === index &&
                      Math.hypot(event.clientX - down.x, event.clientY - down.y) < 5)
                  ) {
                    setSelectedIndex(index);
                  }
                }}
                style={{ width: item.width, height: item.height }}
                className={cn(
                  "absolute left-0 top-0 cursor-grab touch-none will-change-transform active:cursor-grabbing transition-opacity duration-200",
                  !ready && "opacity-0",
                  isDragging && "z-20",
                  !isDragging && isSelected && "z-10",
                )}
              >
                {item.kind === "polaroid" && (
                  <span
                    className={cn(
                      "flex h-full w-full flex-col rounded-[4px] border bg-surface p-1.5 pb-2.5 shadow-[var(--shadow-card)] transition-transform duration-150",
                      isDragging
                        ? "scale-105 border-accent/60"
                        : isSelected
                          ? "border-accent"
                          : "border-line",
                    )}
                  >
                    <img
                      src={item.src}
                      alt={item.label}
                      draggable={false}
                      className="aspect-[4/3] w-full rounded-[2px] object-cover"
                    />
                    <span className="mt-2 block text-center font-mono text-[10px] tracking-[0.14em] text-ink-600">
                      {item.label}
                    </span>
                  </span>
                )}

                {item.kind === "seal" && (
                  <span
                    className={cn(
                      "flex h-full w-full items-center justify-center rounded-[6px] border-2 shadow-[var(--shadow-card)] transition-transform duration-150",
                      collectedStamps[item.id]
                        ? "border-accent bg-accent-soft text-accent"
                        : "border-dashed border-ink-300 bg-surface/90 text-ink-400",
                      isDragging && "scale-110",
                    )}
                  >
                    <SealChars seal={item.seal} />
                  </span>
                )}

                {item.kind === "slip" && (
                  <span
                    className={cn(
                      "flex h-full w-full items-center justify-between gap-2 rounded-[4px] border bg-surface px-2.5 py-1.5 shadow-[var(--shadow-card)] transition-transform duration-150",
                      isDragging
                        ? "scale-105 border-accent/60"
                        : isSelected
                          ? "border-accent"
                          : "border-line",
                    )}
                  >
                    <span className="truncate text-xs font-medium text-ink-700">{item.text}</span>
                    <span className="shrink-0 font-mono text-[9px] tracking-[0.08em] text-ink-400">
                      {item.tag}
                    </span>
                  </span>
                )}

                {item.kind === "sticker" && (
                  <img
                    src={item.logo}
                    alt={item.name}
                    draggable={false}
                    style={{ filter: STICKER_FILTER }}
                    className={cn(
                      "h-full w-full select-none rounded-[22%] object-contain transition-transform duration-150",
                      isDragging && "scale-112",
                    )}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="flex min-h-11 flex-wrap items-center justify-between gap-3 border-t border-line bg-surface px-4 py-2 text-xs text-ink-500">
          <span>
            {selectedItem
              ? selectedItem.kind === "polaroid"
                ? `相册拍立得 · ${selectedItem.label}`
                : selectedItem.kind === "sticker"
                  ? `自制工具 · ${selectedItem.name}`
                  : selectedItem.kind === "seal"
                    ? `${selectedItem.seal} · ${collectedStamps[selectedItem.id] ? `已收于 ${collectedStamps[selectedItem.id]}` : "未盖章"}`
                    : selectedItem.text
              : "拖拽任意物件抛掷、叠放；点击物件可查看名称与传送门。"}
          </span>

          {(selectedItem?.kind === "polaroid" || selectedItem?.kind === "sticker") && (
            <a
              href={selectedItem.href}
              target={selectedItem.kind === "sticker" ? "_blank" : undefined}
              rel={selectedItem.kind === "sticker" ? "noopener noreferrer" : undefined}
              className="inline-flex items-center gap-1 font-mono text-[11px] font-medium text-accent underline underline-offset-4 hover:opacity-80 focus-visible:rounded-[4px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              <span>{selectedItem.kind === "polaroid" ? "进入暗房相册" : "打开项目"}</span>
              <ArrowUpRightIcon aria-hidden="true" className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
