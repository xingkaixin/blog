import coverData from "./generated/covers.json";

export type ResponsiveCover = {
  full: string;
  desktop: string;
  mobile: string;
  width: number;
  height: number;
};

const covers: Record<string, ResponsiveCover> = coverData;

export function resolveCover(filename: string): ResponsiveCover {
  const cover = covers[filename];
  if (!cover) {
    throw new Error(`Cover image has no generated variants: ${filename}`);
  }
  return cover;
}
