// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { installSiteShortcuts } from "./site-shortcuts";

let uninstall: () => void;

beforeEach(() => {
  uninstall = installSiteShortcuts(window);
});
afterEach(() => {
  uninstall();
  document.body.replaceChildren();
});

describe("site shortcuts", () => {
  it.each(["input", "textarea", "select", "div"])("does not intercept typing in %s", (tag) => {
    const element = document.createElement(tag);
    element.contentEditable = "true";
    document.body.append(element);
    const event = new KeyboardEvent("keydown", { key: "/", bubbles: true, cancelable: true });
    element.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
});
