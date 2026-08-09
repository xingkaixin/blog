#!/usr/bin/env bun

import { runPhotoCli } from "./lib/photo-cli";

if (import.meta.main) {
  runPhotoCli("delete", process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
