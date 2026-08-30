export type SmartHeaderState = "pinned" | "hidden" | "revealed";

export type ComputeStateOptions = {
  currentY: number;
  lastY: number;
  threshold: number;
  tolerance?: number;
  currentState: SmartHeaderState;
  forceVisible?: boolean;
};

export function computeSmartHeaderState({
  currentY,
  lastY,
  threshold,
  tolerance = 8,
  currentState,
  forceVisible = false,
}: ComputeStateOptions): SmartHeaderState {
  if (forceVisible || currentY <= threshold) {
    return "pinned";
  }

  const diff = currentY - lastY;

  if (diff > tolerance) {
    return "hidden";
  }

  if (diff < -tolerance) {
    return "revealed";
  }

  return currentState;
}

export type AttachSmartHeaderOptions = {
  header: HTMLElement;
  thresholdTarget?: HTMLElement | null;
  defaultThreshold?: number;
  tolerance?: number;
  isLocked?: () => boolean;
};

export type SmartHeaderController = {
  update: () => void;
  destroy: () => void;
};

export function attachSmartHeader({
  header,
  thresholdTarget,
  defaultThreshold = 240,
  tolerance = 8,
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
    return defaultThreshold;
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
      tolerance,
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
    update() {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
      scheduled = false;
      tick();
    },
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
