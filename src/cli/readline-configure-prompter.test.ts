import type { Interface as ReadlineInterface } from "node:readline/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createReadlineConfigurePrompter } from "./readline-configure-prompter.js";

function fakeReadline(answers: readonly string[]): ReadlineInterface {
  let index = 0;
  return {
    question: vi.fn(() => Promise.resolve(answers[index++] ?? "")),
  } as unknown as ReadlineInterface;
}

const prop = { name: "user", type: "User", reason: "no configured or inferred value" };

describe("createReadlineConfigurePrompter", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it("maps menu choice 1 to the values action", async () => {
    const prompter = createReadlineConfigurePrompter(fakeReadline(["1"]));

    await expect(prompter.selectAction("Avatar", prop)).resolves.toBe("values");
  });

  it("maps menu choice 4 to skip-component", async () => {
    const prompter = createReadlineConfigurePrompter(fakeReadline(["4"]));

    await expect(prompter.selectAction("Avatar", prop)).resolves.toBe("skip-component");
  });

  it("defaults to leave-unresolved for an empty or unknown answer", async () => {
    const prompter = createReadlineConfigurePrompter(fakeReadline([""]));

    await expect(prompter.selectAction("Avatar", prop)).resolves.toBe("leave-unresolved");
  });

  it("parses a comma-separated values answer", async () => {
    const prompter = createReadlineConfigurePrompter(fakeReadline(["guest, admin ,member"]));

    await expect(prompter.promptValues("Avatar", prop)).resolves.toEqual(["guest", "admin", "member"]);
  });

  it("treats a blank fixture-values answer as reuse-existing", async () => {
    const prompter = createReadlineConfigurePrompter(fakeReadline(["   "]));

    await expect(prompter.promptFixtureValues("users")).resolves.toBeUndefined();
  });

  it("notify writes to the console", () => {
    const prompter = createReadlineConfigurePrompter(fakeReadline([]));

    prompter.notify("done");

    expect(logSpy).toHaveBeenCalledWith("done");
  });
});
