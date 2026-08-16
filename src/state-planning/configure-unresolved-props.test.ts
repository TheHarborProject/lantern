import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { configurePropResolution, configureSkipComponent } from "./configure-unresolved-props.js";

describe("configureUnresolvedProps", () => {
  let dir: string;
  let configFilePath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "lantern-configure-unresolved-"));
    configFilePath = join(dir, "lantern.config.json");
    writeFileSync(configFilePath, JSON.stringify({ project: {} }));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("persists explicit values for an unresolved prop to lantern.config.json", () => {
    const updated = configurePropResolution(configFilePath, "Avatar", "user", {
      type: "values",
      values: ["guest", "admin"],
    });

    expect(updated.components).toEqual({ Avatar: { props: { user: { values: ["guest", "admin"] } } } });
    const onDisk = JSON.parse(readFileSync(configFilePath, "utf-8")) as { components: unknown };
    expect(onDisk.components).toEqual({ Avatar: { props: { user: { values: ["guest", "admin"] } } } });
  });

  it("persists a skipped component to lantern.config.json", () => {
    configureSkipComponent(configFilePath, "Avatar");

    const onDisk = JSON.parse(readFileSync(configFilePath, "utf-8")) as { components: unknown };
    expect(onDisk.components).toEqual({ Avatar: { skip: true } });
  });

  it("applies sequential resolutions for different props without clobbering each other", () => {
    configurePropResolution(configFilePath, "Avatar", "user", { type: "values", values: ["guest"] });
    configurePropResolution(configFilePath, "Avatar", "size", { type: "values", values: ["sm", "lg"] });

    const onDisk = JSON.parse(readFileSync(configFilePath, "utf-8")) as { components: unknown };
    expect(onDisk.components).toEqual({
      Avatar: { props: { user: { values: ["guest"] }, size: { values: ["sm", "lg"] } } },
    });
  });
});
