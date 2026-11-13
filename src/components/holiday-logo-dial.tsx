import { useRef, type PointerEvent } from "react";
import type { HolidayLogoEvent } from "@/lib/holiday-logo-calendar";
import type { HolidayLogoId } from "@/lib/holiday-logos";

const seasons = [
  { id: "spring-equinox", name: "春生", season: "spring" },
  { id: "summer-solstice", name: "夏长", season: "summer" },
  { id: "autumn-equinox", name: "秋收", season: "autumn" },
  { id: "winter", name: "冬藏", season: "winter" },
] as const;

export function HolidayLogoDial({
  events,
  selectedIndex,
  onSelect,
}: {
  events: HolidayLogoEvent[];
  selectedIndex: number;
  onSelect: (id: HolidayLogoId, animated: boolean) => void;
}) {
  const dragPointer = useRef<number | null>(null);
  const year = Number(events[0].date.slice(0, 4));
  const start = Date.parse(`${year}-01-01T00:00:00Z`);
  const length = Date.parse(`${year + 1}-01-01T00:00:00Z`) - start;
  const positions = events.map(({ date }) => (Date.parse(`${date}T00:00:00Z`) - start) / length);

  function scrub(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const angle = Math.atan2(
      event.clientX - bounds.x - bounds.width / 2,
      bounds.y + bounds.height / 2 - event.clientY,
    );
    const position = (angle / (Math.PI * 2) + 1) % 1;
    const distances = positions.map((value) => {
      const distance = Math.abs(value - position);
      return Math.min(distance, 1 - distance);
    });
    onSelect(events[distances.indexOf(Math.min(...distances))].id, false);
  }

  return (
    <div data-logo-compass>
      <div
        data-logo-dial
        role="slider"
        tabIndex={0}
        aria-label="全年 Logo 时光罗盘"
        aria-valuemin={1}
        aria-valuemax={events.length}
        aria-valuenow={selectedIndex + 1}
        aria-valuetext={`${events[selectedIndex].name}，${events[selectedIndex].date}`}
        onPointerDown={(event) => {
          if (!event.isPrimary || event.button !== 0 || dragPointer.current !== null) {
            return;
          }
          dragPointer.current = event.pointerId;
          event.currentTarget.setPointerCapture(event.pointerId);
          scrub(event);
        }}
        onPointerMove={(event) => {
          if (dragPointer.current === event.pointerId) {
            scrub(event);
          }
        }}
        onLostPointerCapture={() => {
          dragPointer.current = null;
        }}
        onPointerUp={(event) => event.currentTarget.releasePointerCapture(event.pointerId)}
        onPointerCancel={() => {
          dragPointer.current = null;
        }}
        onKeyDown={(event) => {
          const offsets: Record<string, number> = {
            ArrowRight: 1,
            ArrowUp: 1,
            ArrowLeft: -1,
            ArrowDown: -1,
          };
          let index = selectedIndex;
          if (event.key in offsets) {
            index = (selectedIndex + offsets[event.key] + events.length) % events.length;
          } else if (event.key === "Home") {
            index = 0;
          } else if (event.key === "End") {
            index = events.length - 1;
          } else {
            return;
          }
          event.preventDefault();
          onSelect(events[index].id, false);
        }}
      >
        <svg viewBox="0 0 400 400" fill="none" aria-hidden="true">
          <circle data-logo-orbit cx="200" cy="200" r="165" />
          {Array.from({ length: 72 }, (_, index) => (
            <line
              key={index}
              data-logo-tick
              x1="200"
              y1={index % 6 === 0 ? 12 : 17}
              x2="200"
              y2="24"
              transform={`rotate(${index * 5} 200 200)`}
            />
          ))}
          {positions.map((position, index) => (
            <g key={events[index].id} transform={`rotate(${position * 360} 200 200)`}>
              <circle
                data-logo-date-dot
                data-selected={index === selectedIndex}
                cx="200"
                cy="35"
                r={index === selectedIndex ? 5 : 2.5}
              />
            </g>
          ))}
          <g data-logo-needle style={{ transform: `rotate(${positions[selectedIndex] * 360}deg)` }}>
            <path d="m195 3 5 8 5-8" />
          </g>
        </svg>
      </div>
      {seasons.map(({ id, name, season }) => {
        const event = events.find((item) => item.id === id);
        return (
          <button
            type="button"
            key={id}
            data-logo-season={season}
            disabled={!event}
            aria-label={`查看${event?.name ?? name} Logo`}
            onClick={(click) => event && onSelect(event.id, click.detail > 0)}
          >
            {name}
          </button>
        );
      })}
    </div>
  );
}
