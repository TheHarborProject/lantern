import { describe, expect, it } from "vitest";
import { historyTestRun } from "../testing/history-test-run.js";
import { resolveInteractiveDefaults, toggleAllComponents, updateSelectedComponents, validateInteractiveSelection } from "./selection.js";
import type { SelectableComponent } from "./types.js";

const components: readonly SelectableComponent[] = [
  { id: "a", name: "A", source: "a.tsx", states: [{ id: "a1", label: "one" }, { id: "a2", label: "two" }] },
  { id: "b", name: "B", source: "b.tsx", states: [{ id: "b1", label: "default" }] },
];
const delta = { new: ["b"], changed: ["a"], unchanged: [], removed: ["gone"] };

describe("interactive survey selection", () => {
  it("resolves all and changed from canonical IDs", () => {
    expect(resolveInteractiveDefaults({ strategy: "all", components, delta }).selection.componentIds).toEqual(["a", "b"]);
    expect(resolveInteractiveDefaults({ strategy: "changed", components, delta }).selection.componentIds).toEqual(["a", "b"]);
  });
  it("keeps an empty changed default explicit", () => {
    const result = resolveInteractiveDefaults({ strategy: "changed", components, delta: { new: [], changed: [], unchanged: ["a", "b"], removed: [] } });
    expect(result.selection.componentIds).toEqual([]);
    expect(result.notes[0]).toMatch(/No new or changed/);
  });
  it("uses previous targeting and visibly drops removed IDs", () => {
    const previous = historyTestRun("11111111-1111-4111-8111-111111111111", "2026-01-01T00:00:00.000Z", {
      targeting: { source: "interactive", componentIds: ["a", "gone"], stateIds: ["a1", "missing"], scan: { fingerprint: "b".repeat(64), wasStale: false, refreshed: false } },
    });
    const result = resolveInteractiveDefaults({ strategy: "previous", components, delta, previous });
    expect(result.selection).toEqual({ componentIds: ["a"], states: { kind: "restricted", ids: ["a1"] } });
    expect(result.notes).toHaveLength(2);
  });
  it("falls back to all when previous history is absent", () => {
    const result = resolveInteractiveDefaults({ strategy: "previous", components, delta });
    expect(result.selection.componentIds).toEqual(["a", "b"]);
    expect(result.notes[0]).toMatch(/No previous/);
  });
  it("supports toggle-all and validates empty and unknown selections", () => {
    expect(toggleAllComponents(components, [])).toEqual(["a", "b"]);
    expect(toggleAllComponents(components, ["a", "b"])).toEqual([]);
    expect(() => validateInteractiveSelection({ componentIds: [], states: { kind: "all" } }, components)).toThrow(/at least one/);
    expect(() => validateInteractiveSelection({ componentIds: ["a"], states: { kind: "restricted", ids: ["bad"] } }, components)).toThrow(/Unknown interactive state/);
  });
  it("preserves previous state restrictions and gives newly selected components all states", () => {
    const result = updateSelectedComponents({ componentIds: ["a"], states: { kind: "restricted", ids: ["a1"] } }, ["a", "b"], components);
    expect(result).toEqual({ componentIds: ["a", "b"], states: { kind: "restricted", ids: ["a1", "b1"] } });
  });
});
