// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from "vitest";
import {
  addHighlight,
  clearAllHighlightMarks,
  createHighlightDraftFromRange,
  findHighlightRange,
  findHighlightIdsInRange,
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

  it("keeps both occurrences of a phrase with identical surrounding text", () => {
    const scope = document.createElement("article");
    const paragraph = "a".repeat(24) + "访问时间" + "b".repeat(24);
    scope.innerHTML = `<p>${paragraph}</p><p>${paragraph}</p>`;
    document.body.append(scope);
    for (const p of scope.querySelectorAll("p")) {
      const range = document.createRange();
      range.setStart(p.firstChild!, 24);
      range.setEnd(p.firstChild!, 28);
      addHighlight("/repeat", createHighlightDraftFromRange(scope, range)!);
    }
    expect(syncHighlightsInScope(scope, "/repeat")).toHaveLength(2);
    expect([...scope.children].map((p) => p.querySelector("mark")?.textContent)).toEqual([
      "访问时间",
      "访问时间",
    ]);
  });

  it("requires a shared character before removing a neighboring highlight", () => {
    const scope = document.createElement("article");
    scope.innerHTML = `before<mark ${HIGHLIGHT_ATTR}="saved">word</mark>after`;
    document.body.append(scope);
    const marked = scope.querySelector("mark")!.firstChild!;
    const range = document.createRange();
    range.setStart(marked, 4);
    range.setEnd(scope.lastChild!, 3);
    expect(findHighlightIdsInRange(scope, range)).toEqual([]);
    range.setStart(marked, 3);
    expect(findHighlightIdsInRange(scope, range)).toEqual(["saved"]);
    range.setStart(scope.firstChild!, 2);
    range.setEnd(marked, 0);
    expect(findHighlightIdsInRange(scope, range)).toEqual([]);
  });
});
