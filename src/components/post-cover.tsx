import { cn } from "@/lib/utils";

type PostCoverProps = {
  src: string;
  alt: string;
  priority?: boolean;
  className?: string;
  imageClassName?: string;
};

export function PostCover({
  src,
  alt,
  priority = false,
  className,
  imageClassName,
}: PostCoverProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[1.6rem] border border-ink-800/10",
        className
      )}
    >
      <img
        src={src}
        alt={alt}
        width={2048}
        height={1143}
        loading={priority ? undefined : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        className={cn("block aspect-[16/9] w-full object-contain", imageClassName)}
      />
    </div>
  );
}
