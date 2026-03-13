import { cn } from "@/lib/utils";

type TagFilterProps = {
  tags: string[];
  activeTag: string | null;
  onSelect: (tag: string | null) => void;
};

export function TagFilter({ tags, activeTag, onSelect }: TagFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={cn(
          "rounded-full border px-4 py-2 text-sm transition-[transform,background-color,color,border-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          activeTag === null
            ? "border-accent bg-accent text-white"
            : "border-ink-800/10 bg-white/70 text-ink-600 hover:border-accent/35 hover:text-ink-800"
        )}
      >
        全部
      </button>
      {tags.map((tag) => (
        <button
          key={tag}
          type="button"
          onClick={() => onSelect(tag)}
          className={cn(
            "rounded-full border px-4 py-2 text-sm transition-[transform,background-color,color,border-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] active:translate-y-[1px]",
            activeTag === tag
              ? "border-accent bg-accent text-white"
              : "border-ink-800/10 bg-white/70 text-ink-600 hover:border-accent/35 hover:text-ink-800"
          )}
        >
          {tag}
        </button>
      ))}
    </div>
  );
}
