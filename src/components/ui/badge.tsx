import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type BadgeProps = HTMLAttributes<HTMLSpanElement>;

export function Badge({ className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-ink-800/10 bg-white/70 px-3 py-1 text-[0.72rem] font-medium uppercase tracking-[0.22em] text-ink-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-sm",
        className
      )}
      {...props}
    />
  );
}
