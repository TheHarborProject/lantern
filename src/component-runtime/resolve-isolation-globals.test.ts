import { describe, expect, it } from "vitest";
import { resolveIsolationGlobals } from "./resolve-isolation-globals.js";

describe("resolveIsolationGlobals", () => {
  it("returns empty globals when no isolation section is configured", () => {
    expect(resolveIsolationGlobals("/project", undefined)).toEqual({ globalCssPaths: [] });
  });

  it("resolves stylesheet and wrapper paths against the project root", () => {
    const globals = resolveIsolationGlobals("/project", {
      globalCss: ["src/app/globals.css", "src/theme.css"],
      wrapper: "lantern/wrapper.tsx",
      wrapperExport: "Providers",
    });

    expect(globals).toEqual({
      globalCssPaths: ["/project/src/app/globals.css", "/project/src/theme.css"],
      wrapperModulePath: "/project/lantern/wrapper.tsx",
      wrapperExport: "Providers",
    });
  });

  it("omits the wrapper when it is not configured", () => {
    const globals = resolveIsolationGlobals("/project", {
      globalCss: [],
      wrapperExport: "default",
    });

    expect(globals).toEqual({ globalCssPaths: [] });
    expect(globals.wrapperModulePath).toBeUndefined();
  });
});
