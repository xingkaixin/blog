#!/usr/bin/env bun

import fs from "node:fs";
import path from "node:path";
import { siteConfig } from "../src/lib/site";

export function validateDeploymentConfig(
  rootDirectory = process.cwd(),
  photoBaseUrl = process.env.PUBLIC_PHOTO_BASE_URL?.trim() || siteConfig.photoUrl,
): void {
  const siteOrigin = new URL(siteConfig.url).origin;
  const headers = fs.readFileSync(path.join(rootDirectory, "public", "_headers"), "utf8");
  const cors = JSON.parse(
    fs.readFileSync(path.join(rootDirectory, "config", "photo-r2-cors.json"), "utf8"),
  ) as { rules?: Array<{ allowed?: { origins?: string[] } }> };

  if (!cors.rules?.some((rule) => rule.allowed?.origins?.includes(siteOrigin))) {
    throw new Error(`R2 CORS must allow ${siteOrigin}`);
  }

  if (photoBaseUrl.startsWith("/")) {
    return;
  }
  const photoOrigin = new URL(photoBaseUrl).origin;
  const csp = headers.split("\n").find((line) => line.includes("Content-Security-Policy:")) ?? "";
  for (const directive of ["connect-src", "img-src"]) {
    const value = csp.split(`${directive} `)[1]?.split(";")[0] ?? "";
    if (!value.split(/\s+/).includes(photoOrigin)) {
      throw new Error(`Content-Security-Policy ${directive} must allow ${photoOrigin}`);
    }
  }
}

if (import.meta.main) {
  validateDeploymentConfig();
  console.log("✅ 部署域名配置一致");
}
