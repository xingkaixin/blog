import { useEffect, useRef } from "react";
import { TegakiRenderer, type TegakiRendererHandle } from "tegaki/react";
import glyphData from "@/lib/dancing-script-glyph-data.json";
import { siteConfig } from "@/lib/site";

const dancingScriptBundle = {
  version: 0,
  family: "Dancing Script",
  lineCap: "round" as const,
  fontUrl: "/fonts/dancing-script.ttf",
  fontFaceCSS: `@font-face { font-family: 'Dancing Script'; src: url(/fonts/dancing-script.ttf); }`,
  unitsPerEm: 1000,
  ascender: 920,
  descender: -280,
  glyphData,
};

export function SignatureAnimation() {
  // 在缺少浏览器 API 的环境（如测试）中优雅降级
  if (typeof window === "undefined" || typeof ResizeObserver === "undefined") {
    return (
      <div
        className="mt-6 flex justify-end text-ink-400"
        style={{ fontSize: "36px", fontFamily: "cursive" }}
      >
        {siteConfig.author}
      </div>
    );
  }

  const rendererRef = useRef<TegakiRendererHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasStarted = useRef(false);

  // 组件挂载后立即暂停，等待滚动触发
  useEffect(() => {
    rendererRef.current?.engine?.pause();
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !hasStarted.current) {
            hasStarted.current = true;
            rendererRef.current?.engine?.play();
          }
        }
      },
      { threshold: 0.3 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="mt-6 flex justify-end">
      <TegakiRenderer
        ref={rendererRef}
        font={dancingScriptBundle}
        text={siteConfig.author}
        time={{ mode: "uncontrolled", loop: false, speed: 1.2 }}
        style={{ fontSize: "36px", color: "#4b4b4b" }}
      />
    </div>
  );
}
