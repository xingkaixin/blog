// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDeferredLoading } from "./use-deferred-loading";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let root: Root;
let container: HTMLDivElement;
let visible = false;

function Harness({ loading }: { loading: boolean }) {
  visible = useDeferredLoading(loading);
  return null;
}

beforeEach(() => {
  vi.useFakeTimers();
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  visible = false;
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe("useDeferredLoading", () => {
  it("never shows when loading finishes before the 300ms delay", async () => {
    await act(async () => root.render(<Harness loading />));
    expect(visible).toBe(false);

    await act(async () => {
      vi.advanceTimersByTime(250);
    });
    expect(visible).toBe(false);

    await act(async () => root.render(<Harness loading={false} />));
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(visible).toBe(false);
  });

  it("holds the skeleton for at least 500ms once shown", async () => {
    await act(async () => root.render(<Harness loading />));
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(visible).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(150);
    });
    await act(async () => root.render(<Harness loading={false} />));
    expect(visible).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(349);
    });
    expect(visible).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(visible).toBe(false);
  });
});
