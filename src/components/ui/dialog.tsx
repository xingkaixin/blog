import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;

type DialogContentProps = ComponentProps<typeof DialogPrimitive.Popup> & {
  title?: string;
  description?: string;
  backdropClassName?: string;
};

export function DialogContent({
  className,
  children,
  title,
  description,
  backdropClassName,
  ...props
}: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop
        className={cn(
          "dialog-backdrop fixed inset-0 z-40 bg-black/40 backdrop-blur-sm",
          backdropClassName,
        )}
      />
      <DialogPrimitive.Popup
        className={cn(
          "dialog-popup fixed left-1/2 top-1/2 z-50 max-h-[min(88dvh,780px)] w-[min(92vw,840px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain rounded-[14px] border border-line bg-surface p-5 shadow-[0_30px_80px_-42px_rgba(0,0,0,0.5)]",
          className,
        )}
        {...props}
      >
        {title && <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>}
        {description && (
          <DialogPrimitive.Description className="sr-only">
            {description}
          </DialogPrimitive.Description>
        )}
        {children}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}
