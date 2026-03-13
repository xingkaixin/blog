import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border text-sm font-medium transition-[transform,background-color,color,border-color,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 disabled:pointer-events-none disabled:opacity-50 active:translate-y-[1px] active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary:
          "border-accent bg-accent text-white shadow-[0_18px_40px_-28px_rgba(15,118,110,0.8)] hover:-translate-y-[2px] hover:bg-ink-800 hover:text-paper",
        secondary:
          "border-ink-800/10 bg-white/70 text-ink-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-sm hover:-translate-y-[2px] hover:border-accent/40 hover:text-ink-800",
        ghost:
          "border-transparent bg-transparent text-ink-600 hover:bg-white/65 hover:text-ink-800",
      },
      size: {
        sm: "h-9 px-4",
        md: "h-11 px-5",
        lg: "h-12 px-6",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);

Button.displayName = "Button";
