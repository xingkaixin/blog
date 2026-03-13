import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <section className="px-4 py-24 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-4xl rounded-[2.6rem] border border-white/20 bg-white/70 p-8 text-center shadow-[0_28px_80px_-48px_rgba(31,24,18,0.6),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-xl sm:p-14">
        <p className="text-xs uppercase tracking-[0.32em] text-ink-400">404</p>
        <h1 className="mt-4 text-5xl tracking-[-0.06em] text-balance text-ink-800">这篇内容暂时不在这里。</h1>
        <p className="mx-auto mt-4 max-w-[40ch] text-base leading-8 text-ink-600">
          可能是链接过期，也可能是文章还没整理完。先回到首页，从封面和标签重新开始找。
        </p>
        <Link to="/" className="mt-8 inline-block">
          <Button size="lg">返回首页</Button>
        </Link>
      </div>
    </section>
  );
}
