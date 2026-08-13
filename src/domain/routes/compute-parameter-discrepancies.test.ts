import { describe, expect, it } from "vitest";
import { computeParameterDiscrepancies } from "./compute-parameter-discrepancies.js";

describe("computeParameterDiscrepancies", () => {
  it("ne signale rien quand path et parameters correspondent", () => {
    expect(computeParameterDiscrepancies("/member/stays/[stayId]", { stayId: "1" })).toEqual({
      missing: [],
      unknown: [],
    });
  });

  it("signale un paramètre manquant", () => {
    expect(computeParameterDiscrepancies("/member/stays/[stayId]", {})).toEqual({
      missing: ["stayId"],
      unknown: [],
    });
  });

  it("signale un paramètre inconnu", () => {
    expect(
      computeParameterDiscrepancies("/member/stays/[stayId]", { stayId: "1", wrongId: "2" }),
    ).toEqual({ missing: [], unknown: ["wrongId"] });
  });

  it("signale simultanément un paramètre manquant et un paramètre inconnu", () => {
    expect(computeParameterDiscrepancies("/member/stays/[stayId]", { wrongId: "123" })).toEqual({
      missing: ["stayId"],
      unknown: ["wrongId"],
    });
  });
});
