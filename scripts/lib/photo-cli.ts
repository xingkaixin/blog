import path from "node:path";
import { mapWithConcurrency } from "./concurrency";
import { migratePhotoCatalog } from "./photo-catalog-store";
import { deletePhotos } from "./photo-deleter";
import { collectPhotoGarbage } from "./photo-garbage-collector";
import { photoDisplayName, publishPhotos, type PublishAlbum } from "./photo-publisher";
import { collectPhotoFiles, hashPhotoFile, type ProcessedPhoto } from "./photo-source";
import {
  createR2PhotoObjectStore,
  FilePhotoObjectStore,
  type PhotoObjectStore,
} from "./photo-store";

export type PhotoCommandName = "publish" | "delete" | "gc" | "migrate";

type CommonOptions = {
  output?: string;
  help: boolean;
};

export type PublishPhotoCliOptions = CommonOptions & {
  command: "publish";
  inputs: string[];
  album?: PublishAlbum;
  timezone?: string;
};

export type DeletePhotoCliOptions = CommonOptions & {
  command: "delete";
  inputs: string[];
  confirm: boolean;
};

export type GarbageCollectPhotoCliOptions = CommonOptions & {
  command: "gc";
  confirm: boolean;
};

export type MigratePhotoCliOptions = CommonOptions & {
  command: "migrate";
  confirm: boolean;
};

export type PhotoCliOptions =
  | PublishPhotoCliOptions
  | DeletePhotoCliOptions
  | GarbageCollectPhotoCliOptions
  | MigratePhotoCliOptions;

export type PhotoCliProcessor = {
  process(file: string, id: string, timezone: string | undefined): Promise<ProcessedPhoto>;
  close(): Promise<void>;
};

export type PhotoCliIo = {
  log(message: string): void;
  error(message: string): void;
  write(message: string): void;
};

const HASH_CONCURRENCY = 8;

const HELP: Record<PhotoCommandName, string> = {
  publish: `发布照片到照片墙

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
`,
  delete: `从照片墙移除照片

用法:
  bun run photos:delete -- <照片或目录...> --confirm

选项:
  --confirm               确认删除 Catalog 记录与 R2 衍生图
  --output <目录>         操作本地目录；省略时操作 R2
  --help                  显示帮助
`,
  gc: `回收已超过缓存宽限期的照片对象

用法:
  bun run photos:gc -- --confirm [选项]

选项:
  --confirm               确认回收到期对象
  --output <目录>         操作本地目录；省略时操作 R2
  --help                  显示帮助
`,
  migrate: `迁移照片 Catalog 到当前存储格式

用法:
  bun run photos:migrate -- --confirm [选项]

选项:
  --confirm               确认写入私有控制文档与公开投影
  --output <目录>         操作本地目录；省略时操作 R2
  --help                  显示帮助
`,
};

const defaultIo: PhotoCliIo = {
  log: console.log,
  error: console.error,
  write: (message) => process.stdout.write(message),
};

export async function runPhotoCli(
  command: PhotoCommandName,
  args: string[],
  processor?: PhotoCliProcessor,
  io: PhotoCliIo = defaultIo,
): Promise<void> {
  if (command === "publish") {
    if (!processor) {
      throw new Error("发布命令缺少照片处理器");
    }
    try {
      await runPublishCommand(parsePhotoCliArguments(command, args), processor, io);
    } finally {
      await processor.close();
    }
    return;
  }
  if (command === "delete") {
    await runDeleteCommand(parsePhotoCliArguments(command, args), io);
    return;
  }
  if (command === "gc") {
    await runGarbageCollectCommand(parsePhotoCliArguments(command, args), io);
    return;
  }
  await runMigrateCommand(parsePhotoCliArguments(command, args), io);
}

export function parsePhotoCliArguments(command: "publish", args: string[]): PublishPhotoCliOptions;
export function parsePhotoCliArguments(command: "delete", args: string[]): DeletePhotoCliOptions;
export function parsePhotoCliArguments(
  command: "gc",
  args: string[],
): GarbageCollectPhotoCliOptions;
export function parsePhotoCliArguments(command: "migrate", args: string[]): MigratePhotoCliOptions;
export function parsePhotoCliArguments(command: PhotoCommandName, args: string[]): PhotoCliOptions;
export function parsePhotoCliArguments(command: PhotoCommandName, args: string[]): PhotoCliOptions {
  const inputs: string[] = [];
  let output: string | undefined;
  let albumId: string | undefined;
  let albumTitle: string | undefined;
  let timezone: string | undefined;
  let confirm = false;
  let help = false;
  let positionalOnly = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (positionalOnly) {
      inputs.push(argument);
    } else if (argument === "--") {
      positionalOnly = true;
    } else if (argument === "--help" || argument === "-h") {
      help = true;
    } else if (argument === "--output") {
      output = readOptionValue(args, ++index, argument);
    } else if (argument === "--confirm" && command !== "publish") {
      confirm = true;
    } else if (argument === "--album" && command === "publish") {
      albumId = readOptionValue(args, ++index, argument);
    } else if (argument === "--album-title" && command === "publish") {
      albumTitle = readOptionValue(args, ++index, argument);
    } else if (argument === "--timezone" && command === "publish") {
      timezone = readOptionValue(args, ++index, argument);
    } else if (argument.startsWith("-")) {
      throw new Error(`未知选项 ${argument}`);
    } else {
      inputs.push(argument);
    }
  }

  if (command === "publish") {
    if (albumTitle && !albumId) {
      throw new Error("--album-title 必须与 --album 一起使用");
    }
    return {
      command,
      inputs,
      output,
      album: albumId ? { id: albumId, title: albumTitle } : undefined,
      timezone,
      help,
    };
  }
  if (command === "delete") {
    return { command, inputs, output, confirm, help };
  }
  if (inputs.length > 0) {
    throw new Error(
      `${command === "gc" ? "回收" : "迁移"}命令不接受位置参数: ${inputs.join(", ")}`,
    );
  }
  return { command, output, confirm, help };
}

