import { ArrowLeftIcon } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { ArrowsOutSimpleIcon } from "@phosphor-icons/react/dist/csr/ArrowsOutSimple";
import { FlaskIcon } from "@phosphor-icons/react/dist/csr/Flask";
import { MoonStarsIcon } from "@phosphor-icons/react/dist/csr/MoonStars";
import { PauseIcon } from "@phosphor-icons/react/dist/csr/Pause";
import { PlayIcon } from "@phosphor-icons/react/dist/csr/Play";
import { ShuffleIcon } from "@phosphor-icons/react/dist/csr/Shuffle";
import { SpeakerHighIcon } from "@phosphor-icons/react/dist/csr/SpeakerHigh";
import { SpeakerSlashIcon } from "@phosphor-icons/react/dist/csr/SpeakerSlash";
import { StackIcon } from "@phosphor-icons/react/dist/csr/Stack";
import { SunIcon } from "@phosphor-icons/react/dist/csr/Sun";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { HolidayLogoBadge } from "@/components/holiday-logo-badge";
import { HolidayLogoDial } from "@/components/holiday-logo-dial";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { previewHolidayLogo } from "@/lib/holiday-logo-browser";
import { holidayDateAt, holidayEvents, type HolidayLogoEvent } from "@/lib/holiday-logo-calendar";
import {
  holidayLogos,
  holidayLogoUrl,
  type HolidayLogoGroup,
  type HolidayLogoId,
} from "@/lib/holiday-logos";
import { THEME_TOGGLE_EVENT } from "@/lib/site-events";
import "./holiday-logo-gallery.css";

const filters: { id: "all" | HolidayLogoGroup; name: string }[] = [
  { id: "all", name: "全部" },
  { id: "season", name: "四季" },
  { id: "traditional", name: "传统节日" },
  { id: "holiday", name: "节日与纪念日" },
  { id: "personal", name: "家人的日子" },
];

function nextEvent(events: HolidayLogoEvent[], today: string) {
  return events.find(({ date }) => date >= today) ?? events[0];
}

function IconButton({
  label,
  children,
  onClick,
  disabled = false,
}: {
  label: string;
  children: ReactNode;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      className="size-10 shrink-0 rounded-full p-0"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </Button>
  );
}

