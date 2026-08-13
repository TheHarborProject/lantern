import { describe, expect, it } from "vitest";
import { extractPathParameterNames } from "./extract-path-parameter-names.js";

describe("extractPathParameterNames", () => {
  it("retourne [] pour un chemin statique", () => {
    expect(extractPathParameterNames("/member/calendar")).toEqual([]);
  });

  it("extrait un unique paramètre", () => {
    expect(extractPathParameterNames("/member/stays/[stayId]")).toEqual(["stayId"]);
  });

  it("extrait plusieurs paramètres, dans l'ordre d'apparition", () => {
    expect(extractPathParameterNames("/orgs/[orgId]/members/[memberId]")).toEqual([
      "orgId",
      "memberId",
    ]);
  });

  it("dé-duplique un paramètre répété", () => {
    expect(extractPathParameterNames("/a/[id]/b/[id]")).toEqual(["id"]);
  });
});