async function runPublishCommand(
  options: PublishPhotoCliOptions,
  processor: PhotoCliProcessor,
  io: PhotoCliIo,
): Promise<void> {
  if (options.help) {
    io.write(HELP.publish);
    return;
  }
  if (options.inputs.length === 0) {
    throw new Error("至少需要提供一张照片或一个目录");
  }
  const files = await collectPhotoFiles(options.inputs);
  if (files.length === 0) {
    throw new Error("输入目录中没有支持的照片");
  }

  const store = createStore(options.output, "发布", io);
  try {
    const result = await publishPhotos({
      files,
      store,
      album: options.album,
      processPhoto: (file, id) => processor.process(file, id, options.timezone),
      onWarning: (message) => io.error(message),
      onProgress(progress) {
        if (progress.type === "processing") {
          io.log(`[${progress.index}/${progress.total}] 处理 ${photoDisplayName(progress.file)}`);
        } else if (progress.type === "reused") {
          io.log(`复用 ${photoDisplayName(progress.file)}`);
        } else {
          io.log(`已发布 ${photoDisplayName(progress.file)} (${progress.photoId})`);
        }
      },
    });
    io.log(
      `完成：发现 ${result.discovered} 张，新增 ${result.published} 张，复用 ${result.reused} 张，更新 ${result.updatedPeriods} 个月份`,
    );
    if (!result.catalogChanged) {
      io.log("Catalog 无变化，没有写入新版本");
    }
  } finally {
    store.close?.();
  }
}

async function runDeleteCommand(options: DeletePhotoCliOptions, io: PhotoCliIo): Promise<void> {
  if (options.help) {
    io.write(HELP.delete);
    return;
  }
  if (options.inputs.length === 0) {
    throw new Error("至少需要提供一张照片或一个目录");
  }
  if (!options.confirm) {
    throw new Error("删除操作需要显式添加 --confirm；不执行任何修改");
  }
  const files = await collectPhotoFiles(options.inputs);
  if (files.length === 0) {
    throw new Error("输入目录中没有支持的照片");
  }
  const photoIds = await mapWithConcurrency(files, HASH_CONCURRENCY, hashPhotoFile);
  io.log("将移除照片:");
  for (const [index, photoId] of photoIds.entries()) {
    io.log(`- ${path.basename(files[index])}: ${photoId}`);
  }

  const store = createStore(options.output, "删除", io);
  try {
    const result = await deletePhotos({
      photoIds,
      store,
      onWarning: (message) => io.error(message),
    });
    io.log(
      `完成：移除 ${result.deleted} 张照片，已有 ${result.alreadyRetired} 张在回收队列，延迟回收 ${result.retiredObjects} 个对象，更新 ${result.updatedPeriods} 个月份`,
    );
  } finally {
    store.close?.();
  }
}

async function runGarbageCollectCommand(
  options: GarbageCollectPhotoCliOptions,
  io: PhotoCliIo,
): Promise<void> {
  if (options.help) {
    io.write(HELP.gc);
    return;
  }
  if (!options.confirm) {
    throw new Error("回收操作需要显式添加 --confirm；不执行任何修改");
  }

  const store = createStore(options.output, "回收", io);
  try {
    const result = await collectPhotoGarbage({ store });
    io.log(
      `完成：清理 ${result.removedObjects} 个对象，失败 ${result.failedObjects} 个，仍有 ${result.pendingPhotos} 张照片和 ${result.pendingArtifacts} 批产物待回收`,
    );
    for (const failure of result.failures) {
      io.error(`- ${failure.objectKey}: ${failure.message}`);
    }
    if (result.failedObjects > 0) {
      throw new Error("部分照片对象回收失败");
    }
  } finally {
    store.close?.();
  }
}

async function runMigrateCommand(options: MigratePhotoCliOptions, io: PhotoCliIo): Promise<void> {
  if (options.help) {
    io.write(HELP.migrate);
    return;
  }
  if (!options.confirm) {
    throw new Error("迁移操作需要显式添加 --confirm；不执行任何修改");
  }

  const store = createStore(options.output, "迁移", io);
  try {
    const migrated = await migratePhotoCatalog(store);
    io.log(migrated ? "完成：Catalog 已迁移到当前格式" : "Catalog 已是当前格式，无需写入");
  } finally {
    store.close?.();
  }
}

function createStore(output: string | undefined, action: string, io: PhotoCliIo): PhotoObjectStore {
  if (output) {
    const directory = path.resolve(output);
    io.log(`${action}目标：${directory}`);
    return new FilePhotoObjectStore(directory);
  }
  io.log(`${action}目标：Cloudflare R2`);
  return createR2PhotoObjectStore();
}

function readOptionValue(args: string[], index: number, option: string): string {
  const value = args[index];
  if (!value || value.startsWith("-")) {
    throw new Error(`${option} 缺少参数`);
  }
  return value;
}
