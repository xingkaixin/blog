import { Route, Routes } from "react-router-dom";
import { SiteLayout } from "@/components/site-layout";
import { HomePage } from "@/routes/home-page";
import { NotFoundPage } from "@/routes/not-found-page";
import { PostPage } from "@/routes/post-page";

export default function App() {
  return (
    <SiteLayout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/posts/:slug" element={<PostPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </SiteLayout>
  );
}
