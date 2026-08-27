import fs from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import type { Plugin } from "vite";
import { isPhotoArtifactKey } from "../../src/lib/photo-artifact";
import { PHOTO_CATALOG_INDEX_KEY } from "../../src/lib/photo-catalog";

export function assertPhotoDirectoryOutsidePublic(
  directory: string,
  publicDirectory: string,
): void {
  const relative = path.relative(path.resolve(publicDirectory), path.resolve(directory));
  if (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
  ) {
    throw new Error("本地照片数据不能写入公开目录 public，请使用 .photo-preview 等独立目录");
  }
}

export function assertPublicPhotoIsolation(publicDirectory: string): void {
  if (!fs.existsSync(publicDirectory)) {
    return;
  }
  const legacyPreview = path.join(publicDirectory, "photo-preview");
  if (fs.existsSync(legacyPreview)) {
    throw new Error(`公开目录包含本地照片预览，请先移出 ${legacyPreview}`);
  }
  const inspect = (directory: string) => {
    if (fs.existsSync(path.join(directory, "catalog", "control.json"))) {
      throw new Error(`公开目录包含照片后台控制文档，请先移出 ${directory}`);
    }
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        inspect(path.join(directory, entry.name));
      }
    }
  };
  inspect(publicDirectory);
}

export function photoPreviewPlugin(previewDirectory?: string): Plugin {
  return {
    name: "photo-preview-isolation",
    config(config) {
      // Vite replaces the default deny list when a custom list is supplied.
      const deny = config.server?.fs?.deny ?? [
        ".env",
        ".env.*",
        "*.{crt,pem,key,p12,pfx,cer,der}",
        ".npmrc",
        ".yarnrc.yml",
        "**/.git/**",
      ];
      return { server: { fs: { deny: [...deny, "**/catalog/control.json"] } } };
    },
    configResolved(config) {
      if (config.publicDir) {
        assertPublicPhotoIsolation(config.publicDir);
        if (previewDirectory) {
          assertPhotoDirectoryOutsidePublic(
            path.resolve(config.root, previewDirectory),
            config.publicDir,
          );
        }
      }
    },
    configureServer(server) {
      if (!previewDirectory) {
        return;
      }
      const directory = path.resolve(server.config.root, previewDirectory);
      server.middlewares.use("/__photos", (request, response) => {
        void servePreview(directory, request, response).catch((error: unknown) => {
          server.config.logger.error(`照片预览读取失败: ${String(error)}`);
          response.writeHead(500).end();
        });
      });
    },
  };
}

async function servePreview(
  directory: string,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const key = request.url?.split("?")[0].slice(1) ?? "";
  if (key !== PHOTO_CATALOG_INDEX_KEY && !isPhotoArtifactKey(key)) {
    response.writeHead(404).end();
    return;
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }
  try {
    const root = await fs.promises.realpath(directory);
    const file = path.join(root, key);
    if ((await fs.promises.realpath(file)) !== file) {
      response.writeHead(404).end();
      return;
    }
    const body = await fs.promises.readFile(file);
    response.writeHead(200, {
      "Content-Type": key.endsWith(".json") ? "application/json; charset=utf-8" : "image/webp",
      "Cache-Control": "no-store",
      "Content-Length": body.length,
    });
    response.end(request.method === "HEAD" ? undefined : body);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      response.writeHead(404).end();
      return;
    }
    throw error;
  }
}
