// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PhotoRecord } from "@/lib/photo-catalog";
import { usePhotoSelection } from "./use-photo-selection";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const firstPhoto: PhotoRecord = {
  id: "0123456789abcdef0123456789abcdef",
  capturedAt: "2026-04-25T21:12:30.244+07:00",
  width: 3024,
  height: 4032,
  albumIds: ["trip"],
  placeholderColor: "#4f5f6a",
};
const secondPhoto: PhotoRecord = {
  ...firstPhoto,
  id: "ffffffffffffffffffffffffffffffff",
};

type SelectionOptions = Parameters<typeof usePhotoSelection>[0];
type Selection = ReturnType<typeof usePhotoSelection>;

let root: Root;
let container: HTMLDivElement;
let selection: Selection;

function Harness(options: SelectionOptions) {
  selection = usePhotoSelection(options);
  return null;
}

async function renderSelection(options: SelectionOptions) {
  await act(async () => {
    root.render(<Harness {...options} />);
  });
}

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe("usePhotoSelection", () => {
  it("ignores an older resolution after the URL selects another photo", async () => {
    const first = deferred<PhotoRecord | null>();
    const second = deferred<PhotoRecord | null>();
    const resolvePhoto = vi.fn((photoId: string) =>
      photoId === firstPhoto.id ? first.promise : second.promise,
    );
    const onMissing = vi.fn();

    await renderSelection({
      catalogReady: true,
      photoId: firstPhoto.id,
      resolvePhoto,
      onMissing,
    });
    expect(selection.state).toEqual({ status: "loading", photoId: firstPhoto.id });

    await renderSelection({
      catalogReady: true,
      photoId: secondPhoto.id,
      resolvePhoto,
      onMissing,
    });
    await act(async () => first.resolve(firstPhoto));
    expect(selection.state).toEqual({ status: "loading", photoId: secondPhoto.id });

    await act(async () => second.resolve(secondPhoto));
    expect(selection.state).toEqual({ status: "ready", photo: secondPhoto });
  });

  it("retries the current URL selection after a recoverable failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const resolvePhoto = vi
      .fn<(photoId: string) => Promise<PhotoRecord | null>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(firstPhoto);
    const options = {
      catalogReady: true,
      photoId: firstPhoto.id,
      resolvePhoto,
      onMissing: vi.fn(),
    };

    await renderSelection(options);
    expect(selection.state).toEqual({
      status: "error",
      photoId: firstPhoto.id,
      message: "offline",
    });

    await act(async () => selection.retry());
    expect(selection.state).toEqual({ status: "ready", photo: firstPhoto });
    expect(resolvePhoto).toHaveBeenCalledTimes(2);
  });

  it("asks the location owner to remove a missing photo", async () => {
    const onMissing = vi.fn();

    await renderSelection({
      catalogReady: true,
      photoId: firstPhoto.id,
      resolvePhoto: vi.fn().mockResolvedValue(null),
      onMissing,
    });

    expect(selection.state).toEqual({ status: "idle" });
    expect(onMissing).toHaveBeenCalledOnce();
  });

  it("does not reopen after dismissal while history is still updating", async () => {
    const pending = deferred<PhotoRecord | null>();

    await renderSelection({
      catalogReady: true,
      photoId: firstPhoto.id,
      resolvePhoto: vi.fn(() => pending.promise),
      onMissing: vi.fn(),
    });
    await act(async () => selection.dismiss());
    await act(async () => pending.resolve(firstPhoto));

    expect(selection.state).toEqual({ status: "idle" });
  });

  it("keeps the last photo available while the lightbox exits", async () => {
    await renderSelection({
      catalogReady: true,
      photoId: null,
      resolvePhoto: vi.fn(),
      onMissing: vi.fn(),
    });

    await act(async () => selection.select(firstPhoto));
    expect(selection.selectedPhoto).toEqual(firstPhoto);

    await act(async () => selection.dismiss());
    expect(selection.state).toEqual({ status: "idle" });
    expect(selection.displayPhoto).toEqual(firstPhoto);
  });
});
