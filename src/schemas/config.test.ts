import { describe, expect, it } from "vitest";
import { configSchema } from "./config.js";

function fullConfig(): unknown {
  return {
    project: {
      root: ".",
      workingDirectory: ".",
      baseUrl: "http://localhost:3000",
      startCommand: "pnpm dev",
      autoStart: true,
    },
    output: { directory: "./snapshots", fullPage: true, structure: "flat" },
    auth: {
      loginRoute: "/sign-in",
      selectors: {
        email: "input[name='email']",
        password: "input[name='password']",
        submit: "button[type='submit']",
      },
      successUrl: "/dashboard",
      users: { member: { email: "member@example.com", password: "${MEMBER_PASSWORD}" } },
    },
    routes: [],
    runs: [],
  };
}

describe("configSchema", () => {
  it("accepte une configuration complète et valide", () => {
    const result = configSchema.safeParse(fullConfig());

    expect(result.success).toBe(true);
  });

  it("accepte une configuration réellement minimale (seul 'project' vide)", () => {
    const result = configSchema.safeParse({ project: {} });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        project: { root: ".", workingDirectory: ".", autoStart: false },
        output: { directory: "./snapshots", fullPage: true, structure: "flat" },
        routes: [],
        runs: [],
        execution: { concurrency: 4, collisionStrategy: "prompt" },
      });
    }
  });

  it("rejette une configuration sans la section 'project'", () => {
    const result = configSchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it("accepte une configuration minimale avec seulement project.baseUrl (cas scan)", () => {
    const result = configSchema.safeParse({ project: { baseUrl: "http://localhost:3000" } });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.project.baseUrl).toBe("http://localhost:3000");
      expect(result.data.project.autoStart).toBe(false);
    }
  });

  it("laisse 'auth' absent (undefined) quand la section n'est pas fournie", () => {
    const result = configSchema.safeParse({ project: {} });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.auth).toBeUndefined();
    }
  });

  it("applique '.' par défaut à project.workingDirectory absent", () => {
    const result = configSchema.safeParse({ project: { root: "./app" } });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.project.workingDirectory).toBe(".");
    }
  });

  it("applique les valeurs par défaut de 'output' quand seul un de ses champs est fourni", () => {
    const result = configSchema.safeParse({ project: {}, output: { fullPage: false } });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.output).toEqual({
        directory: "./snapshots",
        fullPage: false,
        structure: "flat",
      });
    }
  });

  it("accepts output.structure = 'run' and 'scope'", () => {
    expect(configSchema.safeParse({ project: {}, output: { structure: "run" } }).success).toBe(true);
    expect(configSchema.safeParse({ project: {}, output: { structure: "scope" } }).success).toBe(
      true,
    );
  });

  it("rejects an unknown output.structure value", () => {
    expect(configSchema.safeParse({ project: {}, output: { structure: "grouped" } }).success).toBe(
      false,
    );
  });

  it("rejette un type invalide (autoStart non booléen)", () => {
    const result = configSchema.safeParse({ project: { autoStart: "oui" } });

    expect(result.success).toBe(false);
  });

  it("rejette des sélecteurs d'authentification incomplets quand 'auth' est présent", () => {
    const config = fullConfig() as { auth: { selectors: Record<string, unknown> } };
    delete config.auth.selectors["submit"];

    const result = configSchema.safeParse(config);

    expect(result.success).toBe(false);
  });

  it("valide 'routes' selon le modèle de route de la RFC-004", () => {
    const config = fullConfig() as { routes: unknown[] };
    config.routes = [
      { id: "member-calendar", path: "/member/calendar", enableSnapshot: true, user: "member" },
      {
        id: "member-stay",
        path: "/member/stays/[stayId]",
        isDynamic: true,
        parameters: { stayId: "seed-stay-123" },
        enableSnapshot: true,
      },
    ];

    expect(configSchema.safeParse(config).success).toBe(true);
  });

  it("rejette 'routes' contenant un identifiant dupliqué", () => {
    const config = fullConfig() as { routes: unknown[] };
    config.routes = [
      { id: "duplicate", path: "/a", enableSnapshot: true },
      { id: "duplicate", path: "/b", enableSnapshot: true },
    ];

    expect(configSchema.safeParse(config).success).toBe(false);
  });

  it("rejette 'auth' sans successUrl ni successSelector (RFC-007)", () => {
    const config = fullConfig() as { auth: Record<string, unknown> };
    delete config.auth["successUrl"];

    expect(configSchema.safeParse(config).success).toBe(false);
  });

  it("accepte 'auth' avec seulement successSelector", () => {
    const config = fullConfig() as { auth: Record<string, unknown> };
    delete config.auth["successUrl"];
    config.auth["successSelector"] = "[data-testid='dashboard']";

    expect(configSchema.safeParse(config).success).toBe(true);
  });

  it("rejette un utilisateur sans email ou sans password", () => {
    const config = fullConfig() as { auth: { users: Record<string, unknown> } };
    config.auth.users["broken"] = { email: "broken@example.com" };

    expect(configSchema.safeParse(config).success).toBe(false);
  });

  it("valide 'runs' selon le modèle de run de la RFC-008", () => {
    const config = fullConfig() as { runs: unknown[] };
    config.runs = [{ runName: "member", user: "member", order: 1, routes: ["member-calendar"] }];

    expect(configSchema.safeParse(config).success).toBe(true);
  });

  it("rejette 'runs' contenant un 'runName' dupliqué", () => {
    const config = fullConfig() as { runs: unknown[] };
    config.runs = [
      { runName: "duplicate", order: 1, routes: [] },
      { runName: "duplicate", order: 2, routes: [] },
    ];

    expect(configSchema.safeParse(config).success).toBe(false);
  });

  it("applique les valeurs execution par défaut quand 'execution' est absent (RFC-014/014.5)", () => {
    const result = configSchema.safeParse({ project: {} });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.execution).toEqual({ concurrency: 4, collisionStrategy: "prompt" });
    }
  });

  it("accepte chaque valeur de execution.collisionStrategy (RFC-014.5)", () => {
    for (const strategy of ["prompt", "serialize", "error"]) {
      const result = configSchema.safeParse({ project: {}, execution: { collisionStrategy: strategy } });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.execution.collisionStrategy).toBe(strategy);
      }
    }
  });

  it("rejette une execution.collisionStrategy inconnue (RFC-014.5)", () => {
    expect(
      configSchema.safeParse({ project: {}, execution: { collisionStrategy: "merge" } }).success,
    ).toBe(false);
  });

  it("accepte une valeur execution.concurrency explicite (RFC-014)", () => {
    const result = configSchema.safeParse({ project: {}, execution: { concurrency: 2 } });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.execution.concurrency).toBe(2);
    }
  });

  it("rejette execution.concurrency < 1 (RFC-014)", () => {
    expect(configSchema.safeParse({ project: {}, execution: { concurrency: 0 } }).success).toBe(
      false,
    );
  });

  it("rejette execution.concurrency non entier (RFC-014)", () => {
    expect(configSchema.safeParse({ project: {}, execution: { concurrency: 2.5 } }).success).toBe(
      false,
    );
  });
});
