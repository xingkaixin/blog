import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Cross2Icon } from "@radix-ui/react-icons";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

type DialogContentProps = ComponentProps<typeof DialogPrimitive.Content> & {
  hideClose?: boolean;
};

export function DialogContent({ className, children, hideClose, ...props }: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-ink-800/30 backdrop-blur-sm" />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 max-h-[min(88dvh,780px)] w-[min(92vw,840px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain rounded-[2rem] border border-white/20 bg-surface/90 p-5 shadow-[0_30px_80px_-42px_rgba(31,24,18,0.7),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-xl",
          className
        )}
        {...props}
      >
        {children}
        {!hideClose && (
          <DialogPrimitive.Close
            aria-label="关闭搜索面板"
            className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-ink-800/10 bg-white/75 text-ink-500 transition-colors hover:text-ink-800"
          >
            <Cross2Icon aria-hidden="true" className="h-4 w-4" />
            <span className="sr-only">关闭</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
