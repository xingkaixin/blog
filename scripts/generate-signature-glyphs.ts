#!/usr/bin/env bun

import fs from "node:fs";
import path from "node:path";
import { siteConfig } from "../src/lib/site";

const ROOT = process.cwd();
const SOURCE_FILE = path.join(ROOT, "scripts", "assets", "dancing-script-glyph-data.json");
const OUTPUT_FILE = path.join(ROOT, "src", "lib", "dancing-script-glyph-data.json");
const GRAPHEME_SEGMENTER = new Intl.Segmenter("zh-CN", { granularity: "grapheme" });

export function signatureCharacters(text: string) {
  const characters = Array.from(GRAPHEME_SEGMENTER.segment(text), ({ segment }) => segment);
  return [...new Set(characters.filter((character) => !/\s/u.test(character)))];
}

export function selectSignatureGlyphs(glyphs: Record<string, unknown>, text: string) {
  const characters = signatureCharacters(text);
  const missingCharacters = characters.filter((character) => !(character in glyphs));

  if (missingCharacters.length > 0) {
    throw new Error(`Missing signature glyphs: ${missingCharacters.join(", ")}`);
  }

  return Object.fromEntries(characters.map((character) => [character, glyphs[character]]));
}

function main() {
  const glyphs = JSON.parse(fs.readFileSync(SOURCE_FILE, "utf8")) as Record<string, unknown>;
  const subset = selectSignatureGlyphs(glyphs, siteConfig.author);
  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(subset)}\n`, "utf8");
  console.log(`✅ 生成 ${Object.keys(subset).length} 个签名字形: ${OUTPUT_FILE}`);
}

if (import.meta.main) {
  main();
}
