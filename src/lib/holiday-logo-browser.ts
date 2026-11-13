import { dayPartAt, type DayPart } from "./day-part";
import { holidayDateAt, holidayOn } from "./holiday-logo-calendar";
import { holidayLogoUrl, type HolidayLogoId } from "./holiday-logos";

export type LogoPreviewTarget = HolidayLogoId | "seal" | null;

export function refreshSiteBrandDayPart(now = new Date()): void {
  const brand = document.querySelector<HTMLElement>("[data-site-brand]");
  if (!brand) {
    return;
  }
  brand.dataset.dayPart = brand.dataset.dayPartPreview ?? dayPartAt(now);
}

export function previewHolidayLogo(target: LogoPreviewTarget, dayPart?: DayPart | null): void {
  const brand = document.querySelector<HTMLElement>("[data-site-brand]");
  if (!brand) {
    return;
  }
  if (target === null) {
    delete brand.dataset.logoPreview;
    delete brand.dataset.dayPartPreview;
  } else if (target === "seal") {
    brand.dataset.logoPreview = "seal";
    if (dayPart) {
      brand.dataset.dayPartPreview = dayPart;
    } else {
      delete brand.dataset.dayPartPreview;
    }
  } else {
    brand.dataset.logoPreview = target;
    delete brand.dataset.dayPartPreview;
  }
  refreshHolidayLogo();
}

export function refreshHolidayLogo(): void {
  refreshSiteBrandDayPart();
  const brand = document.querySelector<HTMLElement>("[data-site-brand]");
  if (!brand) {
    return;
  }
  const preview = brand.dataset.logoPreview;
  const id =
    preview === "seal"
      ? undefined
      : ((preview as HolidayLogoId | undefined) ?? holidayOn(holidayDateAt())?.id);
  brand.toggleAttribute("data-holiday-active", Boolean(id));
  if (!id) {
    return;
  }
  brand.querySelectorAll<HTMLImageElement>("[data-holiday-art]").forEach((image) => {
    const url = holidayLogoUrl(id, image.dataset.holidayArt === "dark");
    if (image.getAttribute("src") !== url) {
      image.src = url;
    }
  });
}
