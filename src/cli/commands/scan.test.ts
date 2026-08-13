import { Command } from "commander";
import { describe, expect, it } from "vitest";
import { registerScanCommand } from "./scan.js";

describe("registerScanCommand", () => {
  it("enregistre la commande 'scan' avec l'option --default", () => {
    const program = new Command();
    registerScanCommand(program);

    const scanCommand = program.commands.find((command) => command.name() === "scan");

    expect(scanCommand).toBeDefined();
    const defaultOption = scanCommand?.options.find((option) => option.long === "--default");
    expect(defaultOption?.defaultValue).toBe("disabled");
  });

  it("rejette une valeur invalide pour --default", () => {
    const program = new Command();
    program.exitOverride();
    registerScanCommand(program);
    const scanCommand = program.commands.find((command) => command.name() === "scan");
    scanCommand?.exitOverride();

    expect(() => program.parse(["scan", "--default=bogus"], { from: "user" })).toThrow();
  });
});