export function HolidayLogoGallery({
  initialToday,
  configuredYears,
}: {
  initialToday: string;
  configuredYears: string[];
}) {
  const [today, setToday] = useState(initialToday);
  const [year, setYear] = useState(initialToday.slice(0, 4));
  const [selectedId, setSelectedId] = useState<HolidayLogoId>(
    () => nextEvent(holidayEvents(year), today)?.id ?? holidayLogos[0].id,
  );
  const [filter, setFilter] = useState<(typeof filters)[number]["id"]>("all");
  const [headerPreview, setHeaderPreview] = useState(false);
  const [open, setOpen] = useState(false);
  const [animate, setAnimate] = useState(false);
  const [dark, setDark] = useState(false);
  const [exploded, setExploded] = useState(false);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [sound, setSound] = useState(false);
  const [audioAvailable, setAudioAvailable] = useState(false);
  const [notice, setNotice] = useState("");
  const stageRef = useRef<HTMLElement>(null);
  const beamRef = useRef<HTMLSpanElement>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const events = holidayEvents(year);
  const selected = events.find(({ id }) => id === selectedId) ?? events[0];
  const selectedIndex = events.findIndex(({ id }) => id === selected?.id);
  const upcoming = nextEvent(events, today);
  const years = Array.from(new Set([...configuredYears, today.slice(0, 4)])).toSorted();
  const visible = events.filter((item) => filter === "all" || item.group === filter);
  const counter = `${String(selectedIndex + 1).padStart(2, "0")} / ${events.length}`;
  const motion = !paused && !reducedMotion;
  const month = Number(selected?.date.slice(5, 7));
  const season =
    month >= 3 && month <= 5
      ? "spring"
      : month >= 6 && month <= 8
        ? "summer"
        : month >= 9 && month <= 11
          ? "autumn"
          : "winter";
  const atmosphere =
    selected?.group === "personal" || ["newyear", "spring", "eve"].some((id) => id === selected?.id)
      ? "celebration"
      : selected?.id === "programmer"
        ? "code"
        : season;

  useEffect(() => {
    const current = holidayDateAt();
    setToday(current);
    setYear(current.slice(0, 4));
    setSelectedId(nextEvent(holidayEvents(current.slice(0, 4)), current)?.id ?? holidayLogos[0].id);
    const syncTheme = () => setDark(document.documentElement.dataset.theme === "dark");
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => setReducedMotion(preference.matches);
    syncMotion();
    preference.addEventListener("change", syncMotion);
    const syncAnimation = (event: Event) =>
      setAnimate((event as CustomEvent<{ animate?: boolean }>).detail?.animate !== false);
    window.addEventListener(THEME_TOGGLE_EVENT, syncAnimation);
    setAudioAvailable("AudioContext" in window);
    return () => {
      observer.disconnect();
      preference.removeEventListener("change", syncMotion);
      window.removeEventListener(THEME_TOGGLE_EVENT, syncAnimation);
      void audioRef.current?.close();
    };
  }, []);

  useEffect(() => {
    previewHolidayLogo(headerPreview ? selectedId : null);
    return () => previewHolidayLogo(null);
  }, [headerPreview, selectedId]);

  useEffect(() => {
    if (!motion) {
      beamRef.current?.getAnimations().forEach((animation) => animation.cancel());
    }
  }, [motion]);

  function playSound(kind: "tap" | "tick") {
    if (!sound) {
      return;
    }
    try {
      const context = (audioRef.current ??= new AudioContext());
      void context.resume().catch(() => {
        setSound(false);
      });
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const now = context.currentTime;
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(kind === "tap" ? 190 : 720, now);
      oscillator.frequency.exponentialRampToValueAtTime(kind === "tap" ? 55 : 420, now + 0.065);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(kind === "tap" ? 0.18 : 0.045, now + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.1);
      oscillator.addEventListener(
        "ended",
        () => {
          oscillator.disconnect();
          gain.disconnect();
        },
        { once: true },
      );
    } catch {
      setSound(false);
      setAudioAvailable(false);
      setNotice("当前浏览器无法播放音效。");
    }
  }

  function select(id: HolidayLogoId, animated: boolean) {
    setAnimate(animated);
    if (id !== selectedId) {
      setSelectedId(id);
      playSound("tick");
    }
  }

  function move(offset: number, animated: boolean) {
    const item = events[(selectedIndex + offset + events.length) % events.length];
    if (item) {
      select(item.id, animated);
    }
  }

  function changeTheme(animated: boolean) {
    playSound("tick");
    window.dispatchEvent(new CustomEvent(THEME_TOGGLE_EVENT, { detail: { animate: animated } }));
  }

  function project(event: MouseEvent<HTMLButtonElement>) {
    setHeaderPreview(!headerPreview);
    playSound("tick");
    const badge = stageRef.current?.querySelector("[data-logo-badge]")?.getBoundingClientRect();
    const brand = document.querySelector("[data-site-brand]")?.getBoundingClientRect();
    if (headerPreview || !motion || event.detail === 0 || !badge || !brand) {
      return;
    }
    const x = badge.x + badge.width / 2;
    const y = badge.y + badge.height / 2;
    const dx = brand.x + brand.width / 2 - x;
    const dy = brand.y + brand.height / 2 - y;
    const transform = `translate(${x}px, ${y}px) rotate(${Math.atan2(dy, dx)}rad)`;
    beamRef.current?.getAnimations().forEach((animation) => animation.cancel());
    beamRef.current?.animate(
      [
        { transform: `${transform} scaleX(1)`, opacity: 0 },
        { transform: `${transform} scaleX(${Math.hypot(dx, dy)})`, opacity: 0.8, offset: 0.5 },
        { transform: `${transform} scaleX(${Math.hypot(dx, dy)})`, opacity: 0 },
      ],
      { duration: 500, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
  }

  const yearSelect = (
    <label>
      <span className="sr-only">展示年份</span>
      <select
        aria-label="展示年份"
        value={year}
        onChange={(event) => {
          const nextYear = event.currentTarget.value;
          const next = holidayEvents(nextYear);
          setYear(nextYear);
          select(
            next.find(({ id }) => id === selectedId)?.id ?? next[0]?.id ?? holidayLogos[0].id,
            false,
          );
        }}
      >
        {years.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
    </label>
  );

  if (!selected || !upcoming) {
    return (
      <div data-logo-gallery>
        <h1>节日 Logo 工坊</h1>
        {yearSelect}
        <p>这一年还没有节日日期。</p>
      </div>
    );
  }

  const navigation = (detail: boolean) => (
    <div data-logo-navigation={detail ? "detail" : "stage"}>
      <IconButton
        label={detail ? "查看上一款" : "上一款 Logo"}
        disabled={events.length < 2}
        onClick={(event) => move(-1, event.detail > 0)}
      >
        <ArrowLeftIcon aria-hidden="true" size={17} />
      </IconButton>
      <span>{counter}</span>
      <IconButton
        label={detail ? "查看下一款" : "下一款 Logo"}
        disabled={events.length < 2}
        onClick={(event) => move(1, event.detail > 0)}
      >
        <ArrowRightIcon aria-hidden="true" size={17} />
      </IconButton>
    </div>
  );

  return (
    <div
      data-logo-gallery
      data-season={season}
      data-instant={!animate}
      data-paused={!motion}
      onKeyDownCapture={() => setAnimate(false)}
      onPointerDownCapture={() => setAnimate(true)}
    >
      <header data-logo-heading>
        <div>
          <button
            type="button"
            data-logo-breadcrumb
            onClick={() => {
              void import("@/lib/search-launcher")
                .then(({ openSearch }) => openSearch())
                .catch((error) => console.error("加载命令面板失败", error));
            }}
          >
            <FlaskIcon aria-hidden="true" size={15} />
            实验
          </button>
          <h1>节日 Logo 工坊</h1>
          <p>按一按，翻个面，拆开看看。</p>
        </div>
        <div data-logo-settings>
          <Button
            type="button"
            variant="ghost"
            aria-label={sound ? "关闭音效" : "开启音效"}
            aria-pressed={sound}
            disabled={!audioAvailable}
            onClick={() => setSound(!sound)}
          >
            {sound ? (
              <SpeakerHighIcon aria-hidden="true" size={17} />
            ) : (
              <SpeakerSlashIcon aria-hidden="true" size={17} />
            )}
            音效
          </Button>
          <Button
            type="button"
            variant="ghost"
            aria-label={paused ? "恢复动效" : "暂停动效"}
            aria-pressed={paused}
            onClick={() => setPaused(!paused)}
          >
            {paused ? (
              <PlayIcon aria-hidden="true" size={17} />
            ) : (
              <PauseIcon aria-hidden="true" size={17} />
            )}
            {paused ? "播放" : "静止"}
          </Button>
        </div>
      </header>

      <section data-logo-workbench ref={stageRef} aria-label="Logo 互动实验台">
        <div data-logo-atmosphere={atmosphere} aria-hidden="true">
          {Array.from({ length: 12 }, (_, index) => (
            <i
              key={index}
              style={{
                left: `${(index * 37 + 7) % 100}%`,
                animationDelay: `${-(index * 1.3)}s`,
                animationDuration: `${6 + (index % 5)}s`,
              }}
            >
              {atmosphere === "code" ? (index % 2 ? "1" : "0") : ""}
            </i>
          ))}
        </div>
        <div data-logo-arena>
          <HolidayLogoDial events={events} selectedIndex={selectedIndex} onSelect={select} />
          <HolidayLogoBadge
            id={selected.id}
            name={selected.name}
            dark={dark}
            exploded={exploded}
            motion={motion}
            animated={animate}
            onStamp={() => {
              playSound("tap");
              setNotice(`${selected.name}，盖章成功。`);
            }}
          />
          <p data-logo-gesture-hint>点击徽章敲一下 · 拖动外圈换个日子</p>
        </div>
        <div data-logo-console>
          <div data-logo-stage-heading>
            <time dateTime={selected.date}>{selected.date.replaceAll("-", ".")}</time>
            {yearSelect}
          </div>
          <div data-logo-caption>
            <h2 aria-live="polite">{selected.name}</h2>
            <IconButton label="放大查看当前 Logo" onClick={() => setOpen(true)}>
              <ArrowsOutSimpleIcon aria-hidden="true" size={18} />
            </IconButton>
          </div>
          <p data-logo-theme>{selected.theme}</p>
          <p data-logo-description>{selected.description}</p>
          <div data-logo-controls>
            <Button
              type="button"
              variant="secondary"
              aria-pressed={exploded}
              onClick={() => {
                setExploded(!exploded);
                playSound("tick");
              }}
            >
              <StackIcon aria-hidden="true" size={17} />
              {exploded ? "组装回去" : "拆开看看"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              aria-pressed={dark}
              onClick={(event) => changeTheme(event.detail > 0)}
            >
              {dark ? (
                <SunIcon aria-hidden="true" size={17} />
              ) : (
                <MoonStarsIcon aria-hidden="true" size={17} />
              )}
              翻转昼夜
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={events.length < 2}
              onClick={(event) =>
                select(
                  events[
                    (selectedIndex + 1 + Math.floor(Math.random() * (events.length - 1))) %
                      events.length
                  ].id,
                  event.detail > 0,
                )
              }
            >
              <ShuffleIcon aria-hidden="true" size={17} />
              随机一枚
            </Button>
            <Button
              type="button"
              variant="secondary"
              aria-pressed={headerPreview}
              onClick={project}
            >
              <span data-logo-project-icon aria-hidden="true">
                ↗
              </span>
              {headerPreview ? "结束投影" : "投到页眉"}
            </Button>
          </div>
          <div data-logo-console-footer>
            {navigation(false)}
            <button
              type="button"
              data-logo-upcoming
              onClick={(event) => select(upcoming.id, event.detail > 0)}
            >
              <span>{upcoming.date >= today ? "下一次" : "从年初看"}</span>
              <span>{upcoming.name}</span>
              <time dateTime={upcoming.date}>{upcoming.date.slice(5).replace("-", ".")}</time>
            </button>
          </div>
        </div>
      </section>

      <section data-logo-collection aria-label="节日 Logo 收藏架">
        <div data-logo-collection-heading>
          <h2>收藏架</h2>
          <span>{events.length} 枚，随便挑一枚玩</span>
        </div>
        <div data-logo-toolbar>
          <div data-logo-filters aria-label="Logo 分类">
            {filters.map((item) => (
              <button
                type="button"
                key={item.id}
                aria-pressed={item.id === filter}
                onClick={() => setFilter(item.id)}
              >
                {item.name}
              </button>
            ))}
          </div>
          <span data-logo-collection-count>
            {visible.length} / {events.length}
          </span>
        </div>
        <div data-logo-grid>
          {visible.map((item) => (
            <button
              type="button"
              key={item.id}
              data-logo-card
              aria-pressed={item.id === selected.id}
              aria-label={`把${item.name}放到实验台`}
              onClick={(event) => {
                select(item.id, event.detail > 0);
                if (stageRef.current && stageRef.current.getBoundingClientRect().top < 0) {
                  stageRef.current.scrollIntoView({
                    behavior: motion && event.detail > 0 ? "smooth" : "instant",
                    block: "start",
                  });
                }
              }}
            >
              <span data-logo-card-number>{String(events.indexOf(item) + 1).padStart(2, "0")}</span>
              <span data-logo-card-art>
                <img
                  src={holidayLogoUrl(item.id, dark)}
                  alt=""
                  width={140}
                  height={140}
                  loading="lazy"
                  draggable={false}
                />
              </span>
              <span data-logo-card-info>
                <span>{item.name}</span>
                <time dateTime={item.date}>{item.date.slice(5).replace("-", ".")}</time>
              </span>
            </button>
          ))}
        </div>
      </section>
      <span data-logo-projection ref={beamRef} aria-hidden="true" />
      <p className="sr-only" role="status">
        {notice}
      </p>

      <Dialog
        open={open}
        onOpenChange={(value, details) => {
          setAnimate(details.reason !== "escape-key");
          setOpen(value);
        }}
      >
        <DialogContent
          title={`${selected.name} Logo`}
          description={selected.description}
          data-logo-detail
          data-instant={!animate || !motion}
          className="w-[min(740px,calc(100vw-2rem))] p-0"
          onPointerDownCapture={() => setAnimate(true)}
          onKeyDownCapture={(event) => {
            setAnimate(false);
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
              event.preventDefault();
              move(event.key === "ArrowLeft" ? -1 : 1, false);
            }
          }}
        >
          <button
            type="button"
            data-logo-close
            aria-label="关闭 Logo 预览"
            onClick={() => setOpen(false)}
          >
            <XIcon aria-hidden="true" size={18} />
          </button>
          <div data-logo-detail-layout>
            <div data-logo-detail-stage>
              <img
                key={selected.id}
                data-logo-detail-art
                src={holidayLogoUrl(selected.id, dark)}
                alt={`${selected.name}，${selected.theme}`}
                width={260}
                height={260}
              />
              <div data-logo-theme-pair>
                {[false, true].map((night) => (
                  <button
                    type="button"
                    key={String(night)}
                    aria-pressed={night === dark}
                    onClick={(event) => {
                      if (night !== dark) {
                        changeTheme(event.detail > 0);
                      }
                    }}
                  >
                    {night ? "颠倒世界" : "白天"}
                  </button>
                ))}
              </div>
              {navigation(true)}
            </div>
            <div data-logo-detail-copy>
              <time dateTime={selected.date}>{selected.date.replaceAll("-", ".")}</time>
              <h2>{selected.name}</h2>
              <p data-logo-rule>{selected.rule}</p>
              <p data-logo-description>{selected.description}</p>
              <div data-logo-sample>
                <img
                  src={holidayLogoUrl(selected.id, dark)}
                  width={28}
                  height={28}
                  alt="导航栏尺寸预览"
                />
                <span>xingkaixin.me</span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
