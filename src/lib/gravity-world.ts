import Matter from "matter-js";
import type * as React from "react";

const { Bodies, Body, Composite, Constraint, Engine, Events, Sleeping } = Matter;

const WALL = 80;
const STEP_MS = 1000 / 60;
const DEFAULT_MAX_SPEED = 18;

export const THEME_GRAVITY = 1.6;

// 8 方向 1px 白色 drop-shadow 叠加，基于 alpha 通道贴合透明图标实际轮廓描边
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

export const STICKER_FILTER = `${WHITE_STROKE} drop-shadow(0 2px 3px rgba(31,24,18,0.2))`;

export type GravityBodySpec = {
  x: number;
  y: number;
  width: number;
  height: number;
  restitution?: number;
  friction?: number;
  frictionAir?: number;
  angle?: number;
  chamferRadius?: number;
};

export type GravityWorldHandle = {
  grab: (event: PointerEvent | React.PointerEvent, index: number) => void;
  shake: () => void;
  reset: (positions: readonly { x: number; y: number; angle?: number }[]) => void;
  destroy: () => void;
};

export function getThemeGravityY(theme?: string | null): number {
  return theme === "dark" ? -THEME_GRAVITY : THEME_GRAVITY;
}

export function clampBodyCenter(
  x: number,
  y: number,
  halfWidth: number,
  halfHeight: number,
  worldWidth: number,
  worldHeight: number,
): { x: number; y: number } {
  const minX = halfWidth;
  const maxX = Math.max(halfWidth, worldWidth - halfWidth);
  const minY = halfHeight;
  const maxY = Math.max(halfHeight, worldHeight - halfHeight);
  return {
    x: Math.min(Math.max(x, minX), maxX),
    y: Math.min(Math.max(y, minY), maxY),
  };
}

export function createBoundsWalls(width: number, height: number, wallThickness = WALL) {
  const options = { isStatic: true, friction: 0.8 };
  return [
    Bodies.rectangle(
      width / 2,
      height + wallThickness / 2,
      width + wallThickness * 2,
      wallThickness,
      options,
    ),
    Bodies.rectangle(
      width / 2,
      -wallThickness / 2,
      width + wallThickness * 2,
      wallThickness,
      options,
    ),
    Bodies.rectangle(
      -wallThickness / 2,
      height / 2,
      wallThickness,
      height + wallThickness * 2,
      options,
    ),
    Bodies.rectangle(
      width + wallThickness / 2,
      height / 2,
      wallThickness,
      height + wallThickness * 2,
      options,
    ),
  ];
}

