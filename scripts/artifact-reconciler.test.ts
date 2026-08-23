import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { reconcileArtifacts, type ArtifactPlan } from "./lib/artifact-reconciler";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { force: true, recursive: true });
  }
});

describe("artifact reconciliation", () => {
  it("reuses matching outputs and removes orphan artifacts", async () => {
    const root = temporaryDirectory();
    const outputDirectory = path.join(root, "output");
    const manifestFile = path.join(root, "cache", "manifest.json");
    const output = path.join(outputDirectory, "demo.webp");
    let renders = 0;
    const plans: ArtifactPlan[] = [
      {
        key: "demo",
        fingerprintParts: ["renderer", "source"],
        outputs: [output],
        generate: async () => {
          renders += 1;
          fs.writeFileSync(output, "rendered");
        },
      },
    ];

    expect(
      await reconcileArtifacts({
        outputDirectory,
        manifestFile,
        artifactExtension: ".webp",
        plans,
      }),
    ).toEqual({ generated: 1, reused: 0, removed: 0 });

    fs.writeFileSync(path.join(outputDirectory, "orphan.webp"), "orphan");
    expect(
      await reconcileArtifacts({
        outputDirectory,
        manifestFile,
        artifactExtension: ".webp",
        plans,
      }),
    ).toEqual({ generated: 0, reused: 1, removed: 1 });
    expect(renders).toBe(1);

    fs.writeFileSync(output, "corrupted");
    expect(
      await reconcileArtifacts({
        outputDirectory,
        manifestFile,
        artifactExtension: ".webp",
        plans,
      }),
    ).toEqual({ generated: 1, reused: 0, removed: 0 });
    expect(fs.readFileSync(output, "utf8")).toBe("rendered");
    expect(renders).toBe(2);

    const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
    expect(manifest.version).toBe(2);
    expect(manifest.entries.demo.outputFingerprints).toHaveLength(1);
  });
});

function temporaryDirectory(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "artifact-reconciler-test-"));
  temporaryDirectories.push(directory);
  return directory;
}
