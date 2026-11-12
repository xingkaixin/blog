import { holidayDateAt, holidayOn } from "./holiday-logo-calendar";
import { holidayLogoUrl, type HolidayLogoId } from "./holiday-logos";

export function previewHolidayLogo(id: HolidayLogoId | null): void {
  const brand = document.querySelector<HTMLElement>("[data-site-brand]");
  if (!brand) {
    return;
  }
  if (id) {
    brand.dataset.logoPreview = id;
  } else {
    delete brand.dataset.logoPreview;
  }
  refreshHolidayLogo();
}

export function refreshHolidayLogo(): void {
  const brand = document.querySelector<HTMLElement>("[data-site-brand]");
  if (!brand) {
    return;
  }
  const id =
    (brand.dataset.logoPreview as HolidayLogoId | undefined) ?? holidayOn(holidayDateAt())?.id;
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
