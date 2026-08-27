import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { expect, it } from "vitest";
import { tagHref } from "../src/lib/post-tags";
import { siteConfig } from "../src/lib/site";
import { readPublishedPosts } from "./lib/post-catalog";

it("builds tag archives whose paths and canonical URLs match encoded links", () => {
  const project = process.cwd();
  fs.mkdirSync(path.join(project, ".astro"), { recursive: true });
  const root = fs.mkdtempSync(path.join(project, ".astro", "tag-routes-test-"));
  const tags = ["100%", "%25", "C/C++", "中文", "Claude Code", "A?#", ".", "..", "~31303025"];
  try {
    const pages = path.join(root, "src", "pages", "tags");
    fs.mkdirSync(pages, { recursive: true });
    fs.copyFileSync(
      path.join(project, "src", "pages", "tags", "[tag].astro"),
      path.join(pages, "[tag].astro"),
    );
    for (const directory of ["components", "hooks", "layouts", "lib"]) {
      fs.cpSync(path.join(project, "src", directory), path.join(root, "src", directory), {
        recursive: true,
      });
    }
    fs.copyFileSync(path.join(project, "src", "index.css"), path.join(root, "src", "index.css"));
    const post = readPublishedPosts(path.join(project, "content", "posts"))[0];
    const posts = ["one", "two"].map((slug) => ({ ...post, slug, tags }));
    const postsFile = path.join(root, "posts.ts");
    fs.writeFileSync(
      postsFile,
      `export async function getPublishedPosts() { return ${JSON.stringify(posts)}; }\nexport function toPostListItem(post) { return post; }\n`,
    );
    const config = path.join(root, "astro.config.ts");
    const directories = {
      srcDir: path.join(root, "src"),
      outDir: path.join(root, "dist"),
      cacheDir: path.join(root, "cache"),
      publicDir: path.join(root, "public"),
    };
    fs.writeFileSync(
      config,
      `import config from ${JSON.stringify(pathToFileURL(path.join(project, "astro.config.ts")).href)};\nexport default {...config, ...${JSON.stringify(directories)}, vite: {...config.vite, resolve: {alias: {"@/lib/astro-posts": ${JSON.stringify(postsFile)}, "@": ${JSON.stringify(path.join(root, "src"))}}}}};\n`,
    );
    const build = spawnSync(
      process.execPath,
      [
        path.join(project, "node_modules", ".bin", "astro"),
        "build",
        "--config",
        path.relative(project, config),
      ],
      { encoding: "utf8", timeout: 45000 },
    );
    expect(build.status, `${build.stdout}\n${build.stderr}`).toBe(0);
    for (const tag of tags) {
      const href = tagHref(tag);
      const file = path.join(root, "dist", decodeURI(href), "index.html");
      const html = fs.readFileSync(file, "utf8");
      expect(html).toContain(`rel="canonical" href="${siteConfig.url}${href}"`);
      expect(html).toContain(`TAG · ${tag} · 2`);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}, 60000);
