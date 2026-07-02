import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-12 w-full rounded-[1.25rem] border border-line bg-surface px-4 text-sm text-ink-800 outline-none transition-[border-color,box-shadow] duration-(--duration-quick) placeholder:text-ink-400 focus:border-accent/45 focus:ring-4 focus:ring-accent/10",
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = "Input";
