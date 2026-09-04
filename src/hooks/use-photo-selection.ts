import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import type { PhotoRecord } from "@/lib/photo-catalog";
import { resolvePhotoSelection } from "@/lib/photo-catalog-browser";

export type PhotoSelectionState =
  | { status: "idle" }
  | { status: "loading"; photoId: string }
  | { status: "ready"; photo: PhotoRecord }
  | { status: "error"; photoId: string; message: string };

type UsePhotoSelectionOptions = {
  catalogReady: boolean;
  photoId: string | null | undefined;
  resolvePhoto: (photoId: string) => Promise<PhotoRecord | null>;
  onMissing: () => void;
};

export function usePhotoSelection({
  catalogReady,
  photoId,
  resolvePhoto,
  onMissing,
}: UsePhotoSelectionOptions) {
  const [state, setState] = useState<PhotoSelectionState>({ status: "idle" });
  const [retryCount, setRetryCount] = useState(0);
  const lastPhotoRef = useRef<PhotoRecord | null>(null);
  const selectionResolverRef = useRef<typeof resolvePhoto | null>(null);
  const resolutionGenerationRef = useRef(0);
  const isSelected = useEffectEvent(
    (id: string) => state.status === "ready" && state.photo.id === id,
  );

  useEffect(() => {
    if (!catalogReady) {
      setState({ status: "idle" });
      return undefined;
    }
    if (photoId === undefined) {
      return undefined;
    }
    if (photoId === null) {
      setState({ status: "idle" });
      return undefined;
    }

    // 解析器绑定当前 Catalog，旧 Catalog 的选中结果不能跳过重新定位。
    if (selectionResolverRef.current === resolvePhoto && isSelected(photoId)) {
      return undefined;
    }
    const generation = resolutionGenerationRef.current + 1;
    resolutionGenerationRef.current = generation;
    setState({ status: "loading", photoId });

    void resolvePhotoSelection(photoId, resolvePhoto).then((result) => {
      if (resolutionGenerationRef.current !== generation) {
        return;
      }
      if (result.status === "error") {
        console.error(`定位照片 ${photoId} 失败`, result.cause);
        setState({ status: "error", photoId, message: result.message });
        return;
      }
      if (result.status === "missing") {
        setState({ status: "idle" });
        onMissing();
        return;
      }
      lastPhotoRef.current = result.photo;
      selectionResolverRef.current = resolvePhoto;
      setState({ status: "ready", photo: result.photo });
    });

    return () => {
      if (resolutionGenerationRef.current === generation) {
        resolutionGenerationRef.current += 1;
      }
    };
  }, [catalogReady, onMissing, photoId, resolvePhoto, retryCount]);

  const select = useCallback(
    (photo: PhotoRecord) => {
      resolutionGenerationRef.current += 1;
      lastPhotoRef.current = photo;
      selectionResolverRef.current = resolvePhoto;
      setState({ status: "ready", photo });
    },
    [resolvePhoto],
  );

  const dismiss = useCallback(() => {
    resolutionGenerationRef.current += 1;
    setState({ status: "idle" });
  }, []);

  const retry = useCallback(() => {
    setRetryCount((current) => current + 1);
  }, []);

  const selectedPhoto = state.status === "ready" ? state.photo : null;
  return {
    state,
    selectedPhoto,
    displayPhoto: selectedPhoto ?? lastPhotoRef.current,
    select,
    dismiss,
    retry,
  };
}
