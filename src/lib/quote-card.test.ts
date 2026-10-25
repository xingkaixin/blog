import { describe, expect, it } from "vitest";
import { textFragmentUrl, wrapText } from "@/lib/quote-card";

const measure = (value: string) => value.length;
const page = "https://xingkaixin.me/posts/a/";

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
    const text = "预测-对账, 再看";
    expect(textFragmentUrl(page, [{ text, from: 0, to: text.length }])).toBe(
      `${page}#:~:text=%E9%A2%84%E6%B5%8B%2D%E5%AF%B9%E8%B4%A6%2C%20%E5%86%8D%E7%9C%8B`,
    );
  });

  it("extends a partial selection to whole words", () => {
    const text = "我们先押一个预测再对账";
    expect(decodeURIComponent(textFragmentUrl(page, [{ text, from: 6, to: 9 }]))).toBe(
      `${page}#:~:text=预测再`,
    );
  });

  it("uses a start and end term across paragraphs", () => {
    const first = "第一段的开头部分写了很多内容，一直写到这一段结束为止。";
    const last = "第二段从这里开始，选区停在中间的所有内容";
    const fragment = decodeURIComponent(
      textFragmentUrl(page, [
        { text: first, from: 4, to: first.length },
        { text: last, from: 0, to: last.indexOf("所") + 1 },
      ]),
    ).split("#:~:text=")[1];
    const [start, end] = fragment?.split(",") ?? [];
    expect(first).toContain(start);
    expect(end?.endsWith("所有")).toBe(true);
    expect(start?.length).toBeLessThan(first.length);
  });
});
