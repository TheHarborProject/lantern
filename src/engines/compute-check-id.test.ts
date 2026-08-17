import { describe, expect, it } from "vitest";
import { computeCheckId } from "./compute-check-id.js";

describe("computeCheckId", () => {
  it("is deterministic and distinguishes states, rules, and future instances", () => {
    const id = computeCheckId("Button.tsx#Button", "state-a", "lantern/keyboard-access");
    expect(id).toBe("state-a#check-7d197a638138");
    expect(computeCheckId("Button.tsx#Button", "state-a", "lantern/keyboard-access")).toBe(id);
    expect(computeCheckId("Button.tsx#Button", "state-b", "lantern/keyboard-access")).not.toBe(id);
    expect(computeCheckId("Button.tsx#Button", "state-a", "lantern/accessible-name")).not.toBe(id);
    expect(
      computeCheckId("Button.tsx#Button", "state-a", "lantern/keyboard-access", "second"),
    ).not.toBe(id);
  });
});
