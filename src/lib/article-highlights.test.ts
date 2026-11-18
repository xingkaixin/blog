// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from "vitest";
import {
  addHighlight,
  clearAllHighlightMarks,
  createHighlightDraftFromRange,
  findHighlightRange,
  HIGHLIGHT_ATTR,
  readHighlights,
  removeHighlights,
  syncHighlightsInScope,
} from "./article-highlights";

describe("article highlights", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = "";
  });

  it("matches exact context anchors even when phrases repeat", () => {
    const fullText = "Alpha note repeats. Alpha target phrase here. Alpha note repeats again.";
    const span = findHighlightRange(fullText, {
      text: "Alpha note",
      prefix: "here. ",
      suffix: " repeats again",
    });

    expect(span).toEqual({ start: 46, end: 56 });
  });

  it("captures selections across inline elements, persists them, and unwraps cleanly", () => {
    const scope = document.createElement("article");
    scope.innerHTML = "<p>Read <code>agent harness</code> notes carefully every day.</p>";
    document.body.appendChild(scope);

    const p = scope.querySelector("p")!;
    const firstText = p.firstChild as Text;
    const codeText = p.querySelector("code")!.firstChild as Text;
    const range = document.createRange();
    range.setStart(firstText, 1);
    range.setEnd(codeText, 5);

    const draft = createHighlightDraftFromRange(scope, range);
    expect(draft).not.toBeNull();
    expect(draft?.text).toBe("ead agent");

    const saved = addHighlight("/posts/demo/", draft!);
    expect(readHighlights("/posts/demo")).toHaveLength(1);

    const applied = syncHighlightsInScope(scope, "/posts/demo/");
    expect(applied.map((item) => item.id)).toEqual([saved.id]);

    const marks = scope.querySelectorAll(`mark[${HIGHLIGHT_ATTR}="${saved.id}"]`);
    expect(marks).toHaveLength(2);
    expect([...marks].map((m) => m.textContent).join("")).toBe("ead agent");

    removeHighlights("/posts/demo/", [saved.id]);
    expect(syncHighlightsInScope(scope, "/posts/demo/")).toEqual([]);
    expect(scope.innerHTML).toBe(
      "<p>Read <code>agent harness</code> notes carefully every day.</p>",
    );
  });

  it("supports multiple highlights inside the same paragraph cleanly", () => {
    const scope = document.createElement("article");
    scope.innerHTML = "<p>First important phrase and second key phrase in one paragraph.</p>";
    document.body.appendChild(scope);

    const textNode = scope.querySelector("p")!.firstChild as Text;
    const rangeOne = document.createRange();
    rangeOne.setStart(textNode, 0);
    rangeOne.setEnd(textNode, 15);
    const rangeTwo = document.createRange();
    rangeTwo.setStart(textNode, 27);
    rangeTwo.setEnd(textNode, 44);

    addHighlight("/posts/multi/", createHighlightDraftFromRange(scope, rangeOne)!);
    addHighlight("/posts/multi/", createHighlightDraftFromRange(scope, rangeTwo)!);

    const applied = syncHighlightsInScope(scope, "/posts/multi/");
    expect(applied).toHaveLength(2);
    expect(applied.map((item) => item.text)).toEqual(["First important", "second key phrase"]);

    clearAllHighlightMarks(scope);
    expect(scope.querySelectorAll(`mark[${HIGHLIGHT_ATTR}]`)).toHaveLength(0);
  });
});
