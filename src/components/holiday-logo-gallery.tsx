import { ArrowLeftIcon } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { ArrowsOutSimpleIcon } from "@phosphor-icons/react/dist/csr/ArrowsOutSimple";
import { FlaskIcon } from "@phosphor-icons/react/dist/csr/Flask";
import { ShuffleIcon } from "@phosphor-icons/react/dist/csr/Shuffle";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
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

function randomLogo(events: HolidayLogoEvent[], index: number): HolidayLogoId {
  const offset = 1 + Math.floor(Math.random() * (events.length - 1));
  return events[(index + offset) % events.length].id;
}

function ArtLayers({
  events,
  selectedId,
  dark,
}: {
  events: HolidayLogoEvent[];
  selectedId: HolidayLogoId;
  dark: boolean;
}) {
  const selectedIndex = events.findIndex(({ id }) => id === selectedId);
  return events.map((item, index) => (
    <img
      key={item.id}
      data-logo-layer
      data-position={
        index === selectedIndex ? "active" : index < selectedIndex ? "before" : "after"
      }
      src={holidayLogoUrl(item.id, dark)}
      width={260}
      height={260}
      alt=""
      draggable={false}
    />
  ));
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
      variant="secondary"
      className="size-8 shrink-0 rounded-full p-0"
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
  const filtersRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const events = holidayEvents(year);
  const selected = events.find(({ id }) => id === selectedId) ?? events[0];
  const selectedIndex = events.findIndex(({ id }) => id === selected?.id);
  const upcoming = nextEvent(events, today);
  const years = Array.from(new Set([...configuredYears, today.slice(0, 4)])).toSorted();
  const visible = events.filter((item) => filter === "all" || item.group === filter);
  const counter = `${String(selectedIndex + 1).padStart(2, "0")} / ${events.length}`;

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
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    previewHolidayLogo(headerPreview ? selectedId : null);
    return () => previewHolidayLogo(null);
  }, [headerPreview, selectedId]);

  useEffect(() => {
    const container = filtersRef.current;
    const button = container?.querySelector<HTMLElement>('[aria-pressed="true"]');
    const indicator = indicatorRef.current;
    if (!container || !button || !indicator) {
      return undefined;
    }
    const position = () => {
      indicator.style.transform = `translateX(${button.offsetLeft}px) scaleX(${button.offsetWidth})`;
    };
    position();
    const observer = new ResizeObserver(position);
    observer.observe(button);
    observer.observe(container);
    return () => observer.disconnect();
  }, [filter]);

  function select(id: HolidayLogoId, animated: boolean) {
    setAnimate(animated);
    setSelectedId(id);
  }

  function move(offset: number, animated: boolean) {
    const item = events[selectedIndex + offset];
    if (item) {
      select(item.id, animated);
    }
  }

  function changeTheme(animated: boolean) {
    window.dispatchEvent(new CustomEvent(THEME_TOGGLE_EVENT, { detail: { animate: animated } }));
  }

  function shuffle(event: MouseEvent<HTMLButtonElement>) {
    select(randomLogo(events, selectedIndex), event.detail > 0);
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
        <h1>节日 Logo</h1>
        {yearSelect}
        <p className="mt-8 text-ink-500">这一年还没有节日日期。</p>
      </div>
    );
  }

  const navigation = (detail: boolean) => (
    <div data-logo-navigation={detail ? "detail" : "stage"}>
      <IconButton
        label={detail ? "查看上一款" : "上一款 Logo"}
        disabled={selectedIndex === 0}
        onClick={(event) => move(-1, event.detail > 0)}
      >
        <ArrowLeftIcon aria-hidden="true" size={14} />
      </IconButton>
      {detail ? (
        <span>{counter}</span>
      ) : (
        <input
          type="range"
          min={0}
          max={events.length - 1}
          step={1}
          value={selectedIndex}
          aria-label="浏览全年 Logo"
          aria-valuetext={`${selected.name}，${selected.date}`}
          style={{
            backgroundSize: `${(selectedIndex / Math.max(1, events.length - 1)) * 100}% 2px, 100% 2px`,
          }}
          onChange={(event) => select(events[Number(event.currentTarget.value)].id, false)}
        />
      )}
      <IconButton
        label={detail ? "查看下一款" : "下一款 Logo"}
        disabled={selectedIndex === events.length - 1}
        onClick={(event) => move(1, event.detail > 0)}
      >
        <ArrowRightIcon aria-hidden="true" size={14} />
      </IconButton>
    </div>
  );

  return (
    <div
      data-logo-gallery
      data-instant={!animate}
      onKeyDownCapture={() => setAnimate(false)}
      onPointerDownCapture={() => setAnimate(true)}
    >
      <section data-logo-hero>
        <div data-logo-copy>
          <button
            type="button"
            data-logo-breadcrumb
            onClick={() => {
              void import("@/lib/search-launcher")
                .then(({ openSearch }) => openSearch())
                .catch((error) => console.error("加载命令面板失败", error));
            }}
          >
            <FlaskIcon aria-hidden="true" size={14} />
            实验
          </button>
          <h1>节日 Logo</h1>
          <p>
            网站会在节日、节气和家人的生日换上对应的
            Logo。这里收集了这些变体，也介绍每个日子的意义。
          </p>
          <div data-logo-actions>
            <Button variant="secondary" onClick={shuffle}>
              <ShuffleIcon aria-hidden="true" size={15} />
              随机一枚
            </Button>
            <Button
              variant="secondary"
              aria-pressed={headerPreview}
              onClick={() => setHeaderPreview(!headerPreview)}
            >
              {headerPreview ? "结束页眉预览" : "在页眉预览"}
              <span aria-hidden="true">{headerPreview ? "×" : "↗"}</span>
            </Button>
          </div>
          <button
            type="button"
            data-logo-upcoming
            onClick={(event) => select(upcoming.id, event.detail > 0)}
          >
            <span>{upcoming.date >= today ? "下一次" : "从年初看"}</span>
            <time dateTime={upcoming.date}>{upcoming.date.slice(5).replace("-", ".")}</time>
            <span>{upcoming.name}</span>
            <span aria-hidden="true">→</span>
          </button>
        </div>
        <div data-logo-playground>
          <div data-logo-stage-heading>
            <time dateTime={selected.date}>{selected.date.slice(5).replace("-", ".")}</time>
            <span>{counter}</span>
          </div>
          <button
            type="button"
            data-logo-flip
            aria-label={`${selected.name} Logo，点击查看${dark ? "白天" : "颠倒世界"}`}
            aria-pressed={dark}
            onClick={(event) => changeTheme(event.detail > 0)}
          >
            <span data-logo-rotor>
              <span data-logo-face="light" aria-hidden="true">
                <ArtLayers events={events} selectedId={selected.id} dark={false} />
              </span>
              <span data-logo-face="dark" aria-hidden="true">
                <ArtLayers events={events} selectedId={selected.id} dark />
              </span>
            </span>
          </button>
          <div data-logo-caption>
            <div>
              <h2 aria-live="polite">{selected.name}</h2>
              <span>{selected.theme}</span>
            </div>
            <IconButton
              label="放大查看当前 Logo"
              onClick={(event) => {
                setAnimate(event.detail > 0);
                setOpen(true);
              }}
            >
              <ArrowsOutSimpleIcon aria-hidden="true" size={15} />
            </IconButton>
          </div>
          {navigation(false)}
          <p data-logo-hint>点击 Logo 翻转明暗 · 拖动滑杆浏览</p>
        </div>
      </section>
      <div data-logo-toolbar>
        <div data-logo-filters ref={filtersRef} aria-label="Logo 分类">
          {filters.map((item) => (
            <button
              type="button"
              key={item.id}
              aria-pressed={item.id === filter}
              onClick={(event) => {
                setAnimate(event.detail > 0);
                setFilter(item.id);
              }}
            >
              {item.name}
            </button>
          ))}
          <span data-logo-filter-indicator ref={indicatorRef} aria-hidden="true" />
        </div>
        {yearSelect}
      </div>
      <section data-logo-grid aria-label="节日 Logo 图集">
        {visible.map((item) => (
          <button
            type="button"
            key={item.id}
            data-logo-card
            data-selected={item.id === selected.id}
            aria-label={`查看${item.name} Logo`}
            onClick={(event) => {
              select(item.id, event.detail > 0);
              setOpen(true);
            }}
          >
            <span data-logo-card-art>
              <img
                src={holidayLogoUrl(item.id, dark)}
                alt=""
                width={140}
                height={140}
                loading="lazy"
              />
            </span>
            <span data-logo-card-info>
              <span>{item.name}</span>
              <time dateTime={item.date}>{item.date.slice(5).replace("-", ".")}</time>
            </span>
          </button>
        ))}
      </section>
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
          data-instant={!animate}
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
            onClick={(event) => {
              setAnimate(event.detail > 0);
              setOpen(false);
            }}
          >
            <XIcon aria-hidden="true" size={16} />
          </button>
          <div data-logo-detail-layout>
            <div data-logo-detail-stage>
              <div data-logo-detail-art aria-hidden="true">
                <ArtLayers events={events} selectedId={selected.id} dark={dark} />
              </div>
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
