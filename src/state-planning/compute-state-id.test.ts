import { describe, expect, it } from "vitest";
import { computeStateId } from "./compute-state-id.js";

describe("computeStateId", () => {
  it("is stable for the same component and props", () => {
    const props = { variant: "destructive", size: "sm", disabled: true };

    expect(computeStateId("Button.tsx#Button", props)).toBe(
      computeStateId("Button.tsx#Button", props),
    );
  });

  it("is independent of prop key order", () => {
    const a = computeStateId("Button.tsx#Button", { variant: "destructive", size: "sm" });
    const b = computeStateId("Button.tsx#Button", { size: "sm", variant: "destructive" });

    expect(a).toBe(b);
  });

  it("differs when a prop value differs", () => {
    const a = computeStateId("Button.tsx#Button", { variant: "destructive" });
    const b = computeStateId("Button.tsx#Button", { variant: "default" });

    expect(a).not.toBe(b);
  });

  it("differs across components with the same props", () => {
    const a = computeStateId("Button.tsx#Button", { size: "sm" });
    const b = computeStateId("Chip.tsx#Chip", { size: "sm" });

    expect(a).not.toBe(b);
  });

  it("is prefixed with the component id for readability", () => {
    expect(computeStateId("Button.tsx#Button", {})).toBe("Button.tsx#Button#0e815dbc91");
  });
});
