import { describe, expect, it } from "vitest";
import { createEnabledEngines } from "./create-enabled-engines.js";

describe("createEnabledEngines", () => {
  it("creates both Lantern-owned engines when both are enabled", () => {
    const engines = createEnabledEngines({ static: true, rendered: true, axe: false, lighthouse: false });

    expect(engines.map((engine) => engine.identity.id)).toEqual(["lantern-static", "lantern-rendered-dom"]);
  });

  it("creates no engines when both are disabled", () => {
    expect(createEnabledEngines({ static: false, rendered: false, axe: false, lighthouse: false })).toEqual([]);
  });

  it("respects each flag independently", () => {
    expect(
      createEnabledEngines({ static: true, rendered: false, axe: false, lighthouse: false }).map(
        (engine) => engine.identity.id,
      ),
    ).toEqual(["lantern-static"]);
    expect(
      createEnabledEngines({ static: false, rendered: true, axe: false, lighthouse: false }).map(
        (engine) => engine.identity.id,
      ),
    ).toEqual(["lantern-rendered-dom"]);
  });
});
