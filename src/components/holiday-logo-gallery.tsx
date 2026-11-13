import { ArrowLeftIcon } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { ArrowsOutLineVerticalIcon } from "@phosphor-icons/react/dist/csr/ArrowsOutLineVertical";
import { ArrowUpRightIcon } from "@phosphor-icons/react/dist/csr/ArrowUpRight";
import { ClockCounterClockwiseIcon } from "@phosphor-icons/react/dist/csr/ClockCounterClockwise";
import { FlaskIcon } from "@phosphor-icons/react/dist/csr/Flask";
import { PauseIcon } from "@phosphor-icons/react/dist/csr/Pause";
import { PlayIcon } from "@phosphor-icons/react/dist/csr/Play";
import { SpeakerHighIcon } from "@phosphor-icons/react/dist/csr/SpeakerHigh";
import { SpeakerSlashIcon } from "@phosphor-icons/react/dist/csr/SpeakerSlash";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { HolidayLogoBadge } from "@/components/holiday-logo-badge";
import { HolidayLogoDial } from "@/components/holiday-logo-dial";
import { SealLogoSvg } from "@/components/seal-logo-svg";
import { Button } from "@/components/ui/button";
import { dayPartFromMinutes } from "@/lib/day-part";
import { previewHolidayLogo, type LogoPreviewTarget } from "@/lib/holiday-logo-browser";
import { holidayDateAt } from "@/lib/holiday-logo-calendar";
import {
  buildLogoNodes,
  DAY_PART_SPECS,
  formatSundialClock,
  GROUP_LABELS,
  nearestLogoNode,
  type LogoNode,
  type LogoNodeId,
  type Season,
} from "@/lib/logo-orrery";
import "./holiday-logo-gallery.css";

const SEASONS: readonly Season[] = ["spring", "summer", "autumn", "winter"];
const SLING_THRESHOLD_PX = 22;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function initialNodeId(nodes: LogoNode[], today: string): LogoNodeId {
  return (
    nodes.find((node) => node.id !== "seal" && node.date >= today)?.id ??
    nodes[1]?.id ??
    nodes[0].id
  );
}

function normalizeMinutes(date: Date): number {
  const total = date.getHours() * 60 + date.getMinutes();
  return Math.floor(total / 15) * 15;
}

