#!/usr/bin/env bun

import {
  PHOTO_CATALOG_INDEX_SCHEMA_VERSION,
  catalogIndexUrl,
  parsePhotoCatalogIndex,
  type PhotoCatalogIndex,
} from "../src/lib/photo-catalog";
import { siteConfig } from "../src/lib/site";

export type PhotoCatalogLoader = (url: string) => Promise<unknown>;

const MAX_COMPACT_CATALOG_BYTES = 256 * 1024;

export async function verifyPublishedPhotoCatalog(
  photoBaseUrl = process.env.PUBLIC_PHOTO_BASE_URL?.trim() || siteConfig.photoUrl,
  load: PhotoCatalogLoader = loadJson,
): Promise<PhotoCatalogIndex> {
  const value = await load(catalogIndexUrl(photoBaseUrl));
  const catalog = parsePhotoCatalogIndex(value);
  const publishedVersion = Reflect.get(value as object, "schemaVersion");
  if (publishedVersion !== PHOTO_CATALOG_INDEX_SCHEMA_VERSION) {
    throw new Error(
      `照片 Catalog 仍是 schema v${String(publishedVersion)}，请先运行 bun run photos:migrate -- --confirm`,
    );
  }
  const compactBytes = new TextEncoder().encode(JSON.stringify(value)).byteLength;
  if (compactBytes > MAX_COMPACT_CATALOG_BYTES) {
    throw new Error(
      `照片 Catalog 索引为 ${compactBytes.toLocaleString("en-US")} 字节，超过 ${MAX_COMPACT_CATALOG_BYTES.toLocaleString("en-US")} 字节预算；请先拆分照片定位表`,
    );
  }
  return catalog;
}

async function loadJson(url: string): Promise<unknown> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`无法读取照片 Catalog (${response.status})`);
  }
  return response.json();
}

if (import.meta.main) {
  verifyPublishedPhotoCatalog()
    .then((catalog) => {
      console.log(`✅ 照片 Catalog schema v${catalog.schemaVersion} 可部署`);
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
