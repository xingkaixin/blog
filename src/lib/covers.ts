import coverData from "./generated/covers.json";

export type ResponsiveCover = {
  full: string;
  desktop: string;
  mobile: string;
};

const covers: Record<string, ResponsiveCover> = coverData;

export function resolveCover(assetPath: string): ResponsiveCover | null {
  const filename = assetPath.split("/").pop();
  return filename ? (covers[filename] ?? null) : null;
}
