import type { ResponsiveCover } from "@/lib/covers";
import { cn } from "@/lib/utils";

type PostCoverProps = {
  src: string;
  alt: string;
  priority?: boolean;
  className?: string;
  imageClassName?: string;
  responsive?: ResponsiveCover | null;
};

export function PostCover({
  src,
  alt,
  priority = false,
  className,
  imageClassName,
  responsive,
}: PostCoverProps) {
  const imgClass = cn("block aspect-[16/9] w-full object-contain", imageClassName);

  const img = responsive ? (
    <picture>
      <source srcSet={responsive.mobile} media="(max-width: 639px)" type="image/webp" />
      <source srcSet={responsive.desktop} media="(max-width: 1023px)" type="image/webp" />
      <img
        src={responsive.full}
        alt={alt}
        width={2048}
        height={1143}
        loading={priority ? undefined : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        className={imgClass}
      />
    </picture>
  ) : (
    <img
      src={src}
      alt={alt}
      width={2048}
      height={1143}
      loading={priority ? undefined : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      className={imgClass}
    />
  );

  return (
    <div className={cn("overflow-hidden rounded-[1.6rem] border border-ink-800/10", className)}>
      {img}
    </div>
  );
}
