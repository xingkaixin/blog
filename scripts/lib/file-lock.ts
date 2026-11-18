import fs from "node:fs/promises";

export async function withFileLock<T>(
  lock: string,
  operation: () => Promise<T>,
  timeoutMs = 5_000,
): Promise<T> {
  const retryDelayMs = 20;
  const maximumAttempts = Math.ceil(timeoutMs / retryDelayMs);

  for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
    const handle = await fs.open(lock, "wx").catch((error: unknown) => {
      if (error instanceof Error && "code" in error && error.code === "EEXIST") {
        return null;
      }
      throw error;
    });
    if (!handle) {
      // 锁龄不能证明持有者已退出，慢写入或进程暂停时仍必须保持互斥。
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      continue;
    }
    try {
      return await operation();
    } finally {
      await handle.close();
      await fs.rm(lock, { force: true });
    }
  }

  throw new Error(
    `等待对象锁超时: ${lock}；请等待当前写入完成。若锁为异常退出遗留，确认所有写入进程已退出后再删除此锁文件重试`,
  );
}
