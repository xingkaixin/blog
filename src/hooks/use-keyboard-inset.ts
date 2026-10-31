import { useEffect, useState } from "react";

// iOS 键盘只缩小视觉视口，fixed 元素仍贴着布局视口底部，两者的差就是被键盘盖住的高度。
export function useKeyboardInset(active: boolean): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!active || !viewport) {
      return undefined;
    }

    const update = () => {
      setInset(Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop));
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, [active]);

  return inset;
}
