import { describe, expect, it } from "vitest";
import { textFragmentUrl, wrapText } from "@/lib/quote-card";

const measure = (value: string) => value.length;

describe("quote card", () => {
  it("breaks Chinese anywhere but keeps Latin words whole", () => {
    expect(wrapText("先押一个预测 agent 再对账", 9, measure)).toEqual([
      "先押一个预测",
      "agent 再对账",
    ]);
  });

  it("keeps closing punctuation off the start of a line", () => {
    expect(wrapText("判断力不是天赋，是肌肉。", 7, measure)).toEqual([
      "判断力不是天赋，",
      "是肌肉。",
    ]);
  });

  it("escapes text fragment delimiters in the quote", () => {
    expect(textFragmentUrl("https://xingkaixin.me/posts/a/", "预测-对账, 再看")).toBe(
      "https://xingkaixin.me/posts/a/#:~:text=%E9%A2%84%E6%B5%8B%2D%E5%AF%B9%E8%B4%A6%2C%20%E5%86%8D%E7%9C%8B",
    );
  });
});
