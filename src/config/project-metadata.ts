import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export const SNAPRUN_METADATA_PATH = join(".snaprun", "project.json");

interface ProjectMetadata {
  readonly configPath: string;
}

export interface ReadProjectMetadataResult {
  readonly configPath: string | undefined;
  readonly warning: string | undefined;
}

export function readProjectMetadata(cwd: string): ReadProjectMetadataResult {
  const metadataPath = resolve(cwd, SNAPRUN_METADATA_PATH);

  if (!existsSync(metadataPath)) {
    return { configPath: undefined, warning: undefined };
  }

  try {
    const raw = readFileSync(metadataPath, "utf-8");
    const data = JSON.parse(raw) as unknown;

    if (
      typeof data !== "object" ||
      data === null ||
      typeof (data as { configPath?: unknown }).configPath !== "string"
    ) {
      return {
        configPath: undefined,
        warning: `Ignoring invalid SnapRun project metadata: ${metadataPath}`,
      };
    }

    return { configPath: (data as ProjectMetadata).configPath, warning: undefined };
  } catch {
    return {
      configPath: undefined,
      warning: `Ignoring unreadable SnapRun project metadata: ${metadataPath}`,
    };
  }
}

export function writeProjectMetadata(cwd: string, configPath: string): void {
  const metadataPath = resolve(cwd, SNAPRUN_METADATA_PATH);
  mkdirSync(dirname(metadataPath), { recursive: true });
  writeFileSync(metadataPath, `${JSON.stringify({ configPath }, null, 2)}\n`, "utf-8");
}
