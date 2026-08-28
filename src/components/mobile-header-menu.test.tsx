// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_TOGGLE_EVENT } from "@/lib/site-events";
import { MobileHeaderMenu } from "./mobile-header-menu";

let root: Root;
let trigger: HTMLButtonElement;

beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<MobileHeaderMenu currentPath="/" />));
  trigger = container.querySelector<HTMLButtonElement>("button[aria-controls]")!;
  await act(async () => trigger.click());
});

afterEach(async () => {
  await act(async () => root.unmount());
  document.body.replaceChildren();
});

describe("mobile header menu", () => {
  it("returns focus before making a theme action inert", async () => {
    const toggleTheme = vi.fn();
    window.addEventListener(THEME_TOGGLE_EVENT, toggleTheme, { once: true });
    const themeButton = document.querySelector<HTMLButtonElement>("nav button")!;
    themeButton.focus();

    await act(async () => themeButton.click());

    expect(toggleTheme).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(trigger);
    expect(document.getElementById(trigger.getAttribute("aria-controls")!)?.inert).toBe(true);
    await act(async () => trigger.click());
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(document.querySelector("nav a"));
  });

  it("returns focus on Escape", async () => {
    await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    expect(document.activeElement).toBe(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("preserves focus already moved outside the menu", async () => {
    const outside = document.createElement("button");
    document.body.append(outside);
    outside.focus();
    await act(async () =>
      outside.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })),
    );
    expect(document.activeElement).toBe(outside);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });
});
