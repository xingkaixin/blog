import Matter from "matter-js";
import { useEffect, useRef } from "react";
import { projects } from "@/lib/projects";

const { Bodies, Body, Composite, Constraint, Engine, Events, Sleeping } = Matter;

const SIZE = 26;
const HALF = SIZE / 2;
const WALL = 80;
const STEP_MS = 1000 / 60;
const MAX_SPEED = 18;
const logos = [...new Set(projects.map((project) => project.logo))];

// 8 方向 1px 白色 drop-shadow 叠加，基于 alpha 通道贴合 logo 实际轮廓描边
const WHITE_STROKE = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [-1, -1],
  [1, -1],
  [-1, 1],
]
  .map(([x, y]) => `drop-shadow(${x}px ${y}px 0 #fff)`)
  .join(" ");

const RESTING_SHADOW = "drop-shadow(0 2px 3px rgba(31,24,18,0.2))";

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

function createWalls(width: number, height: number) {
  const options = { isStatic: true, friction: 0.8 };
  return [
    Bodies.rectangle(width / 2, height + WALL / 2, width + WALL * 2, WALL, options),
    Bodies.rectangle(width / 2, -WALL / 2, width + WALL * 2, WALL, options),
    Bodies.rectangle(-WALL / 2, height / 2, WALL, height + WALL * 2, options),
    Bodies.rectangle(width + WALL / 2, height / 2, WALL, height + WALL * 2, options),
  ];
}

export function ProjectStickers() {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const grabRef = useRef<(event: React.PointerEvent, index: number) => void>(() => {});

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }
    let { width, height } = container.getBoundingClientRect();
    const engine = Engine.create({ enableSleeping: true, positionIterations: 10 });
    engine.gravity.y = 1.6;

    const perRow = Math.max(Math.floor(width / (SIZE + 6)), 1);
    const bodies = logos.map((_, index) => {
      const row = Math.floor(index / perRow);
      const column = index % perRow;
      return Bodies.rectangle(
        (column + 0.5) * (width / perRow) + (Math.random() - 0.5) * 6,
        height - 70 - row * (SIZE + 10),
        SIZE,
        SIZE,
        {
          chamfer: { radius: SIZE * 0.22 },
          restitution: 0.15,
          friction: 0.6,
          frictionAir: 0.015,
          angle: (Math.random() - 0.5) * 0.6,
        },
      );
    });
    let walls = createWalls(width, height);
    Composite.add(engine.world, [...walls, ...bodies]);

    Events.on(engine, "afterUpdate", () => {
      for (const body of bodies) {
        if (body.speed > MAX_SPEED) {
          Body.setVelocity(body, {
            x: (body.velocity.x / body.speed) * MAX_SPEED,
            y: (body.velocity.y / body.speed) * MAX_SPEED,
          });
        }
        // 拖拽挤压可能把相邻 logo 推穿墙体，越界时拉回世界内
        const x = clamp(body.position.x, HALF, width - HALF);
        const y = clamp(body.position.y, HALF, height - HALF);
        if (x !== body.position.x || y !== body.position.y) {
          Body.setPosition(body, { x, y });
        }
      }
    });

    const render = () => {
      bodies.forEach((body, index) => {
        const el = itemRefs.current[index];
        if (el) {
          el.style.transform = `translate(${body.position.x - HALF}px, ${body.position.y - HALF}px) rotate(${body.angle}rad)`;
        }
      });
    };

    let drag: { constraint: Matter.Constraint; index: number } | null = null;
    let frame = 0;
    let last = 0;
    let lag = 0;

    const tick = (now: number) => {
      lag = Math.min(lag + now - last, STEP_MS * 5);
      last = now;
      while (lag >= STEP_MS) {
        Engine.update(engine, STEP_MS);
        lag -= STEP_MS;
      }
      render();
      frame = drag || bodies.some((body) => !body.isSleeping) ? requestAnimationFrame(tick) : 0;
    };

    const start = () => {
      if (frame) {
        return;
      }
      last = performance.now();
      lag = 0;
      frame = requestAnimationFrame(tick);
    };

    const toWorld = (event: PointerEvent | React.PointerEvent) => {
      const rect = container.getBoundingClientRect();
      return {
        x: clamp(event.clientX - rect.left, HALF, width - HALF),
        y: clamp(event.clientY - rect.top, HALF, height - HALF),
      };
    };

    grabRef.current = (event, index) => {
      if (drag) {
        return;
      }
      event.currentTarget.setPointerCapture(event.pointerId);
      const body = bodies[index];
      const point = toWorld(event);
      const constraint = Constraint.create({
        pointA: point,
        bodyB: body,
        pointB: { x: point.x - body.position.x, y: point.y - body.position.y },
        stiffness: 0.2,
        damping: 0.1,
        length: 0.01,
      });
      Composite.add(engine.world, constraint);
      Sleeping.set(body, false);
      drag = { constraint, index };
      itemRefs.current[index]?.setAttribute("data-dragging", "");
      start();
    };

    const onMove = (event: PointerEvent) => {
      if (drag) {
        drag.constraint.pointA = toWorld(event);
      }
    };

    const onRelease = () => {
      if (!drag) {
        return;
      }
      Composite.remove(engine.world, drag.constraint);
      itemRefs.current[drag.index]?.removeAttribute("data-dragging");
      drag = null;
    };

    const observer = new ResizeObserver(([entry]) => {
      const next = entry.contentRect;
      if (next.width === 0 || (next.width === width && next.height === height)) {
        return;
      }
      // 地面贴着容器底部，高度变化时整体平移，避免 logo 悬空或陷进地面
      const shift = next.height - height;
      width = next.width;
      height = next.height;
      Composite.remove(engine.world, walls);
      walls = createWalls(width, height);
      Composite.add(engine.world, walls);
      for (const body of bodies) {
        Body.setPosition(body, { x: body.position.x, y: body.position.y + shift });
        Sleeping.set(body, false);
      }
      start();
    });

    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      for (let i = 0; i < 300; i += 1) {
        Engine.update(engine, STEP_MS);
      }
    }
    render();
    container.setAttribute("data-ready", "");
    start();
    observer.observe(container);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onRelease);
    window.addEventListener("pointercancel", onRelease);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onRelease);
      window.removeEventListener("pointercancel", onRelease);
      Events.off(engine, "afterUpdate");
      Engine.clear(engine);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="project-stickers pointer-events-none absolute inset-0 hidden lg:block"
    >
      {logos.map((logo, index) => (
        <div
          key={logo}
          ref={(el) => {
            itemRefs.current[index] = el;
          }}
          onPointerDown={(event) => grabRef.current(event, index)}
          style={{ width: SIZE, height: SIZE }}
          className="project-sticker pointer-events-auto absolute left-0 top-0 cursor-grab touch-none will-change-transform active:cursor-grabbing"
        >
          <img
            src={logo}
            alt=""
            draggable={false}
            style={{ filter: `${WHITE_STROKE} ${RESTING_SHADOW}` }}
            className="h-full w-full select-none object-contain"
          />
        </div>
      ))}
    </div>
  );
}
