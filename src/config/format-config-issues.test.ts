import { describe, expect, it } from "vitest";
import { configSchema } from "../schemas/config.js";
import { formatConfigIssues } from "./format-config-issues.js";

describe("formatConfigIssues", () => {
  it("préserve le chemin pointé vers le champ invalide", () => {
    const result = configSchema.safeParse({ project: { autoStart: "oui" } });

    expect(result.success).toBe(false);
    if (!result.success) {
      const message = formatConfigIssues(result.error);
      expect(message).toContain("project.autoStart");
    }
  });

  it("rapporte plusieurs problèmes séparés par une ligne vide", () => {
    const result = configSchema.safeParse({
      project: { autoStart: "oui", root: 123 },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const message = formatConfigIssues(result.error);
      expect(message).toContain("project.autoStart");
      expect(message).toContain("project.root");
      expect(message).toContain("\n\n");
    }
  });

  it("utilise (root) quand aucun chemin n'est disponible", () => {
    const result = configSchema.safeParse(undefined);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatConfigIssues(result.error)).toContain("(root)");
    }
  });
});
