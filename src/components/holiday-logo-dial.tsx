import type { KeyboardEvent, PointerEvent, Ref } from "react";
import type { LogoNode, LogoNodeId } from "@/lib/logo-orrery";

const DAY_TICK_PATHS: ReadonlyArray<{ kind: "major" | "mid" | "minor"; d: string }> = (() => {
  const groups: Record<"major" | "mid" | "minor", string[]> = { major: [], mid: [], minor: [] };
  const cx = 281;
  const cy = 281;
  const r2 = 262;
  for (let day = 0; day < 365; day++) {
    const rad = (day / 365) * Math.PI * 2;
    const kind = day % 30 === 0 ? "major" : day % 5 === 0 ? "mid" : "minor";
    const r1 = kind === "major" ? 246 : kind === "mid" ? 252 : 256;
    const sin = Math.sin(rad);
    const cos = Math.cos(rad);
    const x1 = (cx + r1 * sin).toFixed(1);
    const y1 = (cy - r1 * cos).toFixed(1);
    const x2 = (cx + r2 * sin).toFixed(1);
    const y2 = (cy - r2 * cos).toFixed(1);
    groups[kind].push(`M${x1} ${y1}L${x2} ${y2}`);
  }
  return (["major", "mid", "minor"] as const).map((kind) => ({
    kind,
    d: groups[kind].join(""),
  }));
})();

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

const MONTH_MARKS = (() => {
  let startDay = 0;
  return MONTH_DAYS.map((days, index) => {
    const deg = (startDay / 365) * 360;
    startDay += days;
    return {
      label: String(index + 1).padStart(2, "0"),
      deg,
    };
  });
})();

export function HolidayLogoDial({
  nodes,
  selectedId,
  initialAngle,
  interactive,
  wheelRef,
  onDialPointerDown,
  onDialPointerMove,
  onDialPointerEnd,
  onStep,
  onSelect,
}: {
  nodes: LogoNode[];
  selectedId: LogoNodeId;
  initialAngle: number;
  interactive: boolean;
  wheelRef: Ref<HTMLDivElement>;
  onDialPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onDialPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onDialPointerEnd: (event: PointerEvent<HTMLDivElement>) => void;
  onStep: (delta: number) => void;
  onSelect: (id: LogoNodeId) => void;
}) {
  const selectedIndex = Math.max(
    0,
    nodes.findIndex((node) => node.id === selectedId),
  );
  const current = nodes[selectedIndex] ?? nodes[0];

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!interactive) {
      return;
    }
    const offsets: Record<string, number> = {
      ArrowRight: 1,
      ArrowUp: 1,
      ArrowLeft: -1,
      ArrowDown: -1,
    };
    if (event.key in offsets) {
      event.preventDefault();
      onStep(offsets[event.key]);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      onSelect(nodes[0].id);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      onSelect(nodes[nodes.length - 1].id);
    }
  }

  return (
    <>
      <svg data-logo-reticle viewBox="0 0 590 590" fill="none" aria-hidden="true">
        <circle data-reticle-ring cx="295" cy="295" r="290" />
        <line data-reticle-axis x1="295" y1="6" x2="295" y2="584" />
        <line data-reticle-axis x1="6" y1="295" x2="584" y2="295" />
        <polygon data-reticle-pointer points="295,12 289,0 301,0" />
        <circle data-reticle-pointer cx="295" cy="22" r="3" />
      </svg>

      <div
        ref={wheelRef}
        data-logo-wheel
        style={{ transform: `rotate(${initialAngle.toFixed(3)}deg)` }}
        role={interactive ? "slider" : undefined}
        tabIndex={interactive ? 0 : -1}
        aria-label={interactive ? "365 日岁时星盘" : undefined}
        aria-valuemin={interactive ? 1 : undefined}
        aria-valuemax={interactive ? nodes.length : undefined}
        aria-valuenow={interactive ? selectedIndex + 1 : undefined}
        aria-valuetext={interactive ? `${current.name}，${current.date}` : undefined}
        onPointerDown={onDialPointerDown}
        onPointerMove={onDialPointerMove}
        onPointerUp={onDialPointerEnd}
        onPointerCancel={onDialPointerEnd}
        onLostPointerCapture={onDialPointerEnd}
        onKeyDown={handleKeyDown}
      >
        <svg viewBox="0 0 562 562" fill="none" aria-hidden="true">
          <circle data-wheel-track="outer" cx="281" cy="281" r="262" />
          <circle data-wheel-track="inner" cx="281" cy="281" r="218" />
          {DAY_TICK_PATHS.map(({ kind, d }) => (
            <path key={kind} data-wheel-tick={kind} d={d} />
          ))}
          {MONTH_MARKS.map(({ label, deg }) => (
            <text
              key={label}
              data-wheel-month
              x="281"
              y="45"
              textAnchor="middle"
              transform={`rotate(${deg.toFixed(2)} 281 281)`}
            >
              {label}
            </text>
          ))}
          {nodes.map((node) => {
            const deg = node.fraction * 360;
            const active = node.id === selectedId;
            return (
              <g
                key={node.id}
                data-wheel-star
                data-logo-group={node.group}
                data-active={active ? "true" : undefined}
                transform={`rotate(${deg.toFixed(2)} 281 281)`}
              >
                {(node.group === "personal" || node.group === "seal" || active) && (
                  <circle data-star-halo cx="281" cy="64" r={active ? 9.5 : 8} />
                )}
                <circle
                  data-star-dot
                  cx="281"
                  cy="64"
                  r={active ? 5.8 : node.group === "personal" ? 4.8 : 4}
                />
              </g>
            );
          })}
        </svg>
      </div>
    </>
  );
}
