import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  fingerprint,
  reconcileArtifacts,
  withArtifactDirectoryLock,
  type ArtifactPlan,
} from "./artifact-reconciler";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { force: true, recursive: true });
  }
});

describe("artifact reconciliation", () => {
  it("waits for the current build and acquires its lock after interruption", async () => {
    const root = temporaryDirectory();
    const output = path.join(root, "public", "cover");
    const module = JSON.stringify(import.meta.resolve("./artifact-reconciler.ts"));
    const holdLock = `
      import { withArtifactDirectoryLock } from ${module};
      await withArtifactDirectoryLock(process.argv[1], async () => {
        console.log("locked");
        await Bun.sleep(30_000);
      });
    `;
    const child = Bun.spawn([process.execPath, "-e", holdLock, output], {
      env: { ...process.env, TMPDIR: root },
      stdout: "pipe",
    });

    try {
      const ready = await child.stdout.getReader().read();
      expect(new TextDecoder().decode(ready.value).trim()).toBe("locked");
      const acquired = withArtifactDirectoryLock(output, async () => "acquired");
      const beforeInterrupt = await Promise.race([acquired, Bun.sleep(100).then(() => "waiting")]);
      expect(beforeInterrupt).toBe("waiting");
      child.kill("SIGINT");
      await expect(acquired).resolves.toBe("acquired");
    } finally {
      child.kill();
      await child.exited;
    }
  });

  it("reuses matching outputs and removes orphan artifacts", async () => {
    const root = temporaryDirectory();
    const outputDirectory = path.join(root, "output");
    const manifestFile = path.join(root, "cache", "manifest.json");
    const output = path.join(outputDirectory, "demo.webp");
    const plans: ArtifactPlan[] = [
      {
        key: "demo",
        fingerprint: () => fingerprint(["renderer", "source"]),
        outputs: [output],
        generate: async () => {
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
  });
});

function temporaryDirectory(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "artifact-reconciler-test-"));
  temporaryDirectories.push(directory);
  return directory;
}
