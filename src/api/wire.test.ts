import { describe, expect, it } from "vitest";
import type { LintReport } from "../lint/types.js";
import { auditWireSchema, toAuditWireDto } from "./wire.js";

const report: LintReport = {
  version: 3, runId: "run-1", startedAt: "2026-01-01T00:00:00.000Z", finishedAt: "2026-01-01T00:00:00.001Z", status: "completed", generatedAt: "2026-01-01T00:00:00.000Z",
  targeting: { mode: { kind: "all" }, rescanned: true }, engines: [{ id: "test", version: "1", capabilities: ["static-evidence"] }], config: { standards: ["wcag22-aa"], rules: { "lantern/test": "error" } }, diagnostics: [],
  standards: [{ standard: "wcag22-aa", components: [{ componentId: "Button.tsx#Button", component: "Button", source: "Button.tsx", planStatus: "ready", status: "fail", truncated: false, totalPossibleStates: 1, maxStates: 50, states: [{ componentId: "Button.tsx#Button", stateId: "state-1", props: {}, propProvenance: {}, status: "fail", checks: [{ checkId: "check-1", componentId: "Button.tsx#Button", stateId: "state-1", ruleId: "lantern/test", severity: "error", status: "fail", evidence: [{ kind: "observation", name: "tabIndex", value: -1 }], durationMs: 1 }] }] }] }],
  summary: { componentsPass: 0, componentsFail: 1, componentsReview: 0, componentsSkipped: 0, checksPass: 0, checksFail: 1, checksReview: 0, durationMs: 1 },
};

/**
 * A representative report exercising every branch the wire schema needs to
 * validate structurally (RFC-009.1): every evidence kind, engine/location
 * provenance, outcome reasons, propProvenance vocabulary, targeting
 * selection variants, and a check-scoped diagnostic — not just "is JSON".
 */
const fullReport: LintReport = {
  version: 3,
  runId: "run-2",
  startedAt: "2026-01-01T00:00:00.000Z",
  finishedAt: "2026-01-01T00:00:00.050Z",
  status: "completed",
  generatedAt: "2026-01-01T00:00:00.000Z",
  targeting: {
    mode: { kind: "path", path: "src/Button.tsx" },
    rescanned: true,
    selection: { kind: "path", path: "src/Button.tsx", pathKind: "file", componentCount: 1 },
  },
  engines: [
    { id: "lantern-static", version: "1.0.0", capabilities: ["static-evidence"] },
    { id: "lantern-rendered-dom", version: "1.0.0", capabilities: ["rendered-dom"] },
  ],
  config: { standards: ["wcag22-aa"], rules: { "lantern/accessible-name": "error", "lantern/keyboard-access": "error" } },
  diagnostics: [
    {
      code: "CHECK_OPERATIONAL_ERROR",
      severity: "error",
      scope: "check",
      source: "Button.tsx",
      component: "Button",
      componentId: "Button.tsx#Button",
      stateId: "state-1",
      checkId: "check-2",
      engine: { name: "lantern-rendered-dom", version: "1.0.0" },
      message: "render probe crashed",
    },
  ],
  standards: [
    {
      standard: "wcag22-aa",
      components: [
        {
          componentId: "Button.tsx#Button",
          component: "Button",
          source: "Button.tsx",
          planStatus: "ready",
          status: "review",
          states: [
            {
              componentId: "Button.tsx#Button",
              stateId: "state-1",
              props: { label: "Save", onClick: null },
              propProvenance: { label: "explicit", onClick: "fixture", variant: "inferred" },
              status: "review",
              reason: "State-level explanation survives serialization.",
              checks: [
                {
                  checkId: "check-1",
                  componentId: "Button.tsx#Button",
                  stateId: "state-1",
                  ruleId: "lantern/accessible-name",
                  severity: "error",
                  status: "review",
                  message: "cannot confirm at runtime",
                  location: { file: "Button.tsx", line: 3, column: 5 },
                  engine: { name: "lantern-static", version: "1.0.0" },
                  outcomeReason: "inconclusive",
                  reason: "static evidence only",
                  evidence: [
                    { kind: "observation", name: "accessibleNameSources", value: ["aria-label"] },
                    { kind: "expectation", expected: "a name source is populated", observed: "unknown" },
                    { kind: "element", selector: "#save", html: "<button id=\"save\">Save</button>" },
                    { kind: "attribute", name: "aria-label", value: "Save" },
                    { kind: "source", location: { file: "Button.tsx", line: 3 } },
                    { kind: "capability", required: "rendered-dom", attempts: [{ engine: "lantern-rendered-dom", reason: "not focusable" }] },
                  ],
                  durationMs: 2,
                },
                {
                  checkId: "check-2",
                  componentId: "Button.tsx#Button",
                  stateId: "state-1",
                  ruleId: "lantern/keyboard-access",
                  severity: "error",
                  status: "review",
                  outcomeReason: "operational-error",
                  message: "operational failure",
                  reason: "render probe crashed",
                  engine: { name: "lantern-rendered-dom", version: "1.0.0" },
                  evidence: [{ kind: "observation", name: "operationalError", value: "render probe crashed" }],
                  durationMs: 5,
                },
              ],
            },
          ],
          dimensions: [{ name: "variant", values: ["a", "b"], source: "inferred" }],
          truncated: false,
          totalPossibleStates: 1,
          maxStates: 50,
        },
      ],
    },
  ],
  summary: { componentsPass: 0, componentsFail: 0, componentsReview: 1, componentsSkipped: 0, checksPass: 0, checksFail: 0, checksReview: 2, durationMs: 50 },
};

