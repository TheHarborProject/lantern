import { existsSync } from "node:fs";
import { relative, resolve } from "node:path";
import { ConfigNotFoundError } from "../errors/config-not-found-error.js";
import { CONFIG_FILE_NAMES } from "./config-file-names.js";
import { readProjectMetadata, writeProjectMetadata } from "./project-metadata.js";

export type ConfigResolutionSource = "explicit" | "remembered" | "conventional";

export interface ResolvedConfigPath {
  readonly path: string;
  readonly source: ConfigResolutionSource;
}

export interface ResolveConfigPathOptions {
  readonly cwd: string;
  readonly explicitConfigPath?: string | undefined;
  readonly onWarning?: ((message: string) => void) | undefined;
}

export function resolveConfigPath(options: ResolveConfigPathOptions): ResolvedConfigPath {
  const { cwd, explicitConfigPath } = options;

  if (explicitConfigPath !== undefined) {
    const path = resolve(cwd, explicitConfigPath);

    if (!existsSync(path)) {
      throw new ConfigNotFoundError(`Explicit configuration file not found: ${path}`);
    }

    return { path, source: "explicit" };
  }

  const metadata = readProjectMetadata(cwd);

  if (metadata.warning !== undefined) {
    options.onWarning?.(metadata.warning);
  }

  if (metadata.configPath !== undefined) {
    const rememberedPath = resolve(cwd, metadata.configPath);

    if (existsSync(rememberedPath)) {
      return { path: rememberedPath, source: "remembered" };
    }

    options.onWarning?.(
      `Remembered SnapRun configuration no longer exists: ${rememberedPath}. Falling back to conventional file names.`,
    );
  }

  for (const fileName of CONFIG_FILE_NAMES) {
    const candidate = resolve(cwd, fileName);

    if (existsSync(candidate)) {
      return { path: candidate, source: "conventional" };
    }
  }

  throw new ConfigNotFoundError(
    `No SnapRun configuration could be found in ${cwd}. Checked remembered metadata and these file names: ${CONFIG_FILE_NAMES.join(", ")}.`,
  );
}

export function rememberConfigPath(cwd: string, configPath: string): void {
  writeProjectMetadata(cwd, toPortableRelativePath(cwd, configPath));
}

function toPortableRelativePath(cwd: string, configPath: string): string {
  const relativePath = relative(cwd, configPath).replaceAll("\\", "/");

  if (relativePath === "") {
    return "./";
  }

  if (relativePath.startsWith(".") || relativePath.startsWith("..")) {
    return relativePath;
  }

  return `./${relativePath}`;
}
