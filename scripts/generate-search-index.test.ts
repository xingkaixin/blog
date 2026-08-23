import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { generateSearchIndex } from "./generate-search-index";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { force: true, recursive: true });
  }
});

describe("search index generator", () => {
  it("rejects nested post directories before replacing the index", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "search-index-test-"));
    temporaryDirectories.push(root);
    const postsDirectory = path.join(root, "posts");
    const outputFile = path.join(root, "search-index.json");
    fs.mkdirSync(path.join(postsDirectory, "nested"), { recursive: true });
    fs.writeFileSync(outputFile, '[{"existing":true}]', "utf8");

    expect(() => generateSearchIndex(postsDirectory, outputFile)).toThrow(
      "Only flat .md files are supported",
    );
    expect(fs.readFileSync(outputFile, "utf8")).toBe('[{"existing":true}]');
  });
});
