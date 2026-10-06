import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-[6px] border px-4 text-sm font-medium transition-[transform,background-color,color,border-color] duration-(--duration-quick) ease-(--ease-smooth-out) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97]",
  {
    variants: {
      variant: {
        secondary: "border-line bg-surface text-ink-600 hover:border-accent/40 hover:text-ink-800",
        ghost: "border-transparent bg-transparent text-ink-500 hover:bg-ink-100 hover:text-ink-800",
      },
    },
  },
);

type ButtonProps = ComponentProps<"button"> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant }), className)} {...props} />;
}
