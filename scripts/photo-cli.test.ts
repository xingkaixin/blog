import { describe, expect, it, vi } from "vitest";
import {
  parsePhotoCliArguments,
  runPhotoCli,
  type PhotoCliIo,
  type PhotoCliProcessor,
} from "./lib/photo-cli";

describe("photo CLI", () => {
  it("makes orphan scans explicit and exclusive to garbage collection", () => {
    expect(parsePhotoCliArguments("gc", ["--confirm", "--scan"])).toMatchObject({
      scan: true,
      confirm: true,
    });
    expect(parsePhotoCliArguments("gc", ["--confirm"])).toMatchObject({ scan: false });
    expect(() => parsePhotoCliArguments("publish", ["--scan"])).toThrow("未知选项");
  });
  it("parses publish options into one explicit command state", () => {
    expect(
      parsePhotoCliArguments("publish", [
        "photos",
        "--album",
        "japan-2026",
        "--album-title",
        "日本旅行",
        "--timezone",
        "Asia/Tokyo",
        "--output",
        "preview",
      ]),
    ).toEqual({
      command: "publish",
      inputs: ["photos"],
      output: "preview",
      album: { id: "japan-2026", title: "日本旅行" },
      timezone: "Asia/Tokyo",
      help: false,
    });
  });

  it("keeps command-specific flags out of other commands", () => {
    expect(() => parsePhotoCliArguments("delete", ["photo.jpg", "--album", "trip"])).toThrow(
      "未知选项 --album",
    );
    expect(() => parsePhotoCliArguments("gc", ["photo.jpg", "--confirm"])).toThrow(
      "不接受位置参数",
    );
    expect(parsePhotoCliArguments("delete", ["--confirm", "--", "-photo.jpg"])).toMatchObject({
      command: "delete",
      inputs: ["-photo.jpg"],
      confirm: true,
    });
    expect(parsePhotoCliArguments("migrate", ["--confirm", "--output", "preview"])).toEqual({
      command: "migrate",
      output: "preview",
      confirm: true,
      help: false,
    });
  });

  it("validates dependent and missing option values", () => {
    expect(() => parsePhotoCliArguments("publish", ["--album-title", "旅行"])).toThrow(
      "必须与 --album 一起使用",
    );
    expect(() => parsePhotoCliArguments("publish", ["--output", "--help"])).toThrow(
      "--output 缺少参数",
    );
  });

  it("can import and run help without starting external photo work", async () => {
    const writes: string[] = [];
    const processPhoto = vi.fn<PhotoCliProcessor["process"]>();
    const closeProcessor = vi.fn(async () => undefined);
    const processor: PhotoCliProcessor = {
      process: processPhoto,
      close: closeProcessor,
    };
    const io: PhotoCliIo = {
      log: vi.fn(),
      error: vi.fn(),
      write: (message) => writes.push(message),
    };

    await runPhotoCli("publish", ["--help"], processor, io);

    expect(writes.join("")).toContain("bun run photos:publish");
    expect(processPhoto).not.toHaveBeenCalled();
    expect(closeProcessor).toHaveBeenCalledOnce();
  });
});
