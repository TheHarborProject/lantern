import { describe, expect, it } from "vitest";
import { generateHarnessEntry } from "./generate-harness-entry.js";

describe("generateHarnessEntry", () => {
  it("imports a default export, serializes props, and mounts into #root", () => {
    const entry = generateHarnessEntry({
      componentImportPath: "/project/src/Button.tsx",
      exportName: "default",
      props: { label: "Save", disabled: false },
    });

    expect(entry).toContain('import LanternComponent from "/project/src/Button.tsx";');
    expect(entry).toContain('const props = {"label":"Save","disabled":false};');
    expect(entry).toContain('document.getElementById("root")');
    expect(entry).toContain("createRoot(container).render(tree);");
    expect(entry).toContain("window.__lanternMounted__ = true;");
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
    expect(entry).toContain("createElement(LanternWrapper, null, rendered)");
  });

  it("reports an actionable failure instead of throwing", () => {
    const entry = generateHarnessEntry({
      componentImportPath: "/project/src/Button.tsx",
      exportName: "default",
      props: {},
    });

    expect(entry).toContain("window.__lanternError__");
    expect(entry).toContain("componentDidCatch");
  });
});
