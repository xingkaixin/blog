import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export type PillBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type UseSlidingPillOptions<K extends string> = {
  initialKey?: K | null;
  enabled?: boolean;
};

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function isDesktopViewport(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(min-width: 768px)").matches
  );
}

export function getCssEasing(token: string, fallback: string): string {
  if (typeof document === "undefined") {
    return fallback;
  }
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  return value || fallback;
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

function measureButtonBox(element: HTMLElement, track: HTMLElement): PillBox | null {
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    return null;
  }
  const trackRect = track.getBoundingClientRect();
  return {
    x: rect.left - (trackRect.left + track.clientLeft) + track.scrollLeft,
    y: rect.top - (trackRect.top + track.clientTop) + track.scrollTop,
    width: rect.width,
    height: rect.height,
  };
}

function measureLivePillBox(pill: HTMLElement, track: HTMLElement): PillBox | null {
  const rect = pill.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    return null;
  }
  const trackRect = track.getBoundingClientRect();
  const unscaledHeight = Number.parseFloat(pill.style.height) || rect.height;
  const centerY = rect.top + rect.height / 2;
  return {
    x: rect.left - (trackRect.left + track.clientLeft) + track.scrollLeft,
    y: centerY - unscaledHeight / 2 - (trackRect.top + track.clientTop) + track.scrollTop,
    width: rect.width,
    height: unscaledHeight,
  };
}

function applyPillBox(pill: HTMLElement, box: PillBox | null): void {
  if (!box) {
    pill.style.opacity = "0";
    return;
  }
  pill.style.width = `${box.width}px`;
  pill.style.height = `${box.height}px`;
  pill.style.transform = `translate3d(${box.x}px, ${box.y}px, 0)`;
  pill.style.opacity = "1";
}

