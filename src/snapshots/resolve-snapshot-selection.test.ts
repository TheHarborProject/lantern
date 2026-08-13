import { describe, expect, it } from "vitest";
import { CliOptionConflictError } from "../errors/cli-option-conflict-error.js";
import { resolveSnapshotSelection } from "./resolve-snapshot-selection.js";

describe("resolveSnapshotSelection", () => {
  it("renvoie 'all' sans aucune option (snaprun)", () => {
    expect(resolveSnapshotSelection({})).toEqual({ kind: "all" });
  });

  it("renvoie 'run' pour --runName seul", () => {
    expect(resolveSnapshotSelection({ runName: "member" })).toEqual({
      kind: "run",
      runName: "member",
    });
  });

  it("renvoie 'run' pour --runName --partial (V1 : identique au mode normal)", () => {
    expect(resolveSnapshotSelection({ runName: "member", partial: true })).toEqual({
      kind: "run",
      runName: "member",
    });
  });

  it("renvoie 'route' pour --route seul (sans user, capture publique)", () => {
    expect(resolveSnapshotSelection({ route: "/calendar" })).toEqual({
      kind: "route",
      routePath: "/calendar",
      user: undefined,
    });
  });

  it("renvoie 'route' pour --route --user", () => {
    expect(resolveSnapshotSelection({ route: "/calendar", user: "member" })).toEqual({
      kind: "route",
      routePath: "/calendar",
      user: "member",
    });
  });

  it("renvoie 'run-route' pour --runName --route", () => {
    expect(resolveSnapshotSelection({ runName: "member", route: "/member/calendar" })).toEqual({
      kind: "run-route",
      runName: "member",
      routePath: "/member/calendar",
    });
  });

  it("lève CLI_OPTION_CONFLICT pour --partial sans --runName", () => {
    expect(() => resolveSnapshotSelection({ partial: true })).toThrow(CliOptionConflictError);
  });

  it("lève CLI_OPTION_CONFLICT pour --user sans --route", () => {
    expect(() => resolveSnapshotSelection({ user: "member" })).toThrow(CliOptionConflictError);
  });

  it("lève CLI_OPTION_CONFLICT pour --user combiné à --runName", () => {
    expect(() =>
      resolveSnapshotSelection({ runName: "member", route: "/x", user: "member" }),
    ).toThrow(CliOptionConflictError);
  });

  it("lève CLI_OPTION_CONFLICT pour --user --runName même sans --route", () => {
    expect(() => resolveSnapshotSelection({ runName: "member", user: "member" })).toThrow(
      CliOptionConflictError,
    );
  });

  it("le code d'erreur est CLI_OPTION_CONFLICT", () => {
    try {
      resolveSnapshotSelection({ partial: true });
      expect.fail("aurait dû lever une erreur");
    } catch (error) {
      expect((error as CliOptionConflictError).code).toBe("CLI_OPTION_CONFLICT");
    }
  });
});
