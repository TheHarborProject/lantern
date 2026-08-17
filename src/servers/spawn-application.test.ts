import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
    const directory = fixtureProject({ output: "node -e \"console.log('hello-from-child')\"" });
    const app = spawnApplication("output", directory);

    expect(app.pid).toBeDefined();
    await waitFor(() => app.hasExited());

    expect(app.exitCode()).toBe(0);
    expect(app.capturedOutput()).toContain("hello-from-child");
    rmSync(directory, { recursive: true, force: true });
  });

  it("capture stderr et un code de sortie non nul en cas d'échec de la commande", async () => {
    const directory = fixtureProject({
      failure: "node -e \"console.error('boom'); process.exit(1)\"",
    });
    const app = spawnApplication("failure", directory);

    await waitFor(() => app.hasExited());

    expect(app.exitCode()).toBe(1);
    expect(app.capturedOutput()).toContain("boom");
    rmSync(directory, { recursive: true, force: true });
  });

  it("hasExited() reste false tant que le processus tourne", async () => {
    const directory = fixtureProject({ long: 'node -e "setInterval(() => {}, 1000)"' });
    const app = spawnApplication("long", directory);

    expect(app.hasExited()).toBe(false);

    await stopApplication(app);
    expect(app.hasExited()).toBe(true);
    rmSync(directory, { recursive: true, force: true });
  });

  it("traite le nom du script comme un argument, jamais comme une commande shell", async () => {
    const directory = fixtureProject({ valid: 'node -e "process.exit(0)"' });
    const marker = join(directory, "injected");
    const app = spawnApplication(`valid; touch ${marker}`, directory);

    await waitFor(() => app.hasExited());

    expect(app.exitCode()).not.toBe(0);
    expect(() => rmSync(marker)).toThrow();
    rmSync(directory, { recursive: true, force: true });
  });
});

function fixtureProject(scripts: Readonly<Record<string, string>>): string {
  const directory = mkdtempSync(join(tmpdir(), "lantern-spawn-app-"));
  writeFileSync(
    join(directory, "package.json"),
    JSON.stringify({ private: true, packageManager: "npm@10.0.0", scripts }),
  );
  return directory;
}
