import { useEffect, useRef, useState } from "react";
import { projects } from "@/lib/projects";

const SIZE = 30;
// 初始散布只占据 header 中间横向区域，两端留白避免遮挡 logo 与导航按钮
const CENTER_MARGIN = 0.22;
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

const LIFTED_SHADOW = "drop-shadow(0 8px 10px rgba(31,24,18,0.35))";
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
  const dragRef = useRef<{ index: number; offsetX: number; offsetY: number } | null>(null);
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [dragging, setDragging] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }
    const { width, height } = el.getBoundingClientRect();
    const xMin = width * CENTER_MARGIN;
    const xSpan = Math.max(width * (1 - 2 * CENTER_MARGIN) - SIZE, 0);
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
    if (!el) {
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = el.getBoundingClientRect();
    dragRef.current = {
      index,
      offsetX: e.clientX - rect.left - stickers[index].x,
      offsetY: e.clientY - rect.top - stickers[index].y,
    };
    setDragging(index);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    const el = containerRef.current;
    if (!drag || !el) {
      return;
    }
    const rect = el.getBoundingClientRect();
    const x = clamp(e.clientX - rect.left - drag.offsetX, 0, rect.width - SIZE);
    const y = clamp(e.clientY - rect.top - drag.offsetY, 0, rect.height - SIZE);
    setStickers((prev) => prev.map((s, i) => (i === drag.index ? { ...s, x, y } : s)));
  };

  const onPointerUp = () => {
    dragRef.current = null;
    setDragging(null);
  };

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0 overflow-hidden">
      {stickers.map((s, i) => {
        const isDragging = dragging === i;
        return (
          <img
            key={s.logo}
            src={s.logo}
            alt=""
            draggable={false}
            onPointerDown={(e) => onPointerDown(e, i)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            style={{
              width: SIZE,
              height: SIZE,
              transform: `translate(${s.x}px, ${s.y}px) rotate(${isDragging ? 0 : s.rotation}deg) scale(${isDragging ? 1.18 : 1})`,
              filter: `${WHITE_STROKE} ${isDragging ? LIFTED_SHADOW : RESTING_SHADOW}`,
              zIndex: isDragging ? 30 : 10,
              transition: isDragging ? "none" : "transform 0.2s ease, filter 0.2s ease",
            }}
            className="pointer-events-auto absolute left-0 top-0 cursor-grab touch-none select-none object-contain active:cursor-grabbing"
          />
        );
      })}
    </div>
  );
}
