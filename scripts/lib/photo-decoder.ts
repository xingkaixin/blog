import fs from "node:fs/promises";
import path from "node:path";
import { runPhotoCommand } from "./photo-command";

const HEIC_EXTENSIONS = new Set([".heic", ".heif"]);
const HEIC_DECODE_TIMEOUT_MS = 60_000;

export function requiresPhotoDecode(file: string): boolean {
  return HEIC_EXTENSIONS.has(path.extname(file).toLowerCase());
}

export async function decodeHeicPhoto(file: string, temporaryDirectory: string): Promise<string> {
  const output = path.join(temporaryDirectory, "decoded.png");
  const attempts =
    process.platform === "darwin"
      ? [
          { command: "sips", args: ["-s", "format", "png", file, "--out", output] },
          { command: "heif-convert", args: [file, output] },
        ]
      : [{ command: "heif-convert", args: [file, output] }];
  const errors: string[] = [];

  for (const attempt of attempts) {
    try {
      await fs.rm(output, { force: true });
      await runPhotoCommand(attempt.command, attempt.args, HEIC_DECODE_TIMEOUT_MS);
      await fs.access(output);
      return output;
    } catch (error) {
      errors.push(`${attempt.command}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(`无法解码 HEIC 照片 ${file}\n${errors.join("\n")}`);
}
