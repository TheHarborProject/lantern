import { describe, expect, it } from "vitest";
import type { LintReport } from "../lint/types.js";
import { auditWireSchema, toAuditWireDto } from "./wire.js";

const report: LintReport = {
  version: 3, runId: "run-1", startedAt: "2026-01-01T00:00:00.000Z", finishedAt: "2026-01-01T00:00:00.001Z", status: "completed", generatedAt: "2026-01-01T00:00:00.000Z",
  targeting: { mode: { kind: "all" }, rescanned: true }, engines: [{ id: "test", version: "1", capabilities: ["static-evidence"] }], config: { standards: ["wcag22-aa"], rules: { "lantern/test": "error" } }, diagnostics: [],
  standards: [{ standard: "wcag22-aa", components: [{ componentId: "Button.tsx#Button", component: "Button", source: "Button.tsx", planStatus: "ready", status: "fail", truncated: false, totalPossibleStates: 1, maxStates: 50, states: [{ componentId: "Button.tsx#Button", stateId: "state-1", props: {}, propProvenance: {}, status: "fail", checks: [{ checkId: "check-1", componentId: "Button.tsx#Button", stateId: "state-1", ruleId: "lantern/test", severity: "error", status: "fail", evidence: [{ kind: "observation", name: "tabIndex", value: -1 }], durationMs: 1 }] }] }] }],
  summary: { componentsPass: 0, componentsFail: 1, componentsReview: 0, componentsSkipped: 0, checksPass: 0, checksFail: 1, checksReview: 0, durationMs: 1 },
};

describe("audit wire DTO", () => {
  it("explicitly converts and validates a JSON-safe hierarchy", () => {
    const wire = toAuditWireDto(report);
    expect(auditWireSchema.parse(wire)).toEqual(wire);
    expect(JSON.parse(JSON.stringify(wire))).toEqual(wire);
    expect(JSON.stringify(wire.standards)).toContain('"checkId":"check-1"');
    expect(JSON.stringify(wire.standards)).toContain('"name":"tabIndex","value":-1');
  });
});
