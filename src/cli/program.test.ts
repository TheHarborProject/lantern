import { describe, expect, it } from "vitest";
import { createProgram } from "./program.js";

describe("createProgram", () => {
  it("expose le nom et la description du package", () => {
    const program = createProgram();

    expect(program.name()).toBe("lantern");
    expect(program.description()).toContain("Lantern");
  });

  it("affiche l'aide sans erreur", () => {
    const program = createProgram();

    expect(() => program.helpInformation()).not.toThrow();
    expect(program.helpInformation()).toContain("lantern");
  });

  it("expose les options globales de fondation", () => {
    const program = createProgram();

    expect(program.options.map((option) => option.long)).toContain("--debug");
    expect(program.options.map((option) => option.long)).toContain("--config");
  });

  it("enregistre la commande audit scan", () => {
    const program = createProgram();
    const audit = program.commands.find((command) => command.name() === "audit");

    expect(audit?.commands.map((command) => command.name())).toContain("scan");
  });

  it("enregistre la commande lint (RFC-007)", () => {
    const program = createProgram();

    expect(program.commands.map((command) => command.name())).toContain("lint");
  });

  it("exposes lantern init in CLI help", () => {
    const program = createProgram();

    expect(program.commands.map((command) => command.name())).toContain("init");
    expect(program.helpInformation()).toContain("init");
  });

  it("registers scan and survey as canonical top-level commands", () => {
    const program = createProgram();
    expect(program.commands.map((command) => command.name())).toEqual(expect.arrayContaining(["scan", "survey"]));
    expect(program.helpInformation()).toContain("scan");
    expect(program.helpInformation()).toContain("survey");
  });
});
