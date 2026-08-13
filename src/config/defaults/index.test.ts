import { describe, expect, it } from "vitest";
import { configSchema } from "../../schemas/config.js";
import { createDefaultConfig } from "./index.js";

describe("createDefaultConfig", () => {
  it("produit une configuration valide selon configSchema (RFC-013 §14)", () => {
    expect(() => configSchema.parse(createDefaultConfig())).not.toThrow();
  });

  it("expose tous les domaines de configuration supportés", () => {
    const config = createDefaultConfig();

    expect(config.project).toBeDefined();
    expect(config.output).toBeDefined();
    expect(config.auth).toBeDefined();
    expect(config.routes).toBeDefined();
    expect(config.runs).toBeDefined();
    expect(config.execution).toBeDefined();
  });

  it("expose execution (concurrency + collisionStrategy) dans la configuration générée (RFC-014/014.5)", () => {
    expect(createDefaultConfig().execution).toEqual({
      concurrency: 4,
      collisionStrategy: "prompt",
    });
  });

  it("n'invente aucune route ni run (routes et runs vides, RFC-013 §11)", () => {
    const config = createDefaultConfig();

    expect(config.routes).toEqual([]);
    expect(config.runs).toEqual([]);
  });

  it("expose chaque champ project supporté", () => {
    const { project } = createDefaultConfig();

    expect(Object.keys(project).sort()).toEqual(
      ["autoStart", "baseUrl", "root", "startCommand", "workingDirectory"].sort(),
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
    first.routes.push({ id: "x", path: "/x", enableSnapshot: true });
    expect(second.routes).toEqual([]);
  });
});
