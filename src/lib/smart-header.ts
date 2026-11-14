export type SmartHeaderState = "pinned" | "compact";

export type SmartHeaderOptions = {
  header: HTMLElement;
  thresholdTarget?: HTMLElement | null;
  threshold?: number;
  isLocked?: () => boolean;
};

export type SmartHeaderController = {
  destroy: () => void;
};

const DEFAULT_THRESHOLD = 240;
const SCROLL_TOLERANCE = 8;

function isDropdownOpen(header: HTMLElement): boolean {
  return Boolean(header.querySelector('.t-dropdown.is-open, button[aria-expanded="true"]'));
}

function isMainBarFocused(header: HTMLElement): boolean {
  const mainBar = header.querySelector(".header-bar-main");
  if (!mainBar) {
    return false;
  }
  const active = header.ownerDocument.activeElement;
  return active instanceof Node && mainBar.contains(active);
}

function canEnterCompact(header: HTMLElement, thresholdTarget?: HTMLElement | null): boolean {
  if (header.hasAttribute("data-has-compact-bar")) {
    return true;
  }
  return Boolean(
    header.querySelector(".header-bar-compact") &&
    (thresholdTarget ?? header.ownerDocument.querySelector("[data-post-header]")),
  );
}

export function attachSmartHeader({
  header,
  thresholdTarget,
  threshold: explicitThreshold,
  isLocked,
}: SmartHeaderOptions): SmartHeaderController {
  let state: SmartHeaderState = "pinned";
  let lastY = Math.max(0, window.scrollY);
  let anchorY = lastY;
  let rafId = 0;
  let destroyed = false;

  const setState = (next: SmartHeaderState) => {
    state = next;
    header.dataset.headerState = next;
  };

  const getThreshold = () => {
    if (typeof explicitThreshold === "number") {
      return explicitThreshold;
    }
    if (!thresholdTarget) {
      return DEFAULT_THRESHOLD;
    }
    const rect = thresholdTarget.getBoundingClientRect();
    if (rect.height > 0) {
      return Math.max(0, Math.round(rect.bottom + window.scrollY));
    }
    const offsetBottom = thresholdTarget.offsetTop + thresholdTarget.offsetHeight;
    return offsetBottom > 0 ? offsetBottom : DEFAULT_THRESHOLD;
  };

  const update = () => {
    if (destroyed) {
      return;
    }

    const currentY = Math.max(0, window.scrollY);
    const step = currentY - lastY;
    const prevDirection = lastY - anchorY;
    if ((step > 0 && prevDirection < 0) || (step < 0 && prevDirection > 0)) {
      anchorY = lastY;
    }
    lastY = currentY;

    const locked = Boolean(isLocked?.()) || isDropdownOpen(header) || isMainBarFocused(header);
    if (!canEnterCompact(header, thresholdTarget) || currentY <= getThreshold() || locked) {
      anchorY = currentY;
      setState("pinned");
      return;
    }

    const netDelta = currentY - anchorY;
    if (netDelta < -SCROLL_TOLERANCE) {
      anchorY = currentY;
      setState("pinned");
      return;
    }

    if (netDelta > SCROLL_TOLERANCE && state !== "compact") {
      anchorY = currentY;
      setState("compact");
    }
  };

  const onScroll = () => {
    if (rafId !== 0) {
      return;
    }
    let pending = true;
    const id = window.requestAnimationFrame(() => {
      pending = false;
      rafId = 0;
      update();
    });
    if (pending) {
      rafId = id;
    }
  };

  const onFocusIn = () => {
    update();
  };

  setState("pinned");
  window.addEventListener("scroll", onScroll, { passive: true });
  header.addEventListener("focusin", onFocusIn);

  return {
    destroy() {
      destroyed = true;
      if (rafId !== 0) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
      window.removeEventListener("scroll", onScroll);
      header.removeEventListener("focusin", onFocusIn);
      delete header.dataset.headerState;
    },
  };
}