export function HolidayLogoGallery({ initialToday }: { initialToday: string }) {
  const [today, setToday] = useState(initialToday);
  const nodes = useMemo(() => buildLogoNodes(today), [today]);
  const [selectedId, setSelectedId] = useState<LogoNodeId>(() =>
    initialNodeId(buildLogoNodes(initialToday), initialToday),
  );
  const [sundialMinutes, setSundialMinutes] = useState(630);
  const [sundialCustom, setSundialCustom] = useState(false);
  const [horizonPct, setHorizonPct] = useState(52);
  const [horizonSnapMode, setHorizonSnapMode] = useState<"day" | "half" | "night">("half");
  const [slingArmed, setSlingArmed] = useState(false);
  const [previewTarget, setPreviewTarget] = useState<LogoPreviewTarget>(null);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [sound, setSound] = useState(false);
  const [audioAvailable, setAudioAvailable] = useState(false);
  const [notice, setNotice] = useState("");

  const stageRef = useRef<HTMLDivElement>(null);
  const dayPlaneRef = useRef<HTMLElement>(null);
  const horizonBarRef = useRef<HTMLDivElement>(null);
  const horizonReadoutRef = useRef<HTMLSpanElement>(null);
  const coreMeasureRef = useRef<HTMLDivElement>(null);
  const dayWheelRef = useRef<HTMLDivElement>(null);
  const nightWheelRef = useRef<HTMLDivElement>(null);
  const dayCarrierRef = useRef<HTMLButtonElement>(null);
  const nightCarrierRef = useRef<HTMLButtonElement>(null);
  const daySlingPathRef = useRef<SVGPathElement>(null);
  const nightSlingPathRef = useRef<SVGPathElement>(null);
  const audioRef = useRef<AudioContext | null>(null);

  const selected = useMemo(
    () => nodes.find((node) => node.id === selectedId) ?? nodes[0],
    [nodes, selectedId],
  );
  const dayPart = dayPartFromMinutes(sundialMinutes);
  const dayPartSpec = DAY_PART_SPECS.find((spec) => spec.id === dayPart) ?? DAY_PART_SPECS[1];
  const motion = !paused && !reducedMotion;

  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const selectedIdRef = useRef(selected.id);
  selectedIdRef.current = selected.id;
  const motionRef = useRef(motion);
  motionRef.current = motion;
  const soundRef = useRef(sound);
  soundRef.current = sound;

  const physicsRef = useRef({
    angle: selected.targetAngle,
    targetAngle: selected.targetAngle,
    vel: 0,
    lastTickStep: Math.round(selected.targetAngle / (360 / 365)),
    horizon: 0.52,
    horizonTarget: null as number | null,
    halfRatio: 0.52,
    wheelDrag: {
      active: false,
      pointerId: -1,
      stageEl: null as HTMLElement | null,
      prevDeg: 0,
      lastTime: 0,
    },
    horizonDrag: {
      active: false,
      pointerId: -1,
    },
    sling: {
      active: false,
      pointerId: -1,
      startX: 0,
      startY: 0,
      dx: 0,
      dy: 0,
      moved: false,
      armed: false,
    },
  });

  const playTone = useCallback((kind: "tick" | "accent" | "tap" | "launch") => {
    if (!soundRef.current) {
      return;
    }
    try {
      const ctx = (audioRef.current ??= new AudioContext());
      if (ctx.state === "suspended") {
        void ctx.resume().catch(() => {
          setSound(false);
        });
      }
      const now = ctx.currentTime;
      if (kind === "launch") {
        [392, 523.25, 659.25].forEach((freq, index) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, now + index * 0.035);
          gain.gain.setValueAtTime(0.055, now + index * 0.035);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.035 + 0.14);
          osc.connect(gain).connect(ctx.destination);
          osc.start(now + index * 0.035);
          osc.stop(now + index * 0.035 + 0.15);
          osc.addEventListener(
            "ended",
            () => {
              osc.disconnect();
              gain.disconnect();
            },
            { once: true },
          );
        });
        return;
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = kind === "accent" ? "triangle" : "sine";
      const startFreq = kind === "tap" ? 190 : kind === "accent" ? 1320 : 2100;
      const endFreq = kind === "tap" ? 55 : kind === "accent" ? 440 : 680;
      const dur = kind === "tap" ? 0.065 : kind === "accent" ? 0.045 : 0.022;
      const amp = kind === "tap" ? 0.16 : kind === "accent" ? 0.075 : 0.032;
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(endFreq, now + dur);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(amp, now + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur + 0.015);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + dur + 0.02);
      osc.addEventListener(
        "ended",
        () => {
          osc.disconnect();
          gain.disconnect();
        },
        { once: true },
      );
    } catch {
      setSound(false);
      setAudioAvailable(false);
    }
  }, []);

  const applyWheelDom = useCallback(
    (deg: number) => {
      const physics = physicsRef.current;
      physics.angle = deg;
      const step = Math.round(deg / (360 / 365));
      if (step !== physics.lastTickStep) {
        physics.lastTickStep = step;
        playTone("tick");
      }
      const transform = `rotate(${deg.toFixed(3)}deg)`;
      if (dayWheelRef.current) {
        dayWheelRef.current.style.transform = transform;
      }
      if (nightWheelRef.current) {
        nightWheelRef.current.style.transform = transform;
      }
    },
    [playTone],
  );

  const applyHorizonDom = useCallback((ratio: number) => {
    const clamped = clamp(ratio, 0, 1);
    physicsRef.current.horizon = clamped;
    const pct = Math.round(clamped * 100);
    if (dayPlaneRef.current) {
      dayPlaneRef.current.style.clipPath = `inset(0 0 ${(100 - clamped * 100).toFixed(2)}% 0)`;
    }
    const stageHeight = stageRef.current?.clientHeight ?? 680;
    if (horizonBarRef.current) {
      horizonBarRef.current.style.transform = `translate3d(0, ${(clamped * stageHeight).toFixed(1)}px, 0)`;
      horizonBarRef.current.setAttribute("aria-valuenow", String(pct));
    }
    if (horizonReadoutRef.current) {
      horizonReadoutRef.current.textContent = `昼 ${pct}% · 夜 ${100 - pct}%`;
    }
  }, []);

  const syncHorizonSnapshot = useCallback((ratio: number) => {
    const pct = Math.round(clamp(ratio, 0, 1) * 100);
    setHorizonPct(pct);
    if (pct >= 98) {
      setHorizonSnapMode("day");
    } else if (pct <= 2) {
      setHorizonSnapMode("night");
    } else {
      setHorizonSnapMode("half");
    }
  }, []);

  const applySlingDom = useCallback((dx: number, dy: number, snapBack: boolean) => {
    const rot = (-dx * 0.16).toFixed(1);
    const transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) rotate(${rot}deg)`;
    [dayCarrierRef.current, nightCarrierRef.current].forEach((carrier) => {
      if (!carrier) {
        return;
      }
      carrier.dataset.snapBack = snapBack ? "true" : "false";
      carrier.dataset.pulling = dy > 4 ? "true" : "false";
      carrier.style.transform = transform;
    });
    const cordD = `M 26 118 Q ${118 + dx} ${118 + Math.max(0, dy) * 1.15} 210 118`;
    const cordOpacity = dy > 4 ? (dy > SLING_THRESHOLD_PX ? "0.95" : "0.5") : "0";
    [daySlingPathRef.current, nightSlingPathRef.current].forEach((path) => {
      if (!path) {
        return;
      }
      path.setAttribute("d", cordD);
      path.setAttribute("opacity", cordOpacity);
    });
  }, []);

  const setNavbarArmed = useCallback((armed: boolean) => {
    const brand = document.querySelector<HTMLElement>("[data-site-brand]");
    if (brand) {
      if (armed) {
        brand.dataset.slingshotTarget = "armed";
      } else {
        delete brand.dataset.slingshotTarget;
      }
    }
  }, []);

  const selectNode = useCallback(
    (id: LogoNodeId, animated = true) => {
      const node = nodesRef.current.find((item) => item.id === id);
      if (!node) {
        return;
      }
      const physics = physicsRef.current;
      const diff = ((node.targetAngle - physics.angle + 540) % 360) - 180;
      physics.targetAngle = physics.angle + diff;
      physics.vel = 0;
      if (!animated || !motionRef.current) {
        applyWheelDom(physics.targetAngle);
      }
      if (id !== selectedIdRef.current) {
        setSelectedId(id);
        playTone("accent");
      }
    },
    [applyWheelDom, playTone],
  );

  const stepNode = useCallback(
    (delta: number) => {
      const list = nodesRef.current;
      const currentIdx = Math.max(
        0,
        list.findIndex((item) => item.id === selectedIdRef.current),
      );
      const next = list[(currentIdx + delta + list.length) % list.length];
      if (next) {
        selectNode(next.id, true);
      }
    },
    [selectNode],
  );

  const fireSlingshot = useCallback(
    (targetId: LogoNodeId = selectedIdRef.current) => {
      const node = nodesRef.current.find((item) => item.id === targetId) ?? nodesRef.current[0];
      const useNightArt =
        physicsRef.current.horizon < 0.25 || document.documentElement.dataset.theme === "dark";
      const sourceCarrier = useNightArt ? nightCarrierRef.current : dayCarrierRef.current;
      const sourceVisual = sourceCarrier?.querySelector<HTMLElement>("[data-logo-core-visual]");
      const brandMark = document.querySelector<HTMLElement>("[data-site-brand] [data-brand-mark]");

      playTone("launch");
      setNavbarArmed(false);
      setSlingArmed(false);

      if (!motionRef.current || !sourceCarrier || !sourceVisual || !brandMark) {
        setPreviewTarget(node.id);
        setNotice(`已将${node.name}换标到页眉。`);
        return;
      }

      const sr = sourceCarrier.getBoundingClientRect();
      const er = brandMark.getBoundingClientRect();
      const sx = sr.left + sr.width / 2;
      const sy = sr.top + sr.height / 2;
      const ex = er.left + er.width / 2;
      const ey = er.top + er.height / 2;

      const flyer = document.createElement("div");
      flyer.dataset.logoFlyer = useNightArt ? "night" : "day";
      const clone = sourceVisual.cloneNode(true) as HTMLElement;
      flyer.appendChild(clone);
      document.body.appendChild(flyer);

      const cx = (sx + ex) / 2 + 96;
      const cy = Math.min(sy, ey) - 68;
      const startTime = performance.now();
      const duration = 420;

      const fly = (now: number) => {
        const t = Math.min(1, (now - startTime) / duration);
        const ease = 1 - Math.pow(1 - t, 3);
        const inv = 1 - ease;
        const x = inv * inv * sx + 2 * inv * ease * cx + ease * ease * ex;
        const y = inv * inv * sy + 2 * inv * ease * cy + ease * ease * ey;
        const scale = 1 - 0.76 * ease;
        const deg = (1 - ease) * -16;
        flyer.style.transform = `translate3d(${x - 60}px, ${y - 60}px, 0) scale(${scale.toFixed(3)}) rotate(${deg.toFixed(1)}deg)`;
        if (t < 1) {
          requestAnimationFrame(fly);
        } else {
          flyer.remove();
          setPreviewTarget(node.id);
          setNotice(`已将${node.name}弹射到导航栏页眉。`);
          brandMark.animate(
            [{ transform: "scale(1.26)" }, { transform: "scale(0.94)" }, { transform: "scale(1)" }],
            { duration: 280, easing: "cubic-bezier(0.23, 1, 0.32, 1)" },
          );
        }
      };

      requestAnimationFrame(fly);
    },
    [playTone, setNavbarArmed],
  );

  // 客户端挂载与环境同步：时间、主题偏好、音效能力与星盘中心坐标测量。
  useEffect(() => {
    const current = holidayDateAt();
    setToday(current);
    const updatedNodes = buildLogoNodes(current);
    const startId = initialNodeId(updatedNodes, current);
    setSelectedId(startId);
    const startNode = updatedNodes.find((item) => item.id === startId) ?? updatedNodes[0];
    physicsRef.current.angle = startNode.targetAngle;
    physicsRef.current.targetAngle = startNode.targetAngle;
    applyWheelDom(startNode.targetAngle);

    setSundialMinutes(normalizeMinutes(new Date()));
    setAudioAvailable("AudioContext" in window);

    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => setReducedMotion(preference.matches);
    syncMotion();
    preference.addEventListener("change", syncMotion);

    const measureHalf = () => {
      const stage = stageRef.current;
      const core = coreMeasureRef.current;
      if (!stage || !core) {
        return;
      }
      const stageRect = stage.getBoundingClientRect();
      const coreRect = core.getBoundingClientRect();
      if (stageRect.height <= 0 || coreRect.height <= 0) {
        return;
      }
      const nextHalf = clamp(
        (coreRect.top + coreRect.height / 2 - stageRect.top) / stageRect.height,
        0.18,
        0.82,
      );
      const prevHalf = physicsRef.current.halfRatio;
      physicsRef.current.halfRatio = nextHalf;
      if (Math.abs(physicsRef.current.horizon - prevHalf) < 0.04) {
        applyHorizonDom(nextHalf);
        syncHorizonSnapshot(nextHalf);
      } else {
        applyHorizonDom(physicsRef.current.horizon);
      }
    };

    const resizeObserver = new ResizeObserver(measureHalf);
    if (stageRef.current) {
      resizeObserver.observe(stageRef.current);
    }
    measureHalf();

    const observer = new MutationObserver(() => {
      const isDark = document.documentElement.dataset.theme === "dark";
      const nextRatio = isDark ? 0 : 1;
      if (motionRef.current) {
        physicsRef.current.horizonTarget = nextRatio;
      } else {
        applyHorizonDom(nextRatio);
        syncHorizonSnapshot(nextRatio);
      }
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    const wheelTargets = Array.from(
      stageRef.current?.querySelectorAll<HTMLElement>("[data-logo-orrery]") ?? [],
    );
    const onOrreryWheel = (event: WheelEvent) => {
      event.preventDefault();
      physicsRef.current.vel += (event.deltaY + event.deltaX) * 0.04;
    };
    wheelTargets.forEach((el) => el.addEventListener("wheel", onOrreryWheel, { passive: false }));

    let frame = 0;
    const tick = () => {
      const physics = physicsRef.current;
      if (!physics.wheelDrag.active) {
        if (Math.abs(physics.vel) > 0.06) {
          applyWheelDom(physics.angle + physics.vel);
          physics.vel *= 0.93;
          const near = nearestLogoNode(physics.angle, nodesRef.current);
          if (near.id !== selectedIdRef.current) {
            setSelectedId(near.id);
          }
          const diff = ((near.targetAngle - physics.angle + 540) % 360) - 180;
          physics.targetAngle = physics.angle + diff;
        } else {
          physics.vel = 0;
          const delta = physics.targetAngle - physics.angle;
          if (Math.abs(delta) > 0.04) {
            applyWheelDom(physics.angle + delta * (motionRef.current ? 0.16 : 1));
          }
        }
      }

      if (!physics.horizonDrag.active && physics.horizonTarget !== null) {
        const diff = physics.horizonTarget - physics.horizon;
        if (!motionRef.current || Math.abs(diff) < 0.002) {
          const done = physics.horizonTarget;
          physics.horizonTarget = null;
          applyHorizonDom(done);
          syncHorizonSnapshot(done);
        } else {
          applyHorizonDom(physics.horizon + diff * 0.22);
        }
      }

      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      preference.removeEventListener("change", syncMotion);
      observer.disconnect();
      wheelTargets.forEach((el) => el.removeEventListener("wheel", onOrreryWheel));
      setNavbarArmed(false);
      void audioRef.current?.close();
    };
  }, [applyHorizonDom, applyWheelDom, setNavbarArmed, syncHorizonSnapshot]);

  // 同步页眉换标预览（离开页面时恢复按日期自动匹配）。
  useEffect(() => {
    previewHolidayLogo(previewTarget, previewTarget === "seal" ? dayPart : null);
    return () => previewHolidayLogo(null);
  }, [previewTarget, dayPart]);

  // 外圈星盘拖拽与滚轮拨盘。
  function pointerAngle(event: PointerEvent<HTMLElement>): number {
    const rect = event.currentTarget.getBoundingClientRect();
    return (
      Math.atan2(
        event.clientY - (rect.top + rect.height / 2),
        event.clientX - (rect.left + rect.width / 2),
      ) *
      (180 / Math.PI)
    );
  }

  function handleDialPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0 || physicsRef.current.wheelDrag.active) {
      return;
    }
    const physics = physicsRef.current;
    physics.wheelDrag.active = true;
    physics.wheelDrag.pointerId = event.pointerId;
    physics.wheelDrag.stageEl = event.currentTarget;
    physics.wheelDrag.prevDeg = pointerAngle(event);
    physics.wheelDrag.lastTime = performance.now();
    physics.vel = 0;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleDialPointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = physicsRef.current.wheelDrag;
    if (!drag.active || drag.pointerId !== event.pointerId) {
      return;
    }
    const current = pointerAngle(event);
    const delta = ((current - drag.prevDeg + 540) % 360) - 180;
    const now = performance.now();
    const dt = Math.max(8, now - drag.lastTime);
    physicsRef.current.vel = (delta / dt) * 16;
    drag.prevDeg = current;
    drag.lastTime = now;
    applyWheelDom(physicsRef.current.angle + delta);
    const near = nearestLogoNode(physicsRef.current.angle, nodesRef.current);
    if (near.id !== selectedIdRef.current) {
      setSelectedId(near.id);
    }
  }

  function handleDialPointerEnd(event: PointerEvent<HTMLDivElement>) {
    const drag = physicsRef.current.wheelDrag;
    if (!drag.active || drag.pointerId !== event.pointerId) {
      return;
    }
    drag.active = false;
    drag.pointerId = -1;
    const near = nearestLogoNode(physicsRef.current.angle, nodesRef.current);
    const diff = ((near.targetAngle - physicsRef.current.angle + 540) % 360) - 180;
    physicsRef.current.targetAngle = physicsRef.current.angle + diff;
    if (near.id !== selectedIdRef.current) {
      setSelectedId(near.id);
    }
  }

  // 中央核弹性拉弓交互。
  function handleCarrierPointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (!event.isPrimary || event.button !== 0 || physicsRef.current.sling.active) {
      return;
    }
    event.stopPropagation();
    const sling = physicsRef.current.sling;
    sling.active = true;
    sling.pointerId = event.pointerId;
    sling.startX = event.clientX;
    sling.startY = event.clientY;
    sling.dx = 0;
    sling.dy = 0;
    sling.moved = false;
    sling.armed = false;
    event.currentTarget.setPointerCapture(event.pointerId);
    applySlingDom(0, 0, false);
  }

  function handleCarrierPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const sling = physicsRef.current.sling;
    if (!sling.active || sling.pointerId !== event.pointerId) {
      return;
    }
    const rawX = clamp(event.clientX - sling.startX, -64, 64);
    const rawY = clamp(event.clientY - sling.startY, -18, 120);
    if (Math.hypot(rawX, rawY) > 6) {
      sling.moved = true;
    }
    sling.dx = rawX * 0.45;
    sling.dy = rawY > 0 ? rawY * 0.72 : rawY * 0.25;
    applySlingDom(sling.dx, sling.dy, false);
    const armed = sling.dy > SLING_THRESHOLD_PX;
    if (armed !== sling.armed) {
      sling.armed = armed;
      setSlingArmed(armed);
      setNavbarArmed(armed);
    }
  }

  function handleCarrierPointerEnd(event: PointerEvent<HTMLButtonElement>) {
    const sling = physicsRef.current.sling;
    if (!sling.active || sling.pointerId !== event.pointerId) {
      return;
    }
    const { dy, moved } = sling;
    sling.active = false;
    sling.pointerId = -1;
    sling.armed = false;
    applySlingDom(0, 0, true);
    if (dy > SLING_THRESHOLD_PX) {
      fireSlingshot(selectedIdRef.current);
      return;
    }
    setSlingArmed(false);
    setNavbarArmed(false);
    if (!moved) {
      playTone("tap");
      setNotice(`${selected.name}，轻敲盖印。向下拉动可弹射换标。`);
    }
  }

  // 颠倒地平线上下拖拽。
  function updateHorizonFromPointer(clientY: number) {
    const stageRect = stageRef.current?.getBoundingClientRect();
    if (!stageRect || stageRect.height <= 0) {
      return;
    }
    const ratio = (clientY - stageRect.top) / stageRect.height;
    applyHorizonDom(ratio);
  }

  function handleHorizonPointerDown(event: PointerEvent<HTMLElement>) {
    if (!event.isPrimary || event.button !== 0) {
      return;
    }
    event.stopPropagation();
    const physics = physicsRef.current;
    physics.horizonDrag.active = true;
    physics.horizonDrag.pointerId = event.pointerId;
    physics.horizonTarget = null;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateHorizonFromPointer(event.clientY);
  }

  function handleHorizonPointerMove(event: PointerEvent<HTMLElement>) {
    const drag = physicsRef.current.horizonDrag;
    if (!drag.active || drag.pointerId !== event.pointerId) {
      return;
    }
    updateHorizonFromPointer(event.clientY);
  }

  function handleHorizonPointerEnd(event: PointerEvent<HTMLElement>) {
    const drag = physicsRef.current.horizonDrag;
    if (!drag.active || drag.pointerId !== event.pointerId) {
      return;
    }
    drag.active = false;
    drag.pointerId = -1;
    const h = physicsRef.current.horizon;
    if (h < 0.08) {
      physicsRef.current.horizonTarget = 0;
      playTone("accent");
    } else if (h > 0.92) {
      physicsRef.current.horizonTarget = 1;
      playTone("accent");
    } else {
      syncHorizonSnapshot(h);
    }
  }

  function snapHorizon(mode: "day" | "half" | "night") {
    playTone("accent");
    const target = mode === "day" ? 1 : mode === "night" ? 0 : physicsRef.current.halfRatio;
    if (motion) {
      physicsRef.current.horizonTarget = target;
    } else {
      applyHorizonDom(target);
    }
    syncHorizonSnapshot(target);
  }

  function handleHorizonKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = 0.05;
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      const next = clamp(physicsRef.current.horizon - step, 0, 1);
      physicsRef.current.horizonTarget = null;
      applyHorizonDom(next);
      syncHorizonSnapshot(next);
    } else if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      const next = clamp(physicsRef.current.horizon + step, 0, 1);
      physicsRef.current.horizonTarget = null;
      applyHorizonDom(next);
      syncHorizonSnapshot(next);
    } else if (event.key === "Home") {
      event.preventDefault();
      snapHorizon("night");
    } else if (event.key === "End") {
      event.preventDefault();
      snapHorizon("day");
    }
  }

  function renderPlane(mode: "day" | "night") {
    const interactive = mode === "day";
    const isNight = mode === "night";
    const tab = interactive ? 0 : -1;
    const topNodes = nodes.slice(0, 12);
    const bottomNodes = nodes.slice(12);

    const renderNodeBtn = (node: LogoNode) => (
      <button
        key={node.id}
        type="button"
        data-logo-star-btn
        data-logo-group={node.group}
        aria-pressed={interactive ? node.id === selected.id : undefined}
        data-selected={node.id === selected.id ? "true" : undefined}
        tabIndex={tab}
        onClick={() => selectNode(node.id, true)}
      >
        <span data-star-name-wrap>
          <span data-star-pip aria-hidden="true" />
          <span data-star-label>{node.name}</span>
        </span>
        <span data-star-date>{node.shortDate}</span>
      </button>
    );

    return (
      <section
        ref={interactive ? dayPlaneRef : undefined}
        data-logo-plane={mode}
        aria-label={interactive ? "白昼正立世界" : undefined}
        aria-hidden={interactive ? undefined : true}
      >
        <div data-logo-halos aria-hidden="true">
          {SEASONS.map((season) => (
            <div
              key={season}
              data-logo-halo={season}
              data-active={selected.season === season ? "true" : undefined}
            />
          ))}
        </div>

        <header data-logo-topbar>
          <div data-logo-title-group>
            <button
              type="button"
              data-logo-breadcrumb
              tabIndex={tab}
              onClick={() => {
                void import("@/lib/search-launcher")
                  .then(({ openSearch }) => openSearch())
                  .catch((error) => console.error("加载命令面板失败", error));
              }}
            >
              <FlaskIcon aria-hidden="true" size={14} />
              实验
            </button>
            {interactive ? (
              <h1 data-logo-title>岁时星盘</h1>
            ) : (
              <span data-logo-title aria-hidden="true">
                岁时星盘
              </span>
            )}
            <span data-logo-subtitle>
              {today.slice(0, 4)} · {isNight ? "颠倒夜幕" : "白昼历法仪"}
            </span>
          </div>

          <div data-logo-toolbar>
            <div
              data-logo-horizon-tabs
              role="group"
              aria-label={interactive ? "昼夜切分模式" : undefined}
            >
              {(
                [
                  ["day", "纯昼"],
                  ["half", "对半"],
                  ["night", "纯夜"],
                ] as const
              ).map(([preset, label]) => (
                <button
                  key={preset}
                  type="button"
                  data-logo-pill
                  data-active={horizonSnapMode === preset ? "true" : undefined}
                  aria-pressed={interactive ? horizonSnapMode === preset : undefined}
                  tabIndex={tab}
                  onClick={() => snapHorizon(preset)}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              type="button"
              data-logo-pill
              data-active={sound ? "true" : undefined}
              aria-pressed={interactive ? sound : undefined}
              disabled={!audioAvailable}
              tabIndex={tab}
              onClick={() => setSound(!sound)}
            >
              {sound ? (
                <SpeakerHighIcon aria-hidden="true" size={14} />
              ) : (
                <SpeakerSlashIcon aria-hidden="true" size={14} />
              )}
              <span>声效</span>
            </button>

            <button
              type="button"
              data-logo-pill
              data-active={paused ? "true" : undefined}
              aria-pressed={interactive ? paused : undefined}
              tabIndex={tab}
              onClick={() => setPaused(!paused)}
            >
              {paused ? (
                <PlayIcon aria-hidden="true" size={14} />
              ) : (
                <PauseIcon aria-hidden="true" size={14} />
              )}
              <span>{paused ? "播放" : "静止"}</span>
            </button>
          </div>
        </header>

        <div data-logo-grid-stage>
          <aside data-logo-col="left">
            <section data-logo-sundial aria-label={interactive ? "方印二十四时日晷" : undefined}>
              <div data-sundial-head>
                <button
                  type="button"
                  data-sundial-seal-btn
                  data-active={selected.id === "seal" ? "true" : undefined}
                  tabIndex={tab}
                  aria-label={interactive ? "在星盘中心查看方印本尊" : undefined}
                  onClick={() => selectNode("seal", true)}
                >
                  <SealLogoSvg dayPart={dayPart} inverted={isNight} motion={motion} />
                </button>
                <div data-sundial-readout>
                  <div data-sundial-clock-row>
                    <time data-sundial-clock>{formatSundialClock(sundialMinutes)}</time>
                    <span data-sundial-part-tag>{dayPartSpec.label}</span>
                    {sundialCustom && (
                      <button
                        type="button"
                        data-sundial-reset
                        tabIndex={tab}
                        onClick={() => {
                          setSundialMinutes(normalizeMinutes(new Date()));
                          setSundialCustom(false);
                          playTone("accent");
                        }}
                      >
                        <ClockCounterClockwiseIcon aria-hidden="true" size={12} />
                        此刻
                      </button>
                    )}
                  </div>
                  <p data-sundial-greeting>
                    {dayPartSpec.title} · {dayPartSpec.greeting}
                  </p>
                </div>
              </div>

              <div data-sundial-slider-wrap>
                <div data-sundial-zones aria-hidden="true">
                  <span data-zone="night-early" />
                  <span data-zone="morning" />
                  <span data-zone="day-am" />
                  <span data-zone="noon" />
                  <span data-zone="day-pm" />
                  <span data-zone="evening" />
                  <span data-zone="night-late" />
                </div>
                <input
                  type="range"
                  data-sundial-range
                  min={0}
                  max={1425}
                  step={15}
                  value={sundialMinutes}
                  tabIndex={tab}
                  aria-label={interactive ? "24 小时方印日晷时间" : undefined}
                  aria-valuetext={
                    interactive
                      ? `${formatSundialClock(sundialMinutes)} ${dayPartSpec.title}`
                      : undefined
                  }
                  onChange={(event) => {
                    setSundialMinutes(Number(event.target.value));
                    setSundialCustom(true);
                  }}
                />
              </div>

              <div data-sundial-chips>
                {DAY_PART_SPECS.map((spec) => (
                  <button
                    key={spec.id}
                    type="button"
                    data-sundial-chip
                    data-active={dayPart === spec.id ? "true" : undefined}
                    aria-pressed={interactive ? dayPart === spec.id : undefined}
                    tabIndex={tab}
                    onClick={() => {
                      setSundialMinutes(spec.sampleMinutes);
                      setSundialCustom(true);
                      playTone("accent");
                    }}
                  >
                    {spec.label}
                  </button>
                ))}
              </div>
            </section>

            <section data-logo-info aria-label={interactive ? "当前星位说明" : undefined}>
              <div data-info-meta>
                <span data-info-dot data-logo-group={selected.group} aria-hidden="true" />
                <span>
                  {selected.id === "seal" ? "全年常态" : selected.date} ·{" "}
                  {GROUP_LABELS[selected.group]} · {selected.rule}
                </span>
              </div>
              <div data-info-title-row>
                {interactive ? (
                  <h2 data-info-name aria-live="polite">
                    {selected.name}
                  </h2>
                ) : (
                  <span data-info-name aria-hidden="true">
                    {selected.name}
                  </span>
                )}
                <span data-info-theme>{selected.theme}</span>
              </div>
              <p data-info-desc>{selected.description}</p>
              <div data-info-actions>
                <Button
                  type="button"
                  variant="secondary"
                  className="size-8 rounded-full p-0"
                  tabIndex={tab}
                  aria-label={interactive ? "上一枚 Logo" : undefined}
                  onClick={() => stepNode(-1)}
                >
                  <ArrowLeftIcon aria-hidden="true" size={14} />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="size-8 rounded-full p-0"
                  tabIndex={tab}
                  aria-label={interactive ? "下一枚 Logo" : undefined}
                  onClick={() => stepNode(1)}
                >
                  <ArrowRightIcon aria-hidden="true" size={14} />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-8 rounded-full px-3 text-xs"
                  tabIndex={tab}
                  data-logo-launch-btn
                  onClick={() => fireSlingshot(selected.id)}
                >
                  <ArrowUpRightIcon aria-hidden="true" size={14} />
                  弹射换标
                </Button>
                {previewTarget !== null && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-8 rounded-full px-3 text-xs"
                    tabIndex={tab}
                    onClick={() => {
                      setPreviewTarget(null);
                      playTone("accent");
                      setNotice("已恢复页眉默认日期 Logo。");
                    }}
                  >
                    恢复默认
                  </Button>
                )}
              </div>
            </section>
          </aside>

          <div data-logo-col="center">
            <div data-logo-orrery>
              <HolidayLogoDial
                nodes={nodes}
                selectedId={selected.id}
                initialAngle={selected.targetAngle}
                interactive={interactive}
                wheelRef={interactive ? dayWheelRef : nightWheelRef}
                onDialPointerDown={handleDialPointerDown}
                onDialPointerMove={handleDialPointerMove}
                onDialPointerEnd={handleDialPointerEnd}
                onStep={stepNode}
                onSelect={(id) => selectNode(id, true)}
              />
              <HolidayLogoBadge
                id={selected.id}
                name={selected.name}
                theme={selected.theme}
                night={isNight}
                dayPart={dayPart}
                motion={motion}
                armed={slingArmed}
                interactive={interactive}
                coreRef={interactive ? coreMeasureRef : undefined}
                carrierRef={interactive ? dayCarrierRef : nightCarrierRef}
                slingPathRef={interactive ? daySlingPathRef : nightSlingPathRef}
                onCarrierPointerDown={handleCarrierPointerDown}
                onCarrierPointerMove={handleCarrierPointerMove}
                onCarrierPointerEnd={handleCarrierPointerEnd}
                onLaunchClick={() => fireSlingshot(selected.id)}
              />
            </div>
            <p data-logo-stage-hint>
              {slingArmed
                ? "已蓄力，松手发射至顶部导航栏 ↑"
                : "转动星盘拨历 · 向下拉动中心徽章弹射换标"}
            </p>
          </div>

          <aside data-logo-col="right" aria-label={interactive ? "二十四星位索引" : undefined}>
            <div data-constellation-half>{topNodes.map(renderNodeBtn)}</div>
            <div data-constellation-half>{bottomNodes.map(renderNodeBtn)}</div>
          </aside>
        </div>
      </section>
    );
  }

  return (
    <div
      ref={stageRef}
      data-logo-gallery
      data-instant={!motion}
      data-paused={!motion}
      data-season={selected.season}
    >
      {renderPlane("night")}
      {renderPlane("day")}

      <div
        ref={horizonBarRef}
        data-logo-horizon
        role="slider"
        tabIndex={0}
        aria-label="昼夜颠倒地平线"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={horizonPct}
        aria-valuetext={`昼 ${horizonPct}%，夜 ${100 - horizonPct}%`}
        onKeyDown={handleHorizonKeyDown}
        onDoubleClick={() => snapHorizon("half")}
      >
        <div
          data-horizon-hit="left"
          onPointerDown={handleHorizonPointerDown}
          onPointerMove={handleHorizonPointerMove}
          onPointerUp={handleHorizonPointerEnd}
          onPointerCancel={handleHorizonPointerEnd}
          onLostPointerCapture={handleHorizonPointerEnd}
        />
        <div
          data-horizon-hit="right"
          onPointerDown={handleHorizonPointerDown}
          onPointerMove={handleHorizonPointerMove}
          onPointerUp={handleHorizonPointerEnd}
          onPointerCancel={handleHorizonPointerEnd}
          onLostPointerCapture={handleHorizonPointerEnd}
        />
        <div data-horizon-line aria-hidden="true" />
        <button
          type="button"
          data-horizon-handle="left"
          tabIndex={-1}
          onPointerDown={handleHorizonPointerDown}
          onPointerMove={handleHorizonPointerMove}
          onPointerUp={handleHorizonPointerEnd}
          onPointerCancel={handleHorizonPointerEnd}
          onLostPointerCapture={handleHorizonPointerEnd}
        >
          <span data-horizon-pip aria-hidden="true" />
          <span ref={horizonReadoutRef}>
            昼 {horizonPct}% · 夜 {100 - horizonPct}%
          </span>
        </button>
        <button
          type="button"
          data-horizon-handle="right"
          tabIndex={-1}
          onPointerDown={handleHorizonPointerDown}
          onPointerMove={handleHorizonPointerMove}
          onPointerUp={handleHorizonPointerEnd}
          onPointerCancel={handleHorizonPointerEnd}
          onLostPointerCapture={handleHorizonPointerEnd}
        >
          <ArrowsOutLineVerticalIcon aria-hidden="true" size={13} />
          <span>拖动地平线</span>
        </button>
      </div>

      <p className="sr-only" role="status">
        {notice}
      </p>
    </div>
  );
}
