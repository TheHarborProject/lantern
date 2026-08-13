import { describe, expect, it } from "vitest";
import { buildSerializeGates } from "./serialize-gates.js";
import type { CollisionGroup, RunCapturePlan } from "./types.js";

function capture(captureId: string, order: number): RunCapturePlan {
  return {
    captureId,
    filePath: "/out/dashboard.png",
    runName: "run",
    routeId: "dashboard",
    index: order,
    order,
    plannedRoute: {} as RunCapturePlan["plannedRoute"],
  };
}

function group(captureIds: readonly string[]): CollisionGroup {
  return {
    filePath: "/out/dashboard.png",
    captures: captureIds.map((id, i) => capture(id, i + 1)),
  };
}

describe("buildSerializeGates", () => {
  it("le premier de chaque groupe n'attend rien, les suivants attendent le précédent", () => {
    const gates = buildSerializeGates([group(["a", "b", "c"])]);

    expect(gates.get("a")?.before).toBeUndefined();
    expect(gates.get("b")?.before).toBeInstanceOf(Promise);
    expect(gates.get("c")?.before).toBeInstanceOf(Promise);
  });

  it("sérialise les écritures dans l'ordre du groupe, quel que soit l'ordre de démarrage", async () => {
    const gates = buildSerializeGates([group(["a", "b", "c"])]);
    const writeOrder: string[] = [];

    async function run(captureId: string): Promise<void> {
      const gate = gates.get(captureId);
      if (gate?.before !== undefined) {
        await gate.before;
      }
      writeOrder.push(captureId);
      gate?.done();
    }

    // Démarrage volontairement dans le désordre : l'ordre d'écriture doit
    // rester déterministe (ordre du groupe).
    await Promise.all([run("c"), run("a"), run("b")]);

    expect(writeOrder).toEqual(["a", "b", "c"]);
  });

  it("done() est idempotent : le relâcher deux fois ne bloque jamais la chaîne", async () => {
    const gates = buildSerializeGates([group(["a", "b"])]);

    const gateA = gates.get("a");
    gateA?.done();
    gateA?.done(); // second appel sans effet

    // 'b' doit pouvoir progresser après 'a'.
    await expect(gates.get("b")?.before).resolves.toBeUndefined();
  });

  it("ne crée aucune gate pour des captures hors collision", () => {
    expect(buildSerializeGates([]).size).toBe(0);
  });

  it("traite les groupes indépendamment (une chaîne par chemin)", () => {
    const gates = buildSerializeGates([
      { filePath: "/out/a.png", captures: [capture("a1", 1), capture("a2", 2)] },
      { filePath: "/out/b.png", captures: [capture("b1", 3), capture("b2", 4)] },
    ]);

    expect(gates.get("a1")?.before).toBeUndefined();
    expect(gates.get("b1")?.before).toBeUndefined();
    expect(gates.get("a2")?.before).toBeInstanceOf(Promise);
    expect(gates.get("b2")?.before).toBeInstanceOf(Promise);
  });
});
