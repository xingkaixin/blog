import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { SiteLayout } from "@/components/site-layout";

const HomePage = lazy(() => import("@/routes/home-page").then((m) => ({ default: m.HomePage })));
const PostPage = lazy(() => import("@/routes/post-page").then((m) => ({ default: m.PostPage })));
const NotFoundPage = lazy(() =>
  import("@/routes/not-found-page").then((m) => ({ default: m.NotFoundPage })),
);

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white" />
    </div>
  );
}

export default function App() {
  return (
    <SiteLayout>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/posts/:slug" element={<PostPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </SiteLayout>
  );
}
