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
  // SSR/测试环境的占位：不可见但保留高度，避免水合前露出未格式化的文字、水合时布局跳动
  if (typeof window === "undefined" || typeof ResizeObserver === "undefined") {
    return (
      <div
        aria-hidden="true"
        className="invisible mt-6 flex justify-end"
        style={{ fontSize: "36px", fontFamily: "cursive" }}
      >
        {siteConfig.author}
      </div>
    );
  }

  const rendererRef = useRef<TegakiRendererHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // tegaki 引擎可能晚于组件挂载才就绪（island 滚到视口才水合时尤其如此），
  // 直接在 IO 回调里 play() 会落空。这里每帧同步期望状态：
  // 引擎就绪后先暂停一次，等进入视口再播放，播放后停止同步。
  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return undefined;
    }

    let visible = false;
    let paused = false;
    let raf = 0;

    const sync = () => {
      const engine = rendererRef.current?.engine;
      if (engine && !paused) {
        engine.pause();
        paused = true;
      }
      if (engine && visible) {
        engine.play();
        return;
      }
      raf = requestAnimationFrame(sync);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          visible = true;
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );

    observer.observe(el);
    raf = requestAnimationFrame(sync);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={containerRef} className="mt-6 flex justify-end">
      <span className="signature-static font-display text-4xl text-ink-600">
        {siteConfig.author}
      </span>
      <span className="signature-animated">
        <TegakiRenderer
          ref={rendererRef}
          font={dancingScriptBundle}
          text={siteConfig.author}
          time={{ mode: "uncontrolled", loop: false, speed: 1.2 }}
          style={{ fontSize: "36px", color: "var(--ink-600)" }}
        />
      </span>
    </div>
  );
}
