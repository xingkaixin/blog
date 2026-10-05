#!/usr/bin/env bun

import fs from "node:fs/promises";
import path from "node:path";
import config from "../cloudflare.config";

const output = path.resolve(".cloudflare/output/v0");
const workerDirectory = path.join(output, "workers/default");
const { worker, ...settings } = config;
const { entrypoint, ...workerConfig } = worker;

await fs.rm(output, { recursive: true, force: true });
const result = await Bun.build({
  entrypoints: [entrypoint],
  outdir: path.join(workerDirectory, "bundle"),
  naming: "index.js",
  target: "browser",
  format: "esm",
  minify: true,
});
if (!result.success) {
  throw new AggregateError(result.logs, "Worker 构建失败");
}

await fs.cp("dist", path.join(workerDirectory, "assets"), { recursive: true });
await fs.writeFile(
  path.join(workerDirectory, "worker.config.json"),
  JSON.stringify({
    ...workerConfig,
    manifest: {
      type: "complete",
      mainModule: "index.js",
      modules: { "index.js": { type: "esm" } },
    },
  }),
);
await fs.writeFile(
  path.join(output, "config.json"),
  JSON.stringify({ ...settings, buildContext: { isPreview: false } }),
);
console.log("✅ 生成 Workers 部署产物（cf deploy --prebuilt）");
