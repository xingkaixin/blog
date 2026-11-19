import { useEffect, useRef, useState } from "react";
import {
  getThemeGravityY,
  mountGravityWorld,
  STICKER_FILTER,
  type GravityWorldHandle,
} from "@/lib/gravity-world";
import { projects } from "@/lib/projects";

const SIZE = 26;
const logos = [...new Set(projects.map((project) => project.logo))];

export function ProjectStickers() {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const worldRef = useRef<GravityWorldHandle | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) {
      return undefined;
    }
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }
    const { width, height } = container.getBoundingClientRect();
    const inverted = getThemeGravityY(document.documentElement.dataset.theme) < 0;
    const perRow = Math.max(Math.floor(width / (SIZE + 6)), 1);

    const specs = logos.map((_, index) => {
      const row = Math.floor(index / perRow);
      const column = index % perRow;
      return {
        x: (column + 0.5) * (width / perRow) + (Math.random() - 0.5) * 6,
        y: inverted ? 70 + row * (SIZE + 10) : height - 70 - row * (SIZE + 10),
        width: SIZE,
        height: SIZE,
        restitution: 0.15,
        angle: (Math.random() - 0.5) * 0.6,
      };
    });

    const world = mountGravityWorld({
      container,
      specs,
      getElement: (index) => itemRefs.current[index] ?? null,
    });
    worldRef.current = world;

    return () => {
      worldRef.current = null;
      world.destroy();
    };
  }, [mounted]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="project-stickers pointer-events-none absolute inset-0 hidden lg:block"
    >
      {mounted &&
        logos.map((logo, index) => (
          <div
            key={logo}
            ref={(el) => {
              itemRefs.current[index] = el;
            }}
            onPointerDown={(event) => worldRef.current?.grab(event, index)}
            style={{ width: SIZE, height: SIZE }}
            className="project-sticker pointer-events-auto absolute left-0 top-0 cursor-grab touch-none will-change-transform active:cursor-grabbing"
          >
            <img
              src={logo}
              alt=""
              loading="lazy"
              decoding="async"
              draggable={false}
              style={{ filter: STICKER_FILTER }}
              className="h-full w-full select-none rounded-[22%] object-contain"
            />
          </div>
        ))}
    </div>
  );
}
