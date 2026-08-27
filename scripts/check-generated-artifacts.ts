import { execFileSync } from "node:child_process";

const GENERATED_PATHS = [
  "public/search-index.json",
  "public/cover",
  "public/posts/images",
  "src/lib/generated",
];

export function checkGeneratedArtifacts(rootDirectory = process.cwd()): void {
  const changed = [
    ["diff", "--name-only"],
    ["ls-files", "--others", "--exclude-standard"],
  ]
    .map((args) =>
      execFileSync("git", [...args, "--", ...GENERATED_PATHS], {
        cwd: rootDirectory,
        encoding: "utf8",
      }).trim(),
    )
    .filter(Boolean)
    .join("\n");
  if (changed) {
    throw new Error(`生成产物尚未同步到 Git 索引，请检查并提交：\n${changed}`);
  }
}

if (import.meta.main) {
  checkGeneratedArtifacts();
  console.log("✅ 生成产物与 Git 索引一致");
}
