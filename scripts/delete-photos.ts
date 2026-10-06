#!/usr/bin/env bun

import { runPhotoCli } from "./lib/photo-cli";

if (import.meta.main) {
  void runPhotoCli("delete", process.argv.slice(2));
}
