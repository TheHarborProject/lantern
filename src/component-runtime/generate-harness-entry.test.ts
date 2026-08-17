import { describe, expect, it } from "vitest";
import { generateHarnessEntry } from "./generate-harness-entry.js";

describe("generateHarnessEntry", () => {
  it("imports a default export and delegates to the maintained harness without serializing props", () => {
    const entry = generateHarnessEntry({
      componentImportPath: "/project/src/Button.tsx",
      exportName: "default",
      props: { label: "Save", disabled: false },
    });

    expect(entry).toContain('import LanternComponent from "/project/src/Button.tsx";');
    expect(entry).toContain("mountLanternHarness({ component: LanternComponent });");
    expect(entry).not.toContain("Save");
    expect(entry).not.toContain("disabled");
    expect(entry).not.toContain("LanternWrapper");
  });

  it("imports a named export via an alias", () => {
    const entry = generateHarnessEntry({
      componentImportPath: "/project/src/ui.tsx",
      exportName: "Button",
      props: {},
    });

    expect(entry).toContain('import { Button as LanternComponent } from "/project/src/ui.tsx";');
  });

  it("wraps the component in the shared provider when configured", () => {
    const entry = generateHarnessEntry({
      componentImportPath: "/project/src/Button.tsx",
      exportName: "default",
      props: {},
      wrapperImportPath: "/project/lantern/wrapper.tsx",
      wrapperExport: "Providers",
    });

    expect(entry).toContain('import { Providers as LanternWrapper } from "/project/lantern/wrapper.tsx";');
    expect(entry).toContain("mountLanternHarness({ component: LanternComponent, wrapper: LanternWrapper });");
  });

  it("reports an actionable failure instead of throwing", () => {
    const entry = generateHarnessEntry({
      componentImportPath: "/project/src/Button.tsx",
      exportName: "default",
      props: {},
    });

    expect(entry).toContain("mountLanternHarness");
    expect(entry).not.toContain("componentDidCatch");
  });
});
