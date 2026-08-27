#!/usr/bin/env bun

import {
  PHOTO_CATALOG_INDEX_SCHEMA_VERSION,
  catalogIndexUrl,
  parsePhotoCatalogIndexWithVersion,
  parsePhotoMonthCatalog,
  photoObjectUrl,
  type PhotoCatalogIndex,
  validatePhotoMonth,
} from "../src/lib/photo-catalog";
import { siteConfig } from "../src/lib/site";
import { mapWithConcurrency } from "./lib/concurrency";
import { PHOTO_CATALOG_CONTROL_KEY } from "./lib/photo-catalog-control";

export type PhotoCatalogLoader = (url: string) => Promise<unknown>;

const MAX_COMPACT_CATALOG_BYTES = 256 * 1024;
const SHARD_READ_CONCURRENCY = 8;

export async function verifyPhotoControlPrivacy(
  photoBaseUrl: string,
  request: (url: string, options: RequestInit) => Promise<Response> = fetch,
): Promise<void> {
  const response = await request(photoObjectUrl(photoBaseUrl, PHOTO_CATALOG_CONTROL_KEY), {
    method: "HEAD",
    cache: "no-store",
    redirect: "error",
  });
  if (response.status !== 403 && response.status !== 404) {
    throw new Error(
      `后台控制文档必须不可公开访问，当前响应 ${response.status}；请完成私有存储迁移`,
    );
  }
}

export async function verifyPublishedPhotoCatalog(
  photoBaseUrl = process.env.PUBLIC_PHOTO_BASE_URL?.trim() || siteConfig.photoUrl,
  load: PhotoCatalogLoader = loadJson,
): Promise<PhotoCatalogIndex> {
  const value = await load(catalogIndexUrl(photoBaseUrl));
  const { index: catalog, sourceVersion } = parsePhotoCatalogIndexWithVersion(value);
  if (sourceVersion !== PHOTO_CATALOG_INDEX_SCHEMA_VERSION) {
    throw new Error(
      `照片 Catalog 仍是 schema v${sourceVersion}，请先运行 bun run photos:migrate -- --confirm`,
    );
  }
  const compactBytes = compactCatalogBytes(value);
  if (compactBytes > MAX_COMPACT_CATALOG_BYTES) {
    throw new Error(
      `照片 Catalog 索引为 ${compactBytes.toLocaleString("en-US")} 字节，超过 ${MAX_COMPACT_CATALOG_BYTES.toLocaleString("en-US")} 字节预算；请先拆分照片定位表`,
    );
  }
  await mapWithConcurrency(catalog.periods, SHARD_READ_CONCURRENCY, async (period) => {
    try {
      const shard = parsePhotoMonthCatalog(await load(photoObjectUrl(photoBaseUrl, period.path)));
      validatePhotoMonth(catalog, period, shard);
    } catch (error) {
      throw new Error(`照片月份 Catalog ${period.path} 验证失败`, { cause: error });
    }
  });
  return catalog;
}

function compactCatalogBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

async function loadJson(url: string): Promise<unknown> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`无法读取照片 Catalog (${response.status})`);
  }
  return response.json();
}

if (import.meta.main) {
  const photoBaseUrl = process.env.PUBLIC_PHOTO_BASE_URL?.trim() || siteConfig.photoUrl;
  console.log(`正在验证照片 Catalog: ${catalogIndexUrl(photoBaseUrl)}`);
  verifyPhotoControlPrivacy(photoBaseUrl)
    .then(() => verifyPublishedPhotoCatalog(photoBaseUrl))
    .then((catalog) => {
      const photoCount = Object.keys(catalog.photoMonths).length;
      const compactBytes = compactCatalogBytes(catalog);
      console.log(
        `✅ 照片 Catalog schema v${catalog.schemaVersion} 可部署：${photoCount.toLocaleString("zh-CN")} 张照片，主索引 ${compactBytes.toLocaleString("en-US")} 字节`,
      );
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
