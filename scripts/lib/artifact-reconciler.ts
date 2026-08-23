import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { mapWithConcurrency } from "./concurrency";

const MANIFEST_VERSION = 2;

type ArtifactManifestEntry = {
  fingerprint: string;
  outputFingerprints: string[];
};

type ArtifactManifest = {
  version: typeof MANIFEST_VERSION;
  entries: Record<string, ArtifactManifestEntry>;
};

export type ArtifactPlan = {
  key: string;
  fingerprintParts: Array<string | Buffer>;
  outputs: string[];
  generate(): Promise<void>;
};

export type ReconcileArtifactsOptions = {
  outputDirectory: string;
  manifestFile: string;
  artifactExtension: `.${string}`;
  plans: ArtifactPlan[];
  recursive?: boolean;
  concurrency?: number;
};

export type ReconcileArtifactsResult = {
  generated: number;
  reused: number;
  removed: number;
};

export async function reconcileArtifacts(
  options: ReconcileArtifactsOptions,
): Promise<ReconcileArtifactsResult> {
  if (options.plans.length === 0) {
    throw new Error("生成计划至少需要一个产物");
  }

  fs.mkdirSync(options.outputDirectory, { recursive: true });
  const manifest = readManifest(options.manifestFile);
  const nextManifest: ArtifactManifest = { version: MANIFEST_VERSION, entries: {} };
  const expectedOutputs = validatePlans(options.outputDirectory, options.plans);

  const states = await mapWithConcurrency(
    options.plans,
    options.concurrency ?? 1,
    async (plan): Promise<"generated" | "reused"> => {
      const currentFingerprint = fingerprint(plan.fingerprintParts);
      const currentEntry = manifest.entries[plan.key];
      if (
        currentEntry?.fingerprint === currentFingerprint &&
        currentEntry.outputFingerprints.length === plan.outputs.length &&
        plan.outputs.every(
          (output, index) =>
            fs.existsSync(output) &&
            fingerprint([fs.readFileSync(output)]) === currentEntry.outputFingerprints[index],
        )
      ) {
        nextManifest.entries[plan.key] = currentEntry;
        return "reused";
      }

      await plan.generate();
      nextManifest.entries[plan.key] = {
        fingerprint: currentFingerprint,
        outputFingerprints: plan.outputs.map((output) => {
          if (!fs.existsSync(output)) {
            throw new Error(`生成计划未写入声明的输出: ${output}`);
          }
          return fingerprint([fs.readFileSync(output)]);
        }),
      };
      return "generated";
    },
  );

  const removed = removeUnexpectedArtifacts(
    options.outputDirectory,
    expectedOutputs,
    options.artifactExtension,
    options.recursive ?? false,
  );
  writeManifest(options.manifestFile, nextManifest);
  return {
    generated: states.filter((state) => state === "generated").length,
    reused: states.filter((state) => state === "reused").length,
    removed,
  };
}

export function fingerprint(parts: Array<string | Buffer>): string {
  const hash = createHash("sha256");
  for (const part of parts) {
    hash.update(part);
  }
  return hash.digest("hex");
}

function validatePlans(outputDirectory: string, plans: ArtifactPlan[]): Set<string> {
  const root = path.resolve(outputDirectory);
  const keys = new Set<string>();
  const outputs = new Set<string>();

  for (const plan of plans) {
    if (!plan.key || keys.has(plan.key)) {
      throw new Error(`生成计划 key 必须唯一: ${plan.key}`);
    }
    keys.add(plan.key);
    if (plan.outputs.length === 0) {
      throw new Error(`生成计划必须声明输出: ${plan.key}`);
    }

    for (const output of plan.outputs) {
      const resolved = path.resolve(output);
      const relative = path.relative(root, resolved);
      if (relative.startsWith("..") || path.isAbsolute(relative)) {
        throw new Error(`生成输出超出目标目录: ${output}`);
      }
      if (outputs.has(resolved)) {
        throw new Error(`生成输出必须唯一: ${output}`);
      }
      outputs.add(resolved);
    }
  }
  return outputs;
}

function removeUnexpectedArtifacts(
  directory: string,
  expected: Set<string>,
  extension: string,
  recursive: boolean,
): number {
  let removed = 0;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!recursive) {
        throw new Error(`生成目录包含嵌套目录: ${entryPath}`);
      }
      removed += removeUnexpectedArtifacts(entryPath, expected, extension, recursive);
      if (fs.readdirSync(entryPath).length === 0) {
        fs.rmdirSync(entryPath);
      }
      continue;
    }
    if (!entry.isFile()) {
      throw new Error(`生成目录包含非文件条目: ${entryPath}`);
    }
    if (
      entry.name === ".DS_Store" ||
      (entry.name.endsWith(extension) && !expected.has(path.resolve(entryPath)))
    ) {
      fs.rmSync(entryPath);
      removed += 1;
      continue;
    }
    if (!entry.name.endsWith(extension)) {
      throw new Error(`生成目录包含非生成文件: ${entryPath}`);
    }
  }
  return removed;
}

function readManifest(file: string): ArtifactManifest {
  try {
    const value = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<ArtifactManifest>;
    if (value.version === MANIFEST_VERSION && isManifestEntries(value.entries)) {
      return value as ArtifactManifest;
    }
  } catch {
    return emptyManifest();
  }
  return emptyManifest();
}

function emptyManifest(): ArtifactManifest {
  return { version: MANIFEST_VERSION, entries: {} };
}

function isManifestEntries(value: unknown): value is Record<string, ArtifactManifestEntry> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every(isManifestEntry)
  );
}

function isManifestEntry(value: unknown): value is ArtifactManifestEntry {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const entry = value as Partial<ArtifactManifestEntry>;
  return (
    typeof entry.fingerprint === "string" &&
    Array.isArray(entry.outputFingerprints) &&
    entry.outputFingerprints.every((outputFingerprint) => typeof outputFingerprint === "string")
  );
}

function writeManifest(file: string, manifest: ArtifactManifest): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = path.join(path.dirname(file), `.${path.basename(file)}.${randomUUID()}.tmp`);
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    fs.renameSync(temporary, file);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}
