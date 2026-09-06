import type { CSSProperties } from "react";

const backgrounds = import.meta.glob<string>("../assets/photo-backgrounds/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
});

export function photoBackgroundStyle(albumId: string | null): CSSProperties {
  const source =
    backgrounds[`../assets/photo-backgrounds/${albumId}.webp`] ??
    backgrounds["../assets/photo-backgrounds/photography.webp"];
  return { backgroundImage: source ? `url("${source}")` : undefined };
}
