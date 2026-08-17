import { spawn } from "node:child_process";
import { resolvePackageManager, type PackageManager } from "./resolve-package-manager.js";

/** Application launched by Lantern, with exit state and captured output. */
export interface RunningApplication {
  readonly pid: number | undefined;
  hasExited(): boolean;
  exitCode(): number | null;
  /** Concatenated stdout + stderr, used to diagnose startup failures. */
  capturedOutput(): string;
}

/**
 * Launch the package.json `startScript` from `workingDirectory` (RFC-011).
 * The package manager is executed directly with an argv array: Lantern never
 * interprets the script name as shell syntax. On POSIX,
 * `detached: true` puts the process in its own group so
 * {@link stopApplication} can stop the command and any child processes
 * without leaving orphans. stdout/stderr are captured and never printed directly,
 * which avoids noise while the application starts normally.
 */
export function spawnApplication(
  startScript: string,
  workingDirectory: string,
): RunningApplication {
  const packageManager = resolvePackageManager(workingDirectory);
  const command = packageManagerExecutable(packageManager);

  const child = spawn(command, ["run", startScript], {
    cwd: workingDirectory,
    shell: false,
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
  // `close` runs after stdio has closed, so startup errors include all output
  // instead of racing the final stdout/stderr chunks.
  child.on("close", (exitCode) => {
    code = exitCode;
    setImmediate(() => {
      exited = true;
    });
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

function packageManagerExecutable(packageManager: PackageManager): string {
  if (process.platform !== "win32" || packageManager === "bun") {
    return packageManager;
  }
  return `${packageManager}.cmd`;
}
