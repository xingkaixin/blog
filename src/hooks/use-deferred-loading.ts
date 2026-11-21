import { useEffect, useRef, useState } from "react";

const SHOW_DELAY_MS = 300;
const MIN_VISIBLE_MS = 500;

export function useDeferredLoading(
  loading: boolean,
  options: { delayMs?: number; minVisibleMs?: number } = {},
): boolean {
  const { delayMs = SHOW_DELAY_MS, minVisibleMs = MIN_VISIBLE_MS } = options;
  const [visible, setVisible] = useState(false);
  const shownAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (loading) {
      if (visible) {
        return undefined;
      }
      const timer = window.setTimeout(() => {
        shownAtRef.current = Date.now();
        setVisible(true);
      }, delayMs);
      return () => window.clearTimeout(timer);
    }

    if (!visible) {
      shownAtRef.current = null;
      return undefined;
    }

    const elapsed = shownAtRef.current === null ? minVisibleMs : Date.now() - shownAtRef.current;
    const remaining = Math.max(0, minVisibleMs - elapsed);
    const timer = window.setTimeout(() => {
      shownAtRef.current = null;
      setVisible(false);
    }, remaining);
    return () => window.clearTimeout(timer);
  }, [delayMs, loading, minVisibleMs, visible]);

  return visible;
}
