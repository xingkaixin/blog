import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { validateDeploymentConfig } from "./validate-deployment-config";

describe("deployment config", () => {
  it.each(["photo-preview/catalog/control.json", "custom-preview/catalog/control.json"])(
    "rejects local photo control state under public/%s",
    (relative) => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), "preview-isolation-"));
      const file = path.join(root, "public", relative);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.mkdirSync(path.join(root, "config"));
      fs.copyFileSync("public/_headers", path.join(root, "public", "_headers"));
      fs.copyFileSync("config/photo-r2-cors.json", path.join(root, "config", "photo-r2-cors.json"));
      fs.writeFileSync(file, "{}");
      try {
        expect(() => validateDeploymentConfig(root)).toThrow("公开目录");
      } finally {
        fs.rmSync(root, { recursive: true });
      }
    },
  );

  it("accepts the committed site and photo origins", () => {
    expect(() => validateDeploymentConfig()).not.toThrow();
  });

  it("rejects an absolute photo origin missing from CSP", () => {
    expect(() => validateDeploymentConfig(process.cwd(), "https://media.example.com")).toThrow(
      "Content-Security-Policy",
    );
  });

  it("rejects a site origin missing from R2 CORS", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "deployment-config-"));
    fs.mkdirSync(path.join(root, "public"), { recursive: true });
    fs.mkdirSync(path.join(root, "config"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "public", "_headers"),
      "connect-src https://photos.xingkaixin.me",
    );
    fs.writeFileSync(path.join(root, "config", "photo-r2-cors.json"), '{"rules":[]}');

    try {
      expect(() => validateDeploymentConfig(root)).toThrow("R2 CORS");
    } finally {
      fs.rmSync(root, { recursive: true });
    }
  });
});
