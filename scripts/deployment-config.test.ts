import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { validateDeploymentConfig } from "./validate-deployment-config";

describe("deployment config", () => {
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
