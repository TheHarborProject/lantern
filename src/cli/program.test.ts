import { describe, expect, it } from "vitest";
import { createProgram } from "./program.js";

describe("createProgram", () => {
  it("expose le nom et la description du package", () => {
    const program = createProgram();

    expect(program.name()).toBe("snaprun");
    expect(program.description()).toContain("SnapRun");
  });

  it("enregistre la commande scan (RFC-006)", () => {
    const program = createProgram();

    expect(program.commands.map((command) => command.name())).toContain("scan");
  });

  it("enregistre la commande init (RFC-013)", () => {
    const program = createProgram();

    expect(program.commands.map((command) => command.name())).toContain("init");
  });

  it("affiche l'aide sans erreur", () => {
    const program = createProgram();

    expect(() => program.helpInformation()).not.toThrow();
    expect(program.helpInformation()).toContain("snaprun");
  });

  it("expose --debug comme option globale (RFC-010)", () => {
    const program = createProgram();

    expect(program.options.map((option) => option.long)).toContain("--debug");
  });
});
