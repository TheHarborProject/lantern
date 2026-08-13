import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RouteNotFoundError } from "../errors/route-not-found-error.js";
import { printCliError } from "./print-cli-error.js";

describe("printCliError", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it("affiche uniquement le message sans --debug", () => {
    printCliError(new RouteNotFoundError("/absent"), false);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const firstArg = errorSpy.mock.calls[0]?.[0];
    expect(String(firstArg)).toContain("/absent");
  });

  it("affiche également la pile d'appels avec --debug", () => {
    printCliError(new RouteNotFoundError("/absent"), true);

    expect(errorSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    const stackArg = errorSpy.mock.calls[1]?.[0];
    expect(String(stackArg)).toContain("RouteNotFoundError");
  });
});
