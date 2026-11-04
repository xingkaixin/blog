import { describe, expect, it } from "vitest";
import { primaryProjectUrl, projects } from "@/lib/projects";

describe("projects", () => {
  it("has stable unique identities and a primary destination", () => {
    expect(new Set(projects.map((project) => project.id)).size).toBe(projects.length);
    expect(primaryProjectUrl(projects.find((project) => project.id === "unquote")!)).toBe(
      "https://unquote.xingkaixin.me",
    );
    expect(primaryProjectUrl(projects.find((project) => project.id === "voicen")!)).toBe(
      "https://voicen.xingkaixin.me/",
    );
  });
});
