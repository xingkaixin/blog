import { useEffect, useRef, useState } from "react";
import { projects } from "@/lib/projects";

const SIZE = 30;
// 初始散布只占据 header 左中段，右侧留白避免遮挡导航与主题切换按钮
const X_MIN_RATIO = 0.24;
const X_MAX_RATIO = 0.52;
const logos = [...new Set(projects.map((p) => p.logo))];

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

interface Sticker {
  logo: string;
  x: number;
  y: number;
  rotation: number;
}

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

export function HeaderStickers() {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    index: number;
    offsetX: number;
    offsetY: number;
    rect: DOMRect;
    x: number;
    y: number;
  } | null>(null);
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [dragging, setDragging] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }
    const { width, height } = el.getBoundingClientRect();
    const xMin = width * X_MIN_RATIO;
    const xSpan = Math.max(width * (X_MAX_RATIO - X_MIN_RATIO) - SIZE, 0);
    setStickers(
      logos.map((logo) => ({
        logo,
        x: xMin + Math.random() * xSpan,
        y: Math.random() * Math.max(height - SIZE, 0),
        rotation: (Math.random() - 0.5) * 36,
      })),
    );
  }, []);

  const onPointerDown = (e: React.PointerEvent, index: number) => {
    const el = containerRef.current;
    if (!el || dragRef.current) {
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = el.getBoundingClientRect();
    dragRef.current = {
      index,
      offsetX: e.clientX - rect.left - stickers[index].x,
      offsetY: e.clientY - rect.top - stickers[index].y,
      rect,
      x: stickers[index].x,
      y: stickers[index].y,
    };
    setDragging(index);
  };

  // 拖动期间直接写 DOM transform，绕过 React 重渲染，松手时再提交状态
  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) {
      return;
    }
    drag.x = clamp(e.clientX - drag.rect.left - drag.offsetX, 0, drag.rect.width - SIZE);
    drag.y = clamp(e.clientY - drag.rect.top - drag.offsetY, 0, drag.rect.height - SIZE);
    (e.currentTarget as HTMLElement).style.transform = `translate(${drag.x}px, ${drag.y}px)`;
  };

  const onPointerUp = () => {
    const drag = dragRef.current;
    if (drag) {
      setStickers((prev) =>
        prev.map((s, i) => (i === drag.index ? { ...s, x: drag.x, y: drag.y } : s)),
      );
    }
    dragRef.current = null;
    setDragging(null);
  };

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const delta = event.shiftKey ? 10 : 2;
    const movement: Record<string, [number, number]> = {
      ArrowLeft: [-delta, 0],
      ArrowRight: [delta, 0],
      ArrowUp: [0, -delta],
      ArrowDown: [0, delta],
    };
    const offset = movement[event.key];
    const rect = containerRef.current?.getBoundingClientRect();
    if (!offset || !rect) {
      return;
    }
    event.preventDefault();
    setStickers((current) =>
      current.map((sticker, stickerIndex) =>
        stickerIndex === index
          ? {
              ...sticker,
              x: clamp(sticker.x + offset[0], 0, rect.width - SIZE),
              y: clamp(sticker.y + offset[1], 0, rect.height - SIZE),
            }
          : sticker,
      ),
    );
  };

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0 overflow-hidden">
      {stickers.map((s, i) => {
        const isDragging = dragging === i;
        return (
          <div
            data-header-sticker
            role="button"
            tabIndex={0}
            aria-label={`移动装饰贴纸 ${i + 1}，使用方向键调整位置`}
            key={s.logo}
            onPointerDown={(e) => onPointerDown(e, i)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onKeyDown={(event) => onKeyDown(event, i)}
            style={{
              width: SIZE,
              height: SIZE,
              transform: `translate(${s.x}px, ${s.y}px)`,
              zIndex: isDragging ? 30 : 10,
              willChange: "transform",
            }}
            className="pointer-events-auto absolute left-0 top-0 cursor-grab touch-none rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:cursor-grabbing"
          >
            {/* 拿起时的落影：radial-gradient + opacity 过渡，全程走合成器，避免 Chrome 逐帧重算 filter */}
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                left: "8%",
                right: "8%",
                bottom: "-20%",
                height: "36%",
                borderRadius: "50%",
                background: "radial-gradient(ellipse, rgba(20,21,26,0.35), transparent 70%)",
                opacity: isDragging ? 1 : 0,
                transition: "opacity 0.2s ease",
              }}
            />
            <img
              src={s.logo}
              alt=""
              draggable={false}
              style={{
                transform: `rotate(${isDragging ? 0 : s.rotation}deg) scale(${isDragging ? 1.18 : 1})`,
                filter: `${WHITE_STROKE} ${RESTING_SHADOW}`,
                // 拿起用 ease-out 平稳抬起，放下用回弹曲线做出"啪"地贴下的手感
                transition: `transform 0.25s ${isDragging ? "cubic-bezier(0.2,0.85,0.25,1)" : "cubic-bezier(0.34,1.56,0.64,1)"}`,
              }}
              className="relative h-full w-full select-none object-contain"
            />
          </div>
        );
      })}
    </div>
  );
}
