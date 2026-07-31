#!/usr/bin/env bun

import path from "node:path";
import { deletePhotos } from "./lib/photo-publisher";
import { collectPhotoFiles, hashPhotoFile } from "./lib/photo-source";
import {
  createR2PhotoObjectStore,
  FilePhotoObjectStore,
  type PhotoObjectStore,
} from "./lib/photo-store";

type CliOptions = {
  inputs: string[];
  output?: string;
  confirm: boolean;
  help: boolean;
};

const HELP = `从照片墙移除照片

用法:
  bun run photos:delete -- <照片或目录...> --confirm

选项:
  --confirm               确认删除 Catalog 记录与 R2 衍生图
  --output <目录>         操作本地目录；省略时操作 R2
  --help                  显示帮助
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
  if (!options.confirm) {
    throw new Error("删除操作需要显式添加 --confirm；不执行任何修改");
  }

  const files = await collectPhotoFiles(options.inputs);
  const photoIds = await Promise.all(files.map((file) => hashPhotoFile(file)));
  console.log("将移除照片:");
  for (const [index, photoId] of photoIds.entries()) {
    console.log(`- ${path.basename(files[index])}: ${photoId}`);
  }

  const store = createStore(options.output);
  try {
    const result = await deletePhotos({ photoIds, store });
    console.log(
      `完成：移除 ${result.deleted} 张照片，清理 ${result.removedObjects} 个对象，更新 ${result.updatedPeriods} 个月份`,
    );
  } finally {
    store.close?.();
  }
}

function createStore(output: string | undefined): PhotoObjectStore {
  if (output) {
    const directory = path.resolve(output);
    console.log(`删除目标：${directory}`);
    return new FilePhotoObjectStore(directory);
  }
  console.log("删除目标：Cloudflare R2");
  return createR2PhotoObjectStore();
}

function parseArguments(args: string[]): CliOptions {
  const inputs: string[] = [];
  let output: string | undefined;
  let confirm = false;
  let help = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--help" || argument === "-h") {
      help = true;
    } else if (argument === "--confirm") {
      confirm = true;
    } else if (argument === "--output") {
      output = readOptionValue(args, ++index, argument);
    } else if (argument.startsWith("--")) {
      throw new Error(`未知选项 ${argument}`);
    } else {
      inputs.push(argument);
    }
  }

  return { inputs, output, confirm, help };
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
