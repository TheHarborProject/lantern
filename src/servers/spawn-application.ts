import { spawn } from "node:child_process";

/** Application launched by SnapRun (RFC-011), with exit state and captured output. */
export interface RunningApplication {
  readonly pid: number | undefined;
  hasExited(): boolean;
  exitCode(): number | null;
  /** Concatenated stdout + stderr, used to diagnose startup failures. */
  capturedOutput(): string;
}

/**
 * Launch `startCommand` from `workingDirectory` (RFC-011). On POSIX,
 * `detached: true` puts the process in its own group so
 * {@link stopApplication} can stop the command and any child processes
 * without leaving orphans. On POSIX the command is prefixed with the shell
 * keyword `exec`: without it, `sh -c "<command>"` keeps an intermediate shell
 * that often moves its own command into a new process group (job control),
 * making that group unreachable to `stopApplication` (observed bug: the
 * shell stops, not the command it launched). `exec` replaces the shell with
 * the command itself. stdout/stderr are captured and never printed directly,
 * which avoids noise while the application starts normally.
 */
export function spawnApplication(
  startCommand: string,
  workingDirectory: string,
): RunningApplication {
  const command = process.platform === "win32" ? startCommand : `exec ${startCommand}`;

  const child = spawn(command, {
    cwd: workingDirectory,
    shell: true,
    detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });

  let exited = false;
  let code: number | null = null;
  let output = "";

  child.stdout?.on("data", (chunk: Buffer) => {
    output += chunk.toString();
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    output += chunk.toString();
  });
  child.on("exit", (exitCode) => {
    exited = true;
    code = exitCode;
  });
  child.on("error", () => {
    exited = true;
  });

  return {
    pid: child.pid,
    hasExited: () => exited,
    exitCode: () => code,
    capturedOutput: () => output,
  };
}
