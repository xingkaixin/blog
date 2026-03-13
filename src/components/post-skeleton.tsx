export function PostSkeleton() {
  return (
    <div className="grid gap-6" aria-hidden="true">
      {Array.from({ length: 2 }).map((_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-[2rem] border border-white/25 bg-white/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]"
        >
          <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="soft-shimmer h-64 w-full sm:h-72" />
            <div className="space-y-4 p-6 sm:p-8">
              <div className="soft-shimmer h-4 w-40 rounded-full" />
              <div className="soft-shimmer h-10 w-3/4 rounded-full" />
              <div className="soft-shimmer h-4 w-full rounded-full" />
              <div className="soft-shimmer h-4 w-5/6 rounded-full" />
              <div className="flex gap-2 pt-4">
                <div className="soft-shimmer h-8 w-20 rounded-full" />
                <div className="soft-shimmer h-8 w-24 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
