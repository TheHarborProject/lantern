import { describe, expect, it } from "vitest";
import { spawnApplication } from "./spawn-application.js";
import { stopApplication } from "./stop-application.js";

function waitFor(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolvePromise, reject) => {
    const check = (): void => {
      if (predicate()) {
        resolvePromise();
        return;
      }
      if (Date.now() > deadline) {
        reject(new Error("waitFor: délai dépassé"));
        return;
      }
      setTimeout(check, 20);
    };
    check();
  });
}

describe("spawnApplication", () => {
  it("expose un pid et capture stdout", async () => {
    const app = spawnApplication("node -e \"console.log('hello-from-child')\"", process.cwd());

    expect(app.pid).toBeDefined();
    await waitFor(() => app.hasExited());

    expect(app.exitCode()).toBe(0);
    expect(app.capturedOutput()).toContain("hello-from-child");
  });

  it("capture stderr et un code de sortie non nul en cas d'échec de la commande", async () => {
    const app = spawnApplication(
      "node -e \"console.error('boom'); process.exit(1)\"",
      process.cwd(),
    );

    await waitFor(() => app.hasExited());

    expect(app.exitCode()).toBe(1);
    expect(app.capturedOutput()).toContain("boom");
  });

  it("hasExited() reste false tant que le processus tourne", async () => {
    const app = spawnApplication('node -e "setInterval(() => {}, 1000)"', process.cwd());

    expect(app.hasExited()).toBe(false);

    await stopApplication(app);
    expect(app.hasExited()).toBe(true);
  });
});