export function mountGravityWorld({
  container,
  specs,
  getElement,
  maxSpeed = DEFAULT_MAX_SPEED,
  onGravityChange,
  onDraggingChange,
}: {
  container: HTMLElement;
  specs: readonly GravityBodySpec[];
  getElement: (index: number) => HTMLElement | null;
  maxSpeed?: number;
  onGravityChange?: (gravityY: number) => void;
  onDraggingChange?: (index: number | null) => void;
}): GravityWorldHandle {
  let { width, height } = container.getBoundingClientRect();
  const engine = Engine.create({ enableSleeping: true, positionIterations: 10 });
  engine.gravity.y = getThemeGravityY(document.documentElement.dataset.theme);
  onGravityChange?.(engine.gravity.y);

  const items = specs.map((spec) => {
    const halfWidth = spec.width / 2;
    const halfHeight = spec.height / 2;
    const chamfer = spec.chamferRadius ?? Math.min(halfWidth, halfHeight) * 0.2;
    const body = Bodies.rectangle(spec.x, spec.y, spec.width, spec.height, {
      chamfer: chamfer > 0 ? { radius: chamfer } : undefined,
      restitution: spec.restitution ?? 0.2,
      friction: spec.friction ?? 0.6,
      frictionAir: spec.frictionAir ?? 0.015,
      angle: spec.angle ?? 0,
    });
    return { body, halfWidth, halfHeight };
  });

  const bodies = items.map((item) => item.body);
  let walls = createBoundsWalls(width, height);
  Composite.add(engine.world, [...walls, ...bodies]);

  Events.on(engine, "afterUpdate", () => {
    for (const item of items) {
      const { body, halfWidth, halfHeight } = item;
      if (body.speed > maxSpeed) {
        Body.setVelocity(body, {
          x: (body.velocity.x / body.speed) * maxSpeed,
          y: (body.velocity.y / body.speed) * maxSpeed,
        });
      }
      const next = clampBodyCenter(
        body.position.x,
        body.position.y,
        halfWidth,
        halfHeight,
        width,
        height,
      );
      if (next.x !== body.position.x || next.y !== body.position.y) {
        Body.setPosition(body, next);
      }
    }
  });

  const render = () => {
    items.forEach(({ body, halfWidth, halfHeight }, index) => {
      const el = getElement(index);
      if (el) {
        el.style.transform = `translate(${body.position.x - halfWidth}px, ${body.position.y - halfHeight}px) rotate(${body.angle}rad)`;
      }
    });
  };

  let drag: { constraint: Matter.Constraint; index: number; pointerId: number } | null = null;
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
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const grab = (event: PointerEvent | React.PointerEvent, index: number) => {
    const item = items[index];
    if (drag || !item) {
      return;
    }
    if (event.currentTarget instanceof Element) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    const point = toWorld(event);
    const constraint = Constraint.create({
      pointA: point,
      bodyB: item.body,
      pointB: { x: point.x - item.body.position.x, y: point.y - item.body.position.y },
      stiffness: 0.2,
      damping: 0.1,
      length: 0.01,
    });
    Composite.add(engine.world, constraint);
    Sleeping.set(item.body, false);
    drag = { constraint, index, pointerId: event.pointerId };
    getElement(index)?.setAttribute("data-dragging", "");
    onDraggingChange?.(index);
    start();
  };

  const onMove = (event: PointerEvent) => {
    if (drag?.pointerId !== event.pointerId) {
      return;
    }
    drag.constraint.pointA = toWorld(event);
  };

  const onRelease = (event: PointerEvent) => {
    if (drag?.pointerId !== event.pointerId) {
      return;
    }
    Composite.remove(engine.world, drag.constraint);
    getElement(drag.index)?.removeAttribute("data-dragging");
    onDraggingChange?.(null);
    drag = null;
  };

  const syncThemeGravity = () => {
    const nextGravity = getThemeGravityY(document.documentElement.dataset.theme);
    if (engine.gravity.y === nextGravity) {
      return;
    }
    engine.gravity.y = nextGravity;
    onGravityChange?.(nextGravity);
    for (const body of bodies) {
      Sleeping.set(body, false);
      Body.setVelocity(body, {
        x: body.velocity.x + (Math.random() - 0.5) * 1.2,
        y: Math.sign(nextGravity) * 1.1,
      });
    }
    start();
  };

  const resizeObserver = new ResizeObserver(([entry]) => {
    const next = entry.contentRect;
    if (next.width === 0 || (next.width === width && next.height === height)) {
      return;
    }
    const shift = engine.gravity.y > 0 ? next.height - height : 0;
    width = next.width;
    height = next.height;
    Composite.remove(engine.world, walls);
    walls = createBoundsWalls(width, height);
    Composite.add(engine.world, walls);
    for (const { body, halfWidth, halfHeight } of items) {
      Body.setPosition(
        body,
        clampBodyCenter(
          body.position.x,
          body.position.y + shift,
          halfWidth,
          halfHeight,
          width,
          height,
        ),
      );
      Sleeping.set(body, false);
    }
    start();
  });

  const themeObserver = new MutationObserver(syncThemeGravity);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    for (let i = 0; i < 300; i += 1) {
      Engine.update(engine, STEP_MS);
    }
  }
  render();
  container.setAttribute("data-ready", "");
  start();
  resizeObserver.observe(container);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onRelease);
  window.addEventListener("pointercancel", onRelease);

  const shake = () => {
    const pullSign = Math.sign(engine.gravity.y || THEME_GRAVITY);
    for (const body of bodies) {
      Sleeping.set(body, false);
      Body.setVelocity(body, {
        x: (Math.random() - 0.5) * 16,
        y: (Math.random() - 0.5) * 10 - pullSign * 6,
      });
      Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.22);
    }
    start();
  };

  const reset = (positions: readonly { x: number; y: number; angle?: number }[]) => {
    items.forEach(({ body, halfWidth, halfHeight }, index) => {
      const target = positions[index];
      if (!target) {
        return;
      }
      Sleeping.set(body, false);
      Body.setPosition(
        body,
        clampBodyCenter(target.x, target.y, halfWidth, halfHeight, width, height),
      );
      Body.setVelocity(body, { x: 0, y: 0 });
      Body.setAngle(body, target.angle ?? 0);
      Body.setAngularVelocity(body, 0);
    });
    start();
  };

  const destroy = () => {
    cancelAnimationFrame(frame);
    resizeObserver.disconnect();
    themeObserver.disconnect();
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onRelease);
    window.removeEventListener("pointercancel", onRelease);
    Events.off(engine, "afterUpdate");
    Engine.clear(engine);
  };

  return { grab, shake, reset, destroy };
}
