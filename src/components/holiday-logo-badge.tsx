import type { PointerEvent, Ref } from "react";
import { SealLogoSvg } from "@/components/seal-logo-svg";
import type { DayPart } from "@/lib/day-part";
import { holidayLogoUrl } from "@/lib/holiday-logos";
import type { LogoNodeId } from "@/lib/logo-orrery";

export function HolidayLogoBadge({
  id,
  name,
  theme,
  night,
  dayPart,
  motion,
  armed,
  interactive,
  coreRef,
  carrierRef,
  slingPathRef,
  onCarrierPointerDown,
  onCarrierPointerMove,
  onCarrierPointerEnd,
  onLaunchClick,
}: {
  id: LogoNodeId;
  name: string;
  theme: string;
  night: boolean;
  dayPart: DayPart;
  motion: boolean;
  armed: boolean;
  interactive: boolean;
  coreRef?: Ref<HTMLDivElement>;
  carrierRef: Ref<HTMLButtonElement>;
  slingPathRef: Ref<SVGPathElement>;
  onCarrierPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onCarrierPointerMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onCarrierPointerEnd: (event: PointerEvent<HTMLButtonElement>) => void;
  onLaunchClick?: () => void;
}) {
  const artwork =
    id === "seal" ? (
      <SealLogoSvg
        dayPart={dayPart}
        inverted={night}
        motion={motion}
        label={interactive ? `${name}，${theme}` : undefined}
      />
    ) : (
      <img
        src={holidayLogoUrl(id, night)}
        alt={interactive ? `${name}，${theme}` : ""}
        width={160}
        height={160}
        draggable={false}
      />
    );

  return (
    <div ref={coreRef} data-logo-core data-armed={armed ? "true" : undefined}>
      <span data-logo-pole="top" aria-hidden="true">
        {armed ? "松手换标 ↑" : "昼 · 正立"}
      </span>
      <svg data-logo-sling-svg viewBox="0 0 236 236" fill="none" aria-hidden="true">
        <circle data-sling-anchor cx="26" cy="118" r="3" />
        <circle data-sling-anchor cx="210" cy="118" r="3" />
        <path ref={slingPathRef} data-sling-cord d="M 26 118 Q 118 118 210 118" opacity="0" />
      </svg>
      <button
        ref={carrierRef}
        type="button"
        data-logo-core-carrier
        tabIndex={interactive ? 0 : -1}
        aria-label={interactive ? `下拉弹射${name}到导航栏页眉，或点击立即切换` : undefined}
        onPointerDown={onCarrierPointerDown}
        onPointerMove={onCarrierPointerMove}
        onPointerUp={onCarrierPointerEnd}
        onPointerCancel={onCarrierPointerEnd}
        onLostPointerCapture={onCarrierPointerEnd}
        onClick={(event) => {
          // 仅键盘激活（detail === 0）直接触发换标，指针交互交由下方拖拽回弹判定。
          if (interactive && event.detail === 0) {
            onLaunchClick?.();
          }
        }}
      >
        <span data-logo-core-visual={interactive ? "day" : "night"}>{artwork}</span>
      </button>
      <span data-logo-pole="bottom" aria-hidden="true">
        夜 · 颠倒
      </span>
    </div>
  );
}