describe("audit wire DTO", () => {
  it("explicitly converts and validates a JSON-safe hierarchy", () => {
    const wire = toAuditWireDto(report);
    expect(auditWireSchema.parse(wire)).toEqual(wire);
    expect(JSON.parse(JSON.stringify(wire))).toEqual(wire);
    expect(JSON.stringify(wire.standards)).toContain('"checkId":"check-1"');
    expect(JSON.stringify(wire.standards)).toContain('"name":"tabIndex","value":-1');
  });

  it("validates the complete DTO shape: every evidence kind, provenance, targeting selection, and check-scoped diagnostic", () => {
    const wire = toAuditWireDto(fullReport);

    expect(() => auditWireSchema.parse(wire)).not.toThrow();
    expect(wire.targeting).toEqual({
      mode: { kind: "path", path: "src/Button.tsx" },
      rescanned: true,
      selection: { kind: "path", path: "src/Button.tsx", pathKind: "file", componentCount: 1 },
    });
    expect(wire.diagnostics).toEqual([
      {
        code: "CHECK_OPERATIONAL_ERROR",
        severity: "error",
        scope: "check",
        source: "Button.tsx",
        component: "Button",
        componentId: "Button.tsx#Button",
        stateId: "state-1",
        checkId: "check-2",
        engine: { name: "lantern-rendered-dom", version: "1.0.0" },
        message: "render probe crashed",
      },
    ]);

    const state = wire.standards[0]?.components[0]?.states[0];
    expect(state?.propProvenance).toEqual({ label: "explicit", onClick: "fixture", variant: "inferred" });
    expect(state?.checks.map((check) => check.checkId)).toEqual(["check-1", "check-2"]);
    expect(state?.checks[0]?.evidence.map((evidence) => evidence.kind)).toEqual([
      "observation", "expectation", "element", "attribute", "source", "capability",
    ]);
    expect(state?.checks[1]).toMatchObject({ outcomeReason: "operational-error", reason: "render probe crashed" });
    expect(state?.reason).toBe("State-level explanation survives serialization.");
    expect(wire.standards[0]?.components[0]?.dimensions).toEqual([{ name: "variant", values: ["a", "b"], source: "inferred" }]);

    expect(JSON.parse(JSON.stringify(wire))).toEqual(wire);
  });

  it("rejects a payload where the internal model no longer matches wire v1 instead of silently passing it through", () => {
    const drifted = {
      ...report,
      standards: [
        {
          standard: "wcag22-aa",
          components: [
            {
              ...report.standards[0]?.components[0],
              // Simulates an internal rename that wire v1 doesn't know about:
              // `checkId` renamed to `id` on one check.
              states: [
                {
                  ...report.standards[0]?.components[0]?.states[0],
                  checks: [{ ...report.standards[0]?.components[0]?.states[0]?.checks[0], id: "check-1", checkId: undefined }],
                },
              ],
            },
          ],
        },
      ],
    } as unknown as LintReport;

    expect(() => toAuditWireDto(drifted)).toThrow();
  });

  it("rejects non-finite numbers instead of letting them silently become null over JSON", () => {
    const withNaN = {
      ...report,
      summary: { ...report.summary, durationMs: Number.NaN },
    } as unknown as LintReport;

    expect(() => toAuditWireDto(withNaN)).toThrow();
  });

  it("strips fields the wire schema does not know about instead of leaking them", () => {
    const withExtra = {
      ...report,
      standards: [
        {
          standard: "wcag22-aa",
          components: [
            {
              ...report.standards[0]?.components[0],
              internalDebugHandle: { notJsonSafe: (): undefined => undefined },
            },
          ],
        },
      ],
    } as unknown as LintReport;

    const wire = toAuditWireDto(withExtra);
    expect(wire.standards[0]?.components[0]).not.toHaveProperty("internalDebugHandle");
  });
});
