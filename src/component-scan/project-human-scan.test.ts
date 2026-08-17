import { describe, expect, it } from "vitest";
import type { CanonicalComponentModel } from "../types/component-scan.js";
import { projectHumanScan } from "./project-human-scan.js";

const model: CanonicalComponentModel = {
  version: 2,
  components: [
    {
      id: "src/Button.tsx#Button",
      source: "src/Button.tsx",
      exportName: "Button",
      name: "Button",
      exportKind: "named",
      props: [
        { name: "disabled", type: "boolean", required: false, origin: "external-inherited", provenance: "typescript/lib/lib.dom.d.ts" },
        { name: "title", type: "string", required: false, origin: "external-inherited", provenance: "typescript/lib/lib.dom.d.ts" },
        { name: "variant", type: '"ghost" | "default"', required: false, origin: "component", provenance: "src/Button.tsx" },
      ],
      rendering: { intrinsicElements: ["button"], analyzable: true },
      analysis: { status: "complete", diagnostics: [] },
    },
  ],
  diagnostics: [{ source: "src/theme.ts", exportName: "Theme", message: "ambiguous" }],
};

describe("projectHumanScan", () => {
  it("keeps only component-owned props and drops inherited DOM props", () => {
    const index = projectHumanScan(model);

    expect(index.components[0]?.props).toEqual([
      { name: "variant", type: '"ghost" | "default"', required: false },
    ]);
  });

  it("preserves identity, source, export metadata, analysis, and diagnostics", () => {
    const index = projectHumanScan(model);

    expect(index).toMatchObject({
      version: 2,
      components: [
        {
          id: "src/Button.tsx#Button",
          source: "src/Button.tsx",
          exportName: "Button",
          name: "Button",
          exportKind: "named",
          analysis: { status: "complete", diagnostics: [] },
        },
      ],
      diagnostics: [{ source: "src/theme.ts", exportName: "Theme", message: "ambiguous" }],
    });
  });
});
