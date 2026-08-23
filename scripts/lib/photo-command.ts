import { spawn } from "node:child_process";

const MAX_STDERR_CHARACTERS = 32_000;
const PROCESS_TERMINATION_GRACE_MS = 5_000;

export function runPhotoCommand(command: string, args: string[], timeoutMs: number): Promise<void> {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error("照片命令超时必须是正整数");
  }
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    let finished = false;
    let timedOut = false;
    let spawnError: Error | null = null;
    let terminationTimer: ReturnType<typeof setTimeout> | undefined;
    const complete = (error?: Error) => {
      if (finished) {
        return;
      }
      finished = true;
      clearTimeout(timeout);
      clearTimeout(terminationTimer);
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
      terminationTimer = setTimeout(
        () => complete(new Error(`执行 ${command} 超时且进程未在宽限期内退出`)),
        PROCESS_TERMINATION_GRACE_MS,
      );
    }, timeoutMs);

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      if (stderr.length < MAX_STDERR_CHARACTERS) {
        stderr = `${stderr}${chunk}`.slice(0, MAX_STDERR_CHARACTERS);
      }
    });
    child.once("error", (error) => {
      spawnError = error;
    });
    child.once("close", (code) => {
      if (timedOut) {
        complete(new Error(`执行 ${command} 超时（${timeoutMs}ms）`));
        return;
      }
      if (spawnError) {
        complete(spawnError);
        return;
      }
      if (code === 0) {
        complete();
      } else {
        complete(new Error(stderr.trim() || `退出码 ${code ?? "unknown"}`));
      }
    });
  });
}
