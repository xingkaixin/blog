import { useEffect, useRef } from "react";
import { holidayLogoUrl, type HolidayLogoId } from "@/lib/holiday-logos";

export function HolidayLogoBadge({
  id,
  name,
  dark,
  exploded,
  motion,
  animated,
  onStamp,
}: {
  id: HolidayLogoId;
  name: string;
  dark: boolean;
  exploded: boolean;
  motion: boolean;
  animated: boolean;
  onStamp: () => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tiltRef = useRef<HTMLSpanElement>(null);
  const pressRef = useRef<HTMLSpanElement>(null);
  const flightRef = useRef<HTMLSpanElement>(null);
  const rippleRef = useRef<HTMLSpanElement>(null);
  const lastDark = useRef(dark);
  const lastId = useRef(id);

  useEffect(() => {
    const button = buttonRef.current;
    const tilt = tiltRef.current;
    const press = pressRef.current;
    if (!button || !tilt || !press || !motion) {
      return undefined;
    }
    const fine = matchMedia("(hover: hover) and (pointer: fine)");
    const foil = button.querySelectorAll<HTMLElement>("[data-logo-foil]");
    const glare = button.querySelectorAll<HTMLElement>("[data-logo-glare]");
    const target = [0, 0, 1];
    const value = [0, 0, 1];
    const velocity = [0, 0, 0];
    let frame = 0;
    let last = 0;
    function tick(time: number) {
      const delta = Math.min((time - (last || time - 16)) / 1000, 0.032);
      last = time;
      let settled = true;
      for (let axis = 0; axis < value.length; axis++) {
        velocity[axis] += ((target[axis] - value[axis]) * 220 - velocity[axis] * 22) * delta;
        value[axis] += velocity[axis] * delta;
        if (Math.abs(target[axis] - value[axis]) > 0.001 || Math.abs(velocity[axis]) > 0.001) {
          settled = false;
        }
      }
      tilt!.style.transform = `rotateX(${value[0]}deg) rotateY(${value[1]}deg)`;
      press!.style.transform = `scale(${value[2]})`;
      foil.forEach((element) => {
        element.style.transform = `translate(${value[1] * 1.5}%, ${value[0] * 1.5}%) rotate(-25deg)`;
      });
      glare.forEach((element) => {
        element.style.transform = `translate(${value[1]}%, ${-value[0]}%)`;
      });
      frame = settled ? 0 : requestAnimationFrame(tick);
    }
    function wake() {
      if (!frame) {
        last = 0;
        frame = requestAnimationFrame(tick);
      }
    }
    function move(event: PointerEvent) {
      if (!fine.matches || event.pointerType === "touch") {
        return;
      }
      const bounds = button!.getBoundingClientRect();
      target[0] = Math.max(
        -14,
        Math.min(14, (-(event.clientY - bounds.y - bounds.height / 2) / bounds.height) * 28),
      );
      target[1] = Math.max(
        -14,
        Math.min(14, ((event.clientX - bounds.x - bounds.width / 2) / bounds.width) * 28),
      );
      wake();
    }
    function down(event: PointerEvent) {
      if (!event.isPrimary || event.button !== 0) {
        return;
      }
      button!.setPointerCapture(event.pointerId);
      target[2] = 0.92;
      wake();
    }
    function reset() {
      target[0] = 0;
      target[1] = 0;
      target[2] = 1;
      wake();
    }
    button.addEventListener("pointermove", move);
    button.addEventListener("pointerdown", down);
    button.addEventListener("pointerleave", reset);
    button.addEventListener("pointerup", reset);
    button.addEventListener("pointercancel", reset);
    button.addEventListener("lostpointercapture", reset);
    return () => {
      cancelAnimationFrame(frame);
      tilt.style.transform = "";
      press.style.transform = "";
      foil.forEach((element) => {
        element.style.transform = "";
      });
      glare.forEach((element) => {
        element.style.transform = "";
      });
      button.removeEventListener("pointermove", move);
      button.removeEventListener("pointerdown", down);
      button.removeEventListener("pointerleave", reset);
      button.removeEventListener("pointerup", reset);
      button.removeEventListener("pointercancel", reset);
      button.removeEventListener("lostpointercapture", reset);
    };
  }, [motion]);

  useEffect(() => {
    if (!motion) {
      rippleRef.current?.getAnimations().forEach((animation) => animation.cancel());
    }
  }, [motion]);

  useEffect(() => {
    const changed = lastDark.current !== dark;
    lastDark.current = dark;
    if (!changed || !motion || !animated) {
      return undefined;
    }
    const animation = flightRef.current?.animate(
      [
        { transform: "translateY(0)" },
        { transform: "translateY(-40px)", offset: 0.4 },
        { transform: "translateY(0)" },
      ],
      { duration: 500, easing: "cubic-bezier(0.77, 0, 0.175, 1)" },
    );
    return () => animation?.cancel();
  }, [dark, motion, animated]);

  useEffect(() => {
    const changed = lastId.current !== id;
    lastId.current = id;
    if (!changed || !motion || !animated) {
      return undefined;
    }
    const animation = flightRef.current?.animate(
      [
        { transform: "translateY(14px) scale(0.94) rotate(-8deg)", opacity: 0 },
        { transform: "translateY(0) scale(1) rotate(0)", opacity: 1 },
      ],
      { duration: 250, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
    return () => animation?.cancel();
  }, [id, motion, animated]);

  return (
    <div data-logo-badge-wrap data-exploded={exploded} data-dark={dark}>
      <span data-logo-shadow aria-hidden="true" />
      <span data-logo-shockwave ref={rippleRef} aria-hidden="true" />
      <button
        ref={buttonRef}
        type="button"
        data-logo-badge
        aria-label={`敲击${name}徽章`}
        onClick={(event) => {
          onStamp();
          if (motion && event.detail > 0) {
            rippleRef.current?.getAnimations().forEach((animation) => animation.cancel());
            rippleRef.current?.animate(
              [
                { transform: "scale(0.95)", opacity: 0.7 },
                { transform: "scale(1.65)", opacity: 0 },
              ],
              { duration: 500, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
            );
          }
        }}
      >
        <span data-logo-pose>
          <span data-logo-tilt ref={tiltRef}>
            <span data-logo-press ref={pressRef}>
              <span data-logo-flight ref={flightRef}>
                <span data-logo-rotor>
                  {[false, true].map((night) => (
                    <span
                      key={String(night)}
                      data-logo-face={night ? "dark" : "light"}
                      aria-hidden="true"
                    >
                      <span data-logo-plinth />
                      <span data-logo-material>
                        <span data-logo-foil />
                        <span data-logo-glare />
                      </span>
                      {["shell", "core", "details"].map((layer) => (
                        <svg key={layer} data-logo-piece={layer} viewBox="0 0 200 200" fill="none">
                          <use href={`${holidayLogoUrl(id, night)}#logo-${layer}`} />
                        </svg>
                      ))}
                    </span>
                  ))}
                </span>
              </span>
            </span>
          </span>
        </span>
      </button>
    </div>
  );
}
