import { createContext, useContext } from "react";
import type { Locale } from "@/lib/i18n";
import { photoMessages } from "@/lib/messages/photos";

export const PhotoLocaleContext = createContext<Locale>("zh");

export function usePhotoLocale(): Locale {
  return useContext(PhotoLocaleContext);
}

export function usePhotoMessages() {
  return photoMessages[usePhotoLocale()];
}
