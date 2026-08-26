import { describe, expect, it } from "vitest";
import { parseWebMcpPost, toWebMcpPost } from "./webmcp-post";

const post = {
  slug: "agent-friendly-tool",
  title: "Agent 友好的工具",
  date: "2026-08-26",
  summary: "让工具能力可以被 Agent 可靠调用。",
  tags: ["AI", "Agent"],
  cover: "agent-friendly-tool.png",
  coverAlt: "Agent 工具界面",
};

describe("WebMCP post contract", () => {
  it("serializes the fields an agent needs", () => {
    expect(toWebMcpPost(post, "# 正文\n")).toEqual({
      slug: post.slug,
      title: post.title,
      date: post.date,
      summary: post.summary,
      tags: post.tags,
      content: "# 正文\n",
    });
  });

  it("parses a generated post", () => {
    expect(
      parseWebMcpPost({
        ...post,
        content: "# 正文\n",
      }),
    ).toEqual({
      slug: post.slug,
      title: post.title,
      date: post.date,
      summary: post.summary,
      tags: post.tags,
      content: "# 正文\n",
    });
  });

  it("rejects empty content", () => {
    expect(() => toWebMcpPost(post, " \n")).toThrow("post content");
    expect(() => parseWebMcpPost({ ...post, content: "" })).toThrow("webMcpPost.content");
  });
});
