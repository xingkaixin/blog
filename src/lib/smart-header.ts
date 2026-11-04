type SmartHeaderState = "pinned" | "hidden" | "revealed";

const DEFAULT_THRESHOLD = 240;
const TOLERANCE = 8;

type ComputeStateOptions = {
  currentY: number;
  lastY: number;
  threshold: number;
  currentState: SmartHeaderState;
  forceVisible: boolean;
};

function computeSmartHeaderState({
  currentY,
  lastY,
  threshold,
  currentState,
  forceVisible,
}: ComputeStateOptions): SmartHeaderState {
  if (forceVisible || currentY <= threshold) {
    return "pinned";
  }

  const diff = currentY - lastY;

  if (diff > TOLERANCE) {
    return "hidden";
  }

  if (diff < -TOLERANCE) {
    return "revealed";
  }

  return currentState;
}

type AttachSmartHeaderOptions = {
  header: HTMLElement;
  thresholdTarget?: HTMLElement | null;
  isLocked?: () => boolean;
};

export type SmartHeaderController = {
  destroy: () => void;
};

export function attachSmartHeader({
  header,
  thresholdTarget,
  isLocked,
}: AttachSmartHeaderOptions): SmartHeaderController {
  let state: SmartHeaderState = "pinned";
  let lastY = window.scrollY;
  let rafId: number | null = null;
  let scheduled = false;

  function resolveThreshold(): number {
    if (thresholdTarget && thresholdTarget.isConnected) {
      const rect = thresholdTarget.getBoundingClientRect();
      const absoluteBottom = rect.bottom + window.scrollY;
      return Math.max(0, absoluteBottom);
    }
    return DEFAULT_THRESHOLD;
  }

  function applyState(nextState: SmartHeaderState) {
    if (state !== nextState) {
      state = nextState;
      header.dataset.headerState = nextState;
    }
  }

  function tick() {
    const currentY = Math.max(0, window.scrollY);
    const threshold = resolveThreshold();
    const locked = isLocked ? isLocked() : false;

    const nextState = computeSmartHeaderState({
      currentY,
      lastY,
      threshold,
      currentState: state,
      forceVisible: locked,
    });

    applyState(nextState);
    lastY = currentY;
  }

  function onScroll() {
    if (!scheduled) {
      scheduled = true;
      rafId = window.requestAnimationFrame(() => {
        scheduled = false;
        rafId = null;
        tick();
      });
    }
  }

  header.dataset.headerState = "pinned";
  window.addEventListener("scroll", onScroll, { passive: true });

  return {
    destroy() {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
      scheduled = false;
      window.removeEventListener("scroll", onScroll);
      delete header.dataset.headerState;
    },
  };
}
