import { ArrowRightIcon } from "@radix-ui/react-icons";
import { Link } from "react-router-dom";
import { formatDisplayDate, type PostMeta } from "@/lib/content";
import { PostCover } from "@/components/post-cover";
import { Badge } from "@/components/ui/badge";

export function PostCard({ post, index }: { post: PostMeta; index: number }) {
  return (
    <Link to={`/posts/${post.slug}`} className="group block fade-in" style={{ animationDelay: `${index * 90}ms` }}>
      <article className="hover-lift flex h-full flex-col overflow-hidden rounded-[2rem] border border-[#d7cfc2] bg-[#faf7f1]/96 p-4 shadow-[0_24px_60px_-52px_rgba(31,24,18,0.3),inset_0_1px_0_rgba(255,255,255,0.88)] sm:p-5">
        <PostCover
          src={post.cover}
          alt={post.coverAlt}
          className="rounded-[1.7rem] border-[#e4dbcf] bg-[#fffdf9] p-2.5 sm:p-3"
          imageClassName="transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.02]"
        />
        <div className="flex flex-1 flex-col justify-between pt-5">
          <div>
            <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.22em] text-ink-400">
              <span>{formatDisplayDate(post.date)}</span>
            </div>
            <h3 className="mt-4 text-2xl tracking-[-0.04em] text-balance text-ink-800">{post.title}</h3>
            <p className="mt-4 text-sm leading-7 text-ink-600">
              {post.summary}
            </p>
          </div>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <Badge key={tag} className="border-[#d9d1c4] bg-white/88">{tag}</Badge>
              ))}
            </div>
            <span className="inline-flex items-center gap-2 text-sm font-medium text-ink-700">
              阅读全文
              <ArrowRightIcon
                aria-hidden="true"
                className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
              />
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
