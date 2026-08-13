import { describe, expect, it } from "vitest";
import { RunNotFoundError } from "../errors/run-not-found-error.js";
import type { RawRun } from "../types/run.js";
import { findRunByName } from "./find-run-by-name.js";

function run(runName: string): RawRun {
  return { runName, order: 1, routes: [] };
}

describe("findRunByName", () => {
  it("retourne le run correspondant au nom", () => {
    const runs = [run("a"), run("b")];

    expect(findRunByName(runs, "b")).toBe(runs[1]);
  });

  it("lève RUN_NOT_FOUND si aucun nom ne correspond", () => {
    const runs = [run("a")];

    try {
      findRunByName(runs, "absent");
      expect.fail("findRunByName aurait dû lever une erreur");
    } catch (error) {
      expect(error).toBeInstanceOf(RunNotFoundError);
      const notFoundError = error as RunNotFoundError;
      expect(notFoundError.code).toBe("RUN_NOT_FOUND");
      expect(notFoundError.runName).toBe("absent");
    }
  });
});
