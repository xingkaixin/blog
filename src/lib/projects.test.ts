import { describe, expect, it } from "vitest";
import { primaryProjectUrl, projects, rankProjects } from "@/lib/projects";

describe("projects", () => {
  it("has stable unique identities and a primary destination", () => {
    expect(new Set(projects.map((project) => project.id)).size).toBe(projects.length);
    expect(primaryProjectUrl(projects.find((project) => project.id === "quotecue")!)).toBe(
      "https://quotecue.xingkaixin.me/",
    );
    expect(primaryProjectUrl(projects.find((project) => project.id === "voicen")!)).toBe(
      "https://voicen.xingkaixin.me/",
    );
  });

  it("ranks names and tags above description-only matches", () => {
    expect(rankProjects(projects, "database")).toEqual([]);
    expect(rankProjects(projects, "数据库").map((project) => project.id)).toEqual([
      "ddlbuilder",
      "db-ferry",
    ]);
    expect(rankProjects(projects, "agent dump")[0]?.id).toBe("agent-dump");
    expect(rankProjects(projects, "AI CLI").map((project) => project.id)).toEqual([
      "codesesh",
      "agent-dump",
      "skills",
    ]);
    expect(rankProjects(projects, "ＡＩ ＣＬＩ").map((project) => project.id)).toEqual([
      "codesesh",
      "agent-dump",
      "skills",
    ]);
  });
});
