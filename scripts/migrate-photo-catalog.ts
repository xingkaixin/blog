#!/usr/bin/env bun

import { runPhotoCli } from "./lib/photo-cli";

if (import.meta.main) {
  void runPhotoCli("migrate", process.argv.slice(2));
}
