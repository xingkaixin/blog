import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type BadgeProps = HTMLAttributes<HTMLSpanElement>;

export function Badge({ className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[5px] border border-line bg-surface px-2 py-1 font-mono text-[0.65rem] tracking-[0.06em] text-ink-500",
        className,
      )}
      {...props}
    />
  );
}
