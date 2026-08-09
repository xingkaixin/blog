#!/usr/bin/env bun

import path from "node:path";
import { collectPhotoGarbage } from "./lib/photo-publisher";
import {
  createR2PhotoObjectStore,
  FilePhotoObjectStore,
  type PhotoObjectStore,
} from "./lib/photo-store";

type CliOptions = {
  output?: string;
  confirm: boolean;
  help: boolean;
};

const HELP = `回收已超过缓存宽限期的照片对象

用法:
  bun run photos:gc -- --confirm [选项]

选项:
  --confirm               确认回收到期对象
  --output <目录>         操作本地目录；省略时操作 R2
  --help                  显示帮助
`;

async function main(): Promise<void> {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(HELP);
    return;
  }
  if (!options.confirm) {
    throw new Error("回收操作需要显式添加 --confirm；不执行任何修改");
  }

  const store = createStore(options.output);
  try {
    const result = await collectPhotoGarbage({ store });
    console.log(
      `完成：清理 ${result.removedObjects} 个对象，失败 ${result.failedObjects} 个，仍有 ${result.pendingPhotos} 张照片和 ${result.pendingArtifacts} 批产物待回收`,
    );
    for (const failure of result.failures) {
      console.error(`- ${failure.objectKey}: ${failure.message}`);
    }
    if (result.failedObjects > 0) {
      process.exitCode = 1;
    }
  } finally {
    store.close?.();
  }
}

function createStore(output: string | undefined): PhotoObjectStore {
  if (output) {
    const directory = path.resolve(output);
    console.log(`回收目标：${directory}`);
    return new FilePhotoObjectStore(directory);
  }
  console.log("回收目标：Cloudflare R2");
  return createR2PhotoObjectStore();
}

function parseArguments(args: string[]): CliOptions {
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
    } else {
      throw new Error(`未知参数 ${argument}`);
    }
  }

  return { output, confirm, help };
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
