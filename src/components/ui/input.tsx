import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-12 w-full rounded-[1.25rem] border border-ink-800/10 bg-white/75 px-4 text-sm text-ink-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-sm outline-none transition-[border-color,box-shadow,background-color] duration-300 placeholder:text-ink-400 focus:border-accent/45 focus:ring-4 focus:ring-accent/10",
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = "Input";
