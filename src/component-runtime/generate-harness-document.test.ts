import { describe, expect, it } from "vitest";
import { generateHarnessDocument } from "./generate-harness-document.js";

describe("generateHarnessDocument", () => {
  it("produces a minimal page with a single #root mount point", () => {
    const html = generateHarnessDocument([]);

    expect(html).toContain("<!doctype html>");
    expect(html).toContain('<div id="root"></div>');
    expect(html).not.toContain("<style>");
  });

  it("inlines every configured global stylesheet in order", () => {
    const html = generateHarnessDocument(["body { margin: 0; }", ".btn { color: red; }"]);

    expect(html).toContain("body { margin: 0; }");
    expect(html).toContain(".btn { color: red; }");
    expect(html.indexOf("body { margin: 0; }")).toBeLessThan(html.indexOf(".btn { color: red; }"));
  });

  it("is deterministic", () => {
    expect(generateHarnessDocument(["a{}"])).toBe(generateHarnessDocument(["a{}"]));
  });
});
