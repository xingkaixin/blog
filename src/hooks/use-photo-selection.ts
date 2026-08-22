import { useCallback, useEffect, useRef, useState } from "react";
import { resolvePhotoSelection } from "@/lib/photo-browser";
import type { PhotoRecord } from "@/lib/photo-catalog";

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
  onResolved: (photo: PhotoRecord) => void;
};

export function usePhotoSelection({
  catalogReady,
  photoId,
  resolvePhoto,
  onMissing,
  onResolved,
}: UsePhotoSelectionOptions) {
  const [state, setState] = useState<PhotoSelectionState>({ status: "idle" });
  const [retryCount, setRetryCount] = useState(0);
  const lastPhotoRef = useRef<PhotoRecord | null>(null);
  const resolutionGenerationRef = useRef(0);

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

    const generation = resolutionGenerationRef.current + 1;
    resolutionGenerationRef.current = generation;
    setState((current) =>
      current.status === "ready" && current.photo.id === photoId
        ? current
        : { status: "loading", photoId },
    );

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
      setState({ status: "ready", photo: result.photo });
      onResolved(result.photo);
    });

    return () => {
      if (resolutionGenerationRef.current === generation) {
        resolutionGenerationRef.current += 1;
      }
    };
  }, [catalogReady, onMissing, onResolved, photoId, resolvePhoto, retryCount]);

  const select = useCallback((photo: PhotoRecord) => {
    resolutionGenerationRef.current += 1;
    lastPhotoRef.current = photo;
    setState({ status: "ready", photo });
  }, []);

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