export function useSlidingPill<K extends string>(
  activeKey: K | null,
  options?: UseSlidingPillOptions<K>,
) {
  const enabled = options?.enabled ?? true;
  const initialKey = options?.initialKey ?? null;
  const trackRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const buttonsRef = useRef(new Map<K, HTMLButtonElement>());
  const refCallbacksRef = useRef(new Map<K, (node: HTMLButtonElement | null) => void>());
  const activeKeyRef = useRef(activeKey);
  const currentBoxRef = useRef<PillBox | null>(null);
  const animRef = useRef<Animation | null>(null);
  const initializedRef = useRef(false);
  const [ready, setReady] = useState(false);

  activeKeyRef.current = activeKey;

  const cancelAnimation = useCallback(() => {
    if (animRef.current) {
      animRef.current.cancel();
      animRef.current = null;
    }
  }, []);

  const syncPill = useCallback((animate: boolean, overrideStartKey?: K | null) => {
    const track = trackRef.current;
    const pill = pillRef.current;
    if (!track || !pill) {
      return;
    }

    const key = activeKeyRef.current;
    const activeButton = key !== null ? (buttonsRef.current.get(key) ?? null) : null;
    const nextBox = activeButton ? measureButtonBox(activeButton, track) : null;
    const trackRect = track.getBoundingClientRect();
    if (trackRect.width > 0 && trackRect.height > 0) {
      setReady((current) => (current ? current : true));
    }

    let startBox = currentBoxRef.current;
    if (overrideStartKey !== undefined && overrideStartKey !== null && overrideStartKey !== key) {
      const startButton = buttonsRef.current.get(overrideStartKey) ?? null;
      const measuredStart = startButton ? measureButtonBox(startButton, track) : null;
      if (measuredStart) {
        startBox = measuredStart;
      }
    }

    if (animRef.current) {
      const liveBox = measureLivePillBox(pill, track);
      if (liveBox) {
        startBox = liveBox;
      }
      animRef.current.cancel();
      animRef.current = null;
    }

    if (!nextBox) {
      applyPillBox(pill, startBox);
      pill.style.opacity = "0";
      currentBoxRef.current = null;
      if (animate && startBox && !prefersReducedMotion() && typeof pill.animate === "function") {
        const duration = isDesktopViewport() ? 170 : 250;
        const easing = getCssEasing("--ease-in-out", "cubic-bezier(0.77, 0, 0.175, 1)");
        const anim = pill.animate(
          [
            {
              opacity: 1,
              transform: `translate3d(${startBox.x}px, ${startBox.y}px, 0) scale(1)`,
            },
            {
              opacity: 0,
              transform: `translate3d(${startBox.x}px, ${startBox.y}px, 0) scale(0.92)`,
            },
          ],
          { duration, easing },
        );
        animRef.current = anim;
        void anim.finished
          .catch(() => {})
          .finally(() => {
            if (animRef.current === anim) {
              animRef.current = null;
            }
          });
      }
      return;
    }

    applyPillBox(pill, nextBox);
    currentBoxRef.current = nextBox;

    if (!animate || prefersReducedMotion() || typeof pill.animate !== "function") {
      return;
    }

    const duration = isDesktopViewport() ? 170 : 250;
    const easing = getCssEasing("--ease-in-out", "cubic-bezier(0.77, 0, 0.175, 1)");

    if (!startBox) {
      const anim = pill.animate(
        [
          {
            opacity: 0,
            transform: `translate3d(${nextBox.x}px, ${nextBox.y}px, 0) scale(0.92)`,
          },
          {
            opacity: 1,
            transform: `translate3d(${nextBox.x}px, ${nextBox.y}px, 0) scale(1)`,
          },
        ],
        { duration, easing },
      );
      animRef.current = anim;
      void anim.finished
        .catch(() => {})
        .finally(() => {
          if (animRef.current === anim) {
            animRef.current = null;
          }
        });
      return;
    }

    if (
      Math.abs(startBox.x - nextBox.x) < 0.5 &&
      Math.abs(startBox.y - nextBox.y) < 0.5 &&
      Math.abs(startBox.width - nextBox.width) < 0.5 &&
      Math.abs(startBox.height - nextBox.height) < 0.5
    ) {
      return;
    }

    const sameRow =
      Math.abs(nextBox.y - startBox.y) <= Math.max(startBox.height, nextBox.height) * 0.5;
    let midLeft: number;
    let midWidth: number;
    if (sameRow) {
      const movingRight = nextBox.x >= startBox.x;
      const startRight = startBox.x + startBox.width;
      const nextRight = nextBox.x + nextBox.width;
      const midRight = movingRight
        ? lerp(startRight, nextRight, 0.82)
        : lerp(startRight, nextRight, 0.22);
      midLeft = movingRight ? lerp(startBox.x, nextBox.x, 0.22) : lerp(startBox.x, nextBox.x, 0.82);
      midWidth = Math.max(8, midRight - midLeft);
    } else {
      midLeft = lerp(startBox.x, nextBox.x, 0.5);
      midWidth = lerp(startBox.width, nextBox.width, 0.5);
    }
    const midY = lerp(startBox.y, nextBox.y, 0.5);
    const midHeight = lerp(startBox.height, nextBox.height, 0.5);

    const anim = pill.animate(
      [
        {
          width: `${startBox.width}px`,
          height: `${startBox.height}px`,
          transform: `translate3d(${startBox.x}px, ${startBox.y}px, 0) scaleY(1)`,
        },
        {
          offset: 0.42,
          width: `${midWidth}px`,
          height: `${midHeight}px`,
          transform: `translate3d(${midLeft}px, ${midY}px, 0) scaleY(0.85)`,
        },
        {
          width: `${nextBox.width}px`,
          height: `${nextBox.height}px`,
          transform: `translate3d(${nextBox.x}px, ${nextBox.y}px, 0) scaleY(1)`,
        },
      ],
      { duration, easing },
    );
    animRef.current = anim;
    void anim.finished
      .catch(() => {})
      .finally(() => {
        if (animRef.current === anim) {
          animRef.current = null;
        }
      });
  }, []);

  useLayoutEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      const shouldAnimateInitial = enabled && initialKey !== null && initialKey !== activeKey;
      syncPill(shouldAnimateInitial, shouldAnimateInitial ? initialKey : undefined);
      return;
    }
    syncPill(enabled);
  }, [activeKey, enabled, initialKey, syncPill]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || typeof ResizeObserver !== "function") {
      return cancelAnimation;
    }
    const observer = new ResizeObserver(() => {
      syncPill(false);
    });
    observer.observe(track);
    for (const button of buttonsRef.current.values()) {
      observer.observe(button);
    }
    return () => {
      observer.disconnect();
      cancelAnimation();
    };
  }, [cancelAnimation, syncPill]);

  const registerButton = useCallback((key: K) => {
    let callback = refCallbacksRef.current.get(key);
    if (!callback) {
      callback = (node: HTMLButtonElement | null) => {
        if (node) {
          buttonsRef.current.set(key, node);
        } else {
          buttonsRef.current.delete(key);
        }
      };
      refCallbacksRef.current.set(key, callback);
    }
    return callback;
  }, []);

  return { trackRef, pillRef, registerButton, ready };
}
