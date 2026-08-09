#!/usr/bin/env bun

import { exiftool } from "exiftool-vendored";
import { runPhotoCli, type PhotoCliProcessor } from "./lib/photo-cli";
import { processPhotoFile } from "./lib/photo-source";

const processor: PhotoCliProcessor = {
  process: (file, id, timezone) => processPhotoFile(file, id, exiftool, timezone),
  close: () => exiftool.end(),
};

if (import.meta.main) {
  runPhotoCli("publish", process.argv.slice(2), processor).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
