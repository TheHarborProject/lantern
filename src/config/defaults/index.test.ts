import { describe, expect, it } from "vitest";
import { configSchema } from "../../schemas/config.js";
import { createDefaultConfig } from "./index.js";

describe("createDefaultConfig", () => {
  it("produit une configuration valide selon configSchema", () => {
    expect(() => configSchema.parse(createDefaultConfig())).not.toThrow();
  });

  it("expose les domaines de fondation supportés", () => {
    const config = createDefaultConfig();

    expect(config.project).toBeDefined();
    expect(config.auth).toBeDefined();
  });

  it("expose chaque champ project supporté", () => {
    const { project } = createDefaultConfig();

    expect(Object.keys(project).sort()).toEqual(
      ["autoStart", "baseUrl", "root", "sourceDirectory", "startScript", "workingDirectory"].sort(),
    );
  });

  it("expose la structure d'authentification complète avec un utilisateur d'exemple", () => {
    const config = createDefaultConfig();

    expect(config.auth?.loginRoute).toBeDefined();
    expect(Object.keys(config.auth?.selectors ?? {}).sort()).toEqual(
      ["email", "password", "submit"].sort(),
    );
    expect(config.auth?.successUrl).toBeDefined();
    expect(config.auth?.successSelector).toBeDefined();
    expect(Object.keys(config.auth?.users ?? {})).toHaveLength(1);
  });

  it("retourne une nouvelle copie à chaque appel (aucun état partagé)", () => {
    const first = createDefaultConfig();
    const second = createDefaultConfig();

    expect(first).not.toBe(second);
    expect(first.auth).not.toBe(second.auth);
    first.project.root = "changed";
    expect(second.project.root).toBe(".");
  });

  it("expose une configuration RFC-005 minimale et déterministe", () => {
    const config = createDefaultConfig();

    expect(config.standards).toEqual(["wcag22-aa"]);
    expect(config.extends).toEqual(["lantern:recommended"]);
    expect(config.ignorePatterns).toEqual([
      "node_modules/",
      "dist/",
      "build/",
      ".next/",
      "coverage/",
    ]);
    // Fields the resolution layer already defaults usefully stay absent from the
    // scaffolded file, so it does not repeat values that simply match defaults.
    expect(config.engines).toBeUndefined();
    expect(config.rules).toBeUndefined();
    expect(config.components).toBeUndefined();
    expect(config.overrides).toBeUndefined();
    expect(config.settings).toBeUndefined();
  });

  it("ne partage pas les tableaux RFC-005 entre deux appels", () => {
    const first = createDefaultConfig();
    const second = createDefaultConfig();

    first.standards?.push("rgaa4.1");
    expect(second.standards).toEqual(["wcag22-aa"]);
  });
});
