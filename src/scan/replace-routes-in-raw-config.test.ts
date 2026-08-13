import { describe, expect, it } from "vitest";
import { ConfigInvalidError } from "../errors/config-invalid-error.js";
import type { RawStaticRoute } from "../types/route.js";
import { replaceRoutesInRawConfig } from "./replace-routes-in-raw-config.js";

const newRoutes: RawStaticRoute[] = [{ id: "blog", path: "/blog", enableSnapshot: false }];

describe("replaceRoutesInRawConfig", () => {
  it("ne modifie que la clé 'routes', en conservant les autres sections telles quelles", () => {
    const rawConfig = {
      project: { root: ".", baseUrl: "http://localhost:3000" },
      output: { directory: "./snapshots" },
      routes: [],
      extraUnknownField: "préservé",
    };

    const result = replaceRoutesInRawConfig(rawConfig, newRoutes);

    expect(result).toEqual({
      project: { root: ".", baseUrl: "http://localhost:3000" },
      output: { directory: "./snapshots" },
      routes: newRoutes,
      extraUnknownField: "préservé",
    });
  });

  it("lève CONFIG_INVALID si la configuration brute n'est pas un objet", () => {
    expect(() => replaceRoutesInRawConfig(null, newRoutes)).toThrow(ConfigInvalidError);
    expect(() => replaceRoutesInRawConfig([], newRoutes)).toThrow(ConfigInvalidError);
    expect(() => replaceRoutesInRawConfig("string", newRoutes)).toThrow(ConfigInvalidError);
  });
});
