import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ComponentRenderError } from "../errors/component-render-error.js";
import { renderComponentInIsolation } from "./render-component.js";
import type { ComponentBundler, IsolationComponentTarget } from "./types.js";

/** A bundler stub that returns hand-written browser JS (no React/bundling). */
function fakeBundler(script: string): ComponentBundler {
  return () => Promise.resolve(script);
}

const MOUNT_SUCCESS = `
  const root = document.getElementById("root");
  const button = document.createElement("button");
  button.textContent = "Save";
  root.appendChild(button);
  window.__lanternMounted__ = true;
`;

describe("renderComponentInIsolation", () => {
  let project: string;
  let target: IsolationComponentTarget;

  beforeEach(() => {
    project = mkdtempSync(join(tmpdir(), "lantern-render-"));
    writeFileSync(join(project, "Button.tsx"), "export default () => null;");
    target = { name: "Button", sourcePath: join(project, "Button.tsx"), exportName: "default" };
  });

  afterEach(() => {
    rmSync(project, { recursive: true, force: true });
  });

  it("mounts a component alone in the browser and exposes its rendered DOM", async () => {
    const before = readdirSync(project).sort();

    const text = await renderComponentInIsolation(
      { projectRoot: project, target, bundle: fakeBundler(MOUNT_SUCCESS) },
      ({ page }) => page.textContent("#root button"),
    );

    expect(text).toBe("Save");
    // No companion file is written into the project.
    expect(readdirSync(project).sort()).toEqual(before);
  });

  it("injects project-level global styles once into the isolation page", async () => {
    const cssPath = join(project, "globals.css");
    writeFileSync(cssPath, "#root { background-color: rgb(1, 2, 3); }");

    const color = await renderComponentInIsolation(
      {
        projectRoot: project,
        target,
        globals: { globalCssPaths: [cssPath] },
        bundle: fakeBundler(MOUNT_SUCCESS),
      },
      ({ page }) =>
        page.evaluate<string>(
          "getComputedStyle(document.getElementById('root')).backgroundColor",
        ),
    );

    expect(color).toBe("rgb(1, 2, 3)");
  });

  it("surfaces an actionable error describing what the render is missing", async () => {
    const failing = fakeBundler("window.__lanternError__ = \"Cannot find module 'ThemeProvider'\";");

    await expect(
      renderComponentInIsolation(
        { projectRoot: project, target, bundle: failing },
        () => Promise.resolve(undefined),
      ),
    ).rejects.toThrow(/ThemeProvider/);
  });

  it("rejects when the component source is missing", async () => {
    await expect(
      renderComponentInIsolation(
        {
          projectRoot: project,
          target: { ...target, sourcePath: join(project, "Absent.tsx") },
          bundle: fakeBundler(MOUNT_SUCCESS),
        },
        () => Promise.resolve(undefined),
      ),
    ).rejects.toBeInstanceOf(ComponentRenderError);
  });

  it("rejects when a configured global stylesheet is missing", async () => {
    await expect(
      renderComponentInIsolation(
        {
          projectRoot: project,
          target,
          globals: { globalCssPaths: [join(project, "missing.css")] },
          bundle: fakeBundler(MOUNT_SUCCESS),
        },
        () => Promise.resolve(undefined),
      ),
    ).rejects.toThrow(/stylesheet not found/);
  });

  it("reports a timeout when the component never mounts", async () => {
    await expect(
      renderComponentInIsolation(
        {
          projectRoot: project,
          target,
          bundle: fakeBundler("/* never signals mount */"),
          mountTimeoutMs: 500,
        },
        () => Promise.resolve(undefined),
      ),
    ).rejects.toThrow(/did not mount within 500ms/);
  });
});
