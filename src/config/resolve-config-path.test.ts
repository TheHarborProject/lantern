import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigNotFoundError } from "../errors/config-not-found-error.js";
import { SNAPRUN_METADATA_PATH } from "./project-metadata.js";
import { rememberConfigPath, resolveConfigPath } from "./resolve-config-path.js";

describe("resolveConfigPath", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "snaprun-resolve-config-path-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("prioritizes an explicit --config path", () => {
    writeFileSync(join(dir, "snaprun.config.json"), "{}");
    writeFileSync(join(dir, "custom.json"), "{}");

    expect(resolveConfigPath({ cwd: dir, explicitConfigPath: "./custom.json" })).toEqual({
      path: join(dir, "custom.json"),
      source: "explicit",
    });
  });

  it("uses a remembered config path when present", () => {
    writeFileSync(join(dir, "config.json"), "{}");
    rememberConfigPath(dir, join(dir, "config.json"));

    expect(resolveConfigPath({ cwd: dir })).toEqual({
      path: join(dir, "config.json"),
      source: "remembered",
    });
  });

  it("falls back to snaprun.config.json when no remembered config exists", () => {
    writeFileSync(join(dir, "snaprun.config.json"), "{}");

    expect(resolveConfigPath({ cwd: dir })).toEqual({
      path: join(dir, "snaprun.config.json"),
      source: "conventional",
    });
  });

  it("supports .snaprun.json as a conventional file name", () => {
    writeFileSync(join(dir, ".snaprun.json"), "{}");

    expect(resolveConfigPath({ cwd: dir })).toEqual({
      path: join(dir, ".snaprun.json"),
      source: "conventional",
    });
  });

  it("lets explicit --config override a remembered config path", () => {
    writeFileSync(join(dir, "remembered.json"), "{}");
    writeFileSync(join(dir, "explicit.json"), "{}");
    rememberConfigPath(dir, join(dir, "remembered.json"));

    expect(resolveConfigPath({ cwd: dir, explicitConfigPath: "./explicit.json" })).toEqual({
      path: join(dir, "explicit.json"),
      source: "explicit",
    });
  });

  it("warns and falls back when the remembered config file was deleted", () => {
    writeFileSync(join(dir, "snaprun.config.json"), "{}");
    rememberConfigPath(dir, join(dir, "missing.json"));
    const warn = vi.fn();

    expect(resolveConfigPath({ cwd: dir, onWarning: warn })).toEqual({
      path: join(dir, "snaprun.config.json"),
      source: "conventional",
    });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Remembered SnapRun configuration no longer exists"),
    );
  });

  it("warns and falls back when project metadata contains invalid JSON", () => {
    const metadataPath = join(dir, SNAPRUN_METADATA_PATH);
    mkdirSync(join(dir, ".snaprun"), { recursive: true });
    writeFileSync(metadataPath, "{ broken");
    writeFileSync(join(dir, "snaprun.config.json"), "{}");
    const warn = vi.fn();

    expect(resolveConfigPath({ cwd: dir, onWarning: warn })).toEqual({
      path: join(dir, "snaprun.config.json"),
      source: "conventional",
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Ignoring unreadable"));
  });

  it("throws a clear error when no configuration is available", () => {
    expect(() => resolveConfigPath({ cwd: dir })).toThrow(ConfigNotFoundError);
  });

  it("stores remembered config paths relative to the project directory", () => {
    mkdirSync(join(dir, "config"), { recursive: true });
    writeFileSync(join(dir, "config", "snaprun.json"), "{}");
    rememberConfigPath(dir, join(dir, "config", "snaprun.json"));

    const metadata = JSON.parse(readFileSync(join(dir, SNAPRUN_METADATA_PATH), "utf-8")) as {
      configPath: string;
    };

    expect(metadata.configPath).toBe("./config/snaprun.json");
  });
});
