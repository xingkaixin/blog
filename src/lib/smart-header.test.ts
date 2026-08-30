// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { attachSmartHeader, computeSmartHeaderState } from "./smart-header";

describe("computeSmartHeaderState", () => {
  it("returns pinned when scrollY is below or equal to threshold", () => {
    const state = computeSmartHeaderState({
      currentY: 150,
      lastY: 100,
      threshold: 200,
      currentState: "pinned",
    });
    expect(state).toBe("pinned");
  });

  it("returns hidden when scrolling down past threshold by more than tolerance", () => {
    const state = computeSmartHeaderState({
      currentY: 300,
      lastY: 280,
      threshold: 200,
      tolerance: 8,
      currentState: "pinned",
    });
    expect(state).toBe("hidden");
  });

  it("returns revealed when scrolling up past threshold by more than tolerance", () => {
    const state = computeSmartHeaderState({
      currentY: 280,
      lastY: 300,
      threshold: 200,
      tolerance: 8,
      currentState: "hidden",
    });
    expect(state).toBe("revealed");
  });

  it("preserves previous state when scroll delta is within tolerance", () => {
    const state = computeSmartHeaderState({
      currentY: 304,
      lastY: 300,
      threshold: 200,
      tolerance: 8,
      currentState: "revealed",
    });
    expect(state).toBe("revealed");
  });

  it("returns pinned when forceVisible is true even past threshold", () => {
    const state = computeSmartHeaderState({
      currentY: 500,
      lastY: 400,
      threshold: 200,
      currentState: "hidden",
      forceVisible: true,
    });
    expect(state).toBe("pinned");
  });

  it("returns pinned when scrolling back to top below threshold", () => {
    const state = computeSmartHeaderState({
      currentY: 100,
      lastY: 300,
      threshold: 200,
      currentState: "revealed",
    });
    expect(state).toBe("pinned");
  });
});

describe("attachSmartHeader", () => {
  let header: HTMLElement;

  beforeEach(() => {
    Object.defineProperty(window, "scrollY", { value: 0, writable: true });
    header = document.createElement("header");
    document.body.appendChild(header);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 1;
    });
  });

  afterEach(() => {
    header.remove();
    vi.restoreAllMocks();
  });

  it("initializes header dataset and cleans up on destroy", () => {
    const controller = attachSmartHeader({
      header,
      defaultThreshold: 200,
    });

    expect(header.dataset.headerState).toBe("pinned");

    controller.destroy();
    expect(header.dataset.headerState).toBeUndefined();
  });

  it("updates header state on scroll", () => {
    const controller = attachSmartHeader({
      header,
      defaultThreshold: 200,
      tolerance: 5,
    });

    // Simulate scroll down
    Object.defineProperty(window, "scrollY", { value: 300, writable: true });
    window.dispatchEvent(new Event("scroll"));

    expect(header.dataset.headerState).toBe("hidden");

    // Simulate scroll up
    Object.defineProperty(window, "scrollY", { value: 280, writable: true });
    window.dispatchEvent(new Event("scroll"));

    expect(header.dataset.headerState).toBe("revealed");

    // Simulate scroll back to top
    Object.defineProperty(window, "scrollY", { value: 50, writable: true });
    window.dispatchEvent(new Event("scroll"));

    expect(header.dataset.headerState).toBe("pinned");

    controller.destroy();
  });

  it("respects dynamic thresholdTarget if provided", () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    vi.spyOn(target, "getBoundingClientRect").mockImplementation(() => {
      const scrollY = window.scrollY || 0;
      return {
        bottom: 350 - scrollY,
        top: 0 - scrollY,
        left: 0,
        right: 0,
        width: 100,
        height: 350,
        x: 0,
        y: 0 - scrollY,
        toJSON: () => {},
      };
    });

    Object.defineProperty(window, "scrollY", { value: 0, writable: true });
    const controller = attachSmartHeader({
      header,
      thresholdTarget: target,
    });

    // scrollY 250 is less than threshold 350 -> pinned
    Object.defineProperty(window, "scrollY", { value: 250, writable: true });
    window.dispatchEvent(new Event("scroll"));
    expect(header.dataset.headerState).toBe("pinned");

    // scrollY 400 is past 350 and scrolling down -> hidden
    Object.defineProperty(window, "scrollY", { value: 400, writable: true });
    window.dispatchEvent(new Event("scroll"));
    expect(header.dataset.headerState).toBe("hidden");

    target.remove();
    controller.destroy();
  });

  it("forces header to stay pinned when isLocked returns true", () => {
    let locked = true;
    const controller = attachSmartHeader({
      header,
      defaultThreshold: 200,
      isLocked: () => locked,
    });

    Object.defineProperty(window, "scrollY", { value: 500, writable: true });
    window.dispatchEvent(new Event("scroll"));
    expect(header.dataset.headerState).toBe("pinned");

    locked = false;
    // Scroll a bit further down while unlocked
    Object.defineProperty(window, "scrollY", { value: 520, writable: true });
    window.dispatchEvent(new Event("scroll"));
    expect(header.dataset.headerState).toBe("hidden");

    controller.destroy();
  });

  it("updates header state on manual update call", () => {
    const controller = attachSmartHeader({
      header,
      defaultThreshold: 200,
    });

    Object.defineProperty(window, "scrollY", { value: 300, writable: true });
    controller.update();
    expect(header.dataset.headerState).toBe("hidden");

    controller.destroy();
  });
});
