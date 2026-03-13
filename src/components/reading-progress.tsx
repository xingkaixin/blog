import { useEffect, useState } from "react";

export function ReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const updateProgress = () => {
      const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
      const maxScrollable = scrollHeight - clientHeight;
      const value = maxScrollable > 0 ? (scrollTop / maxScrollable) * 100 : 0;
      setProgress(value);
    };

    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });

    return () => {
      window.removeEventListener("scroll", updateProgress);
    };
  }, []);

  return (
    <div className="sticky top-[73px] z-10 h-[2px] w-full bg-transparent">
      <div
        className="h-full bg-accent transition-[width] duration-200"
        style={{ width: `${Math.min(progress, 100)}%` }}
      />
    </div>
  );
}
