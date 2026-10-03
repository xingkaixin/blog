/// <reference types="astro/client" />
/// <reference types="vite/client" />

interface Window {
  umami?: {
    track(name: string): Promise<void>;
  };
}
