#!/usr/bin/env bun

import path from "node:path";
import { exiftool } from "exiftool-vendored";
import { publishPhotos, photoDisplayName, type PublishAlbum } from "./lib/photo-publisher";
import { collectPhotoFiles, processPhotoFile } from "./lib/photo-source";
import {
  createR2PhotoObjectStore,
  FilePhotoObjectStore,
  type PhotoObjectStore,
} from "./lib/photo-store";

type CliOptions = {
  inputs: string[];
  output?: string;
  album?: PublishAlbum;
  timezone?: string;
  help: boolean;
};

const HELP = `发布照片到照片墙

用法:
  bun run photos:publish -- <照片或目录...> [选项]

选项:
  --album <id>           将本次照片加入相册
  --album-title <标题>   新建或重命名相册
  --timezone <时区>      EXIF 缺少时区时使用，如 Asia/Shanghai
  --output <目录>        写入本地目录；省略时发布到 R2
  --help                 显示帮助

R2 环境变量:
  R2_ACCOUNT_ID
  R2_ACCESS_KEY_ID
  R2_SECRET_ACCESS_KEY
  R2_PHOTO_BUCKET
`;

async function main(): Promise<void> {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(HELP);
    return;
  }
  if (options.inputs.length === 0) {
    throw new Error("至少需要提供一张照片或一个目录");
  }

  const files = await collectPhotoFiles(options.inputs);
  if (files.length === 0) {
    throw new Error("输入目录中没有支持的照片");
  }

  const store = createStore(options.output);
  try {
    const result = await publishPhotos({
      files,
      store,
      album: options.album,
      processPhoto: (file, id) => processPhotoFile(file, id, exiftool, options.timezone),
      onProgress(progress) {
        if (progress.type === "processing") {
          console.log(
            `[${progress.index}/${progress.total}] 处理 ${photoDisplayName(progress.file)}`,
          );
        } else if (progress.type === "reused") {
          console.log(`复用 ${photoDisplayName(progress.file)}`);
        } else {
          console.log(`已发布 ${photoDisplayName(progress.file)} (${progress.photoId})`);
        }
      },
    });

    console.log(
      `完成：发现 ${result.discovered} 张，新增 ${result.published} 张，复用 ${result.reused} 张，更新 ${result.updatedPeriods} 个月份`,
    );
    if (!result.catalogChanged) {
      console.log("Catalog 无变化，没有写入新版本");
    }
  } finally {
    store.close?.();
    await exiftool.end();
  }
}

function createStore(output: string | undefined): PhotoObjectStore {
  if (output) {
    const directory = path.resolve(output);
    console.log(`发布目标：${directory}`);
    return new FilePhotoObjectStore(directory);
  }
  console.log("发布目标：Cloudflare R2");
  return createR2PhotoObjectStore();
}

function parseArguments(args: string[]): CliOptions {
  const inputs: string[] = [];
  let output: string | undefined;
  let albumId: string | undefined;
  let albumTitle: string | undefined;
  let timezone: string | undefined;
  let help = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--help" || argument === "-h") {
      help = true;
    } else if (argument === "--output") {
      output = readOptionValue(args, ++index, argument);
    } else if (argument === "--album") {
      albumId = readOptionValue(args, ++index, argument);
    } else if (argument === "--album-title") {
      albumTitle = readOptionValue(args, ++index, argument);
    } else if (argument === "--timezone") {
      timezone = readOptionValue(args, ++index, argument);
    } else if (argument.startsWith("--")) {
      throw new Error(`未知选项 ${argument}`);
    } else {
      inputs.push(argument);
    }
  }

  if (albumTitle && !albumId) {
    throw new Error("--album-title 必须与 --album 一起使用");
  }

  return {
    inputs,
    output,
    album: albumId ? { id: albumId, title: albumTitle } : undefined,
    timezone,
    help,
  };
}

function readOptionValue(args: string[], index: number, option: string): string {
  const value = args[index];
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} 缺少参数`);
  }
  return value;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
