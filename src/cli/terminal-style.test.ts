import { describe, expect, it } from "vitest";
import { createTerminalStyle, shouldUseColor } from "./terminal-style.js";

describe("terminal style", () => {
  it("maps semantic roles to distinct styles when enabled", () => {
    const style = createTerminalStyle(true);
    const values = [style.success("status"), style.failure("status"), style.review("status"), style.skipped("status"), style.accent("status"), style.strong("status")];
    expect(new Set(values).size).toBe(values.length);
    expect(values.every((value) => value.includes("status") && value.includes("\u001b["))).toBe(true);
  });

  it("degrades every semantic role to unchanged plain text", () => {
    const style = createTerminalStyle(false);
    expect([style.success("text"), style.failure("text"), style.review("text"), style.skipped("text"), style.error("text"), style.accent("text"), style.muted("text"), style.strong("text")]).toEqual(Array.from({ length: 8 }, () => "text"));
  });

  it("requires a TTY and respects NO_COLOR", () => {
    expect(shouldUseColor(true, {})).toBe(true);
    expect(shouldUseColor(false, {})).toBe(false);
    expect(shouldUseColor(true, { NO_COLOR: "" })).toBe(false);
  });
});
