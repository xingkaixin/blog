import postImageData from "./generated/post-images.json";

export type ResponsivePostImage = {
  src: string;
  webp: string;
  mobile: string;
  desktop: string;
};

const postImages: Record<string, ResponsivePostImage> = postImageData;

export function resolvePostImage(sourceUrl: string): ResponsivePostImage | null {
  return postImages[sourceUrl] ?? null;
}
