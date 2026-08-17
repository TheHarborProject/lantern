import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { CONFIG_FILE_NAMES } from "../config/config-file-names.js";
import { createConfigFile } from "../config/create-config-file.js";
import { InitError } from "../errors/init-error.js";
import { configSchema, type LanternConfig } from "../schemas/config.js";
import { ignorePatternsSchema } from "../schemas/ignore-patterns.js";
import { KNOWN_STANDARDS, type Standard } from "../schemas/standards.js";
import { resolvePackageManager, type PackageManager } from "../servers/resolve-package-manager.js";
import { LANTERN_DEFAULTS } from "../config/resolve/lantern-defaults.js";

const LIKELY_START_SCRIPTS = ["dev", "start", "serve", "preview", "storybook"] as const;
const UNLIKELY_START_SCRIPTS = new Set(["lint", "test", "format", "typecheck", "build"]);
const SOURCE_DIRECTORY_CANDIDATES = ["src", "src/components", "components", "app", "packages"] as const;
export const DEFAULT_STANDARD = LANTERN_DEFAULTS.standards[0] ?? "wcag22-aa";

export interface InitProjectInspection {
  readonly projectRoot: string;
  readonly packageJsonPath: string;
  readonly packageManager: PackageManager;
  readonly scripts: readonly string[];
  readonly sourceDirectories: readonly string[];
  readonly existingConfigPath: string | undefined;
}

export interface InitPrompter {
  selectStartScript(scripts: readonly string[]): Promise<string | undefined>;
  selectSourceDirectory(candidates: readonly string[]): Promise<string | undefined>;
  selectStandard(standards: readonly Standard[], defaultStandard: Standard): Promise<Standard | undefined>;
  confirmIgnorePatterns(): Promise<boolean | undefined>;
  inputIgnorePattern(): Promise<string | undefined>;
  confirmAnotherIgnorePattern(): Promise<boolean | undefined>;
}

export interface InitChoices {
  readonly startScript: string;
  readonly sourceDirectory: string;
  readonly standard: Standard;
  readonly ignorePatterns: readonly string[];
}

export interface MinimalInitConfig {
  readonly project: { readonly startScript: string; readonly sourceDirectory?: string };
  readonly standards?: readonly Standard[];
  readonly ignorePatterns?: readonly string[];
}

export type InitProjectResult =
  | { readonly status: "created"; readonly configPath: string; readonly config: LanternConfig }
  | { readonly status: "already-configured"; readonly configPath: string }
  | { readonly status: "cancelled" };

/** Inspect the nearest package project without making filesystem changes. */
export function inspectInitProject(cwd: string): InitProjectInspection {
  const packageJsonPath = findNearestPackageJson(cwd);
  if (packageJsonPath === undefined) {
    throw new InitError(
      `No package.json was found from ${resolve(cwd)} upward. Run \`lantern init\` inside a JavaScript project.`,
    );
  }

  const projectRoot = dirname(packageJsonPath);
  const existingConfigPath = findExistingConfig(projectRoot);
  if (existingConfigPath !== undefined) {
    return {
      projectRoot,
      packageJsonPath,
      packageManager: resolvePackageManager(projectRoot),
      scripts: [],
      sourceDirectories: [],
      existingConfigPath,
    };
  }
  const scripts = readPackageScripts(packageJsonPath);
  return {
    projectRoot,
    packageJsonPath,
    packageManager: resolvePackageManager(projectRoot),
    scripts: prioritizeStartScripts(scripts),
    sourceDirectories: discoverSourceDirectoryCandidates(projectRoot),
    existingConfigPath: undefined,
  };
}

/** Keep every script selectable while presenting likely startup scripts first. */
export function prioritizeStartScripts(scripts: readonly string[]): string[] {
  const likelyOrder = new Map<string, number>(LIKELY_START_SCRIPTS.map((name, index) => [name, index]));
  return [...scripts].sort((left, right) => {
    const leftGroup = scriptGroup(left, likelyOrder);
    const rightGroup = scriptGroup(right, likelyOrder);
    if (leftGroup !== rightGroup) return leftGroup - rightGroup;
    if (leftGroup === 0) return (likelyOrder.get(left) ?? 0) - (likelyOrder.get(right) ?? 0);
    return left.localeCompare(right);
  });
}

/** Construct only the required user decision; schema defaults remain implicit. */
export function createMinimalInitConfig(choices: InitChoices): MinimalInitConfig {
  const config: MinimalInitConfig = {
    project: {
      startScript: choices.startScript,
      ...(choices.sourceDirectory === "." ? {} : { sourceDirectory: choices.sourceDirectory }),
    },
    ...(choices.standard === DEFAULT_STANDARD ? {} : { standards: [choices.standard] }),
    ...(choices.ignorePatterns.length === 0 ? {} : { ignorePatterns: choices.ignorePatterns }),
  };
  configSchema.parse(config);
  return config;
}

/** Suggest only conventional source directories that actually exist. */
export function discoverSourceDirectoryCandidates(projectRoot: string): string[] {
  return SOURCE_DIRECTORY_CANDIDATES.filter((candidate) => isDirectory(join(projectRoot, candidate)));
}

/** Validate and normalize a project-relative component source directory. */
export function normalizeSourceDirectory(projectRoot: string, input: string): string {
  const trimmed = input.trim();
  if (trimmed === "") throw new InitError("The component source path cannot be empty.");
  if (isAbsolute(trimmed)) throw new InitError("The component source path must be relative to the project root.");

  const absolutePath = resolve(projectRoot, trimmed);
  const relativePath = relative(projectRoot, absolutePath);
  if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
    throw new InitError("The component source path must stay inside the project root.");
  }
  if (!isDirectory(absolutePath)) {
    throw new InitError(`Component source directory does not exist: ${trimmed}`);
  }
  return relativePath === "" ? "." : relativePath.split(sep).join("/");
}

/** Trim ignore patterns and discard empty entries before schema validation. */
export function normalizeIgnorePatterns(patterns: readonly string[]): string[] {
  const normalized = patterns.map((pattern) => pattern.trim()).filter((pattern) => pattern !== "");
  return ignorePatternsSchema.parse(normalized);
}

/** Run initialization with an injectable prompt boundary. */
export async function initProject(
  cwd: string,
  prompter: InitPrompter,
  onDetection: (message: string) => void = () => undefined,
): Promise<InitProjectResult> {
  const inspection = inspectInitProject(cwd);
  if (inspection.existingConfigPath !== undefined) {
    return { status: "already-configured", configPath: inspection.existingConfigPath };
  }

  onDetection(`Detected ${inspection.packageManager}`);
  onDetection("Found project configuration");
  const detectedSourceDirectory = inspection.sourceDirectories[0];
  if (detectedSourceDirectory !== undefined) {
    onDetection(`Found source directory: ${detectedSourceDirectory}`);
  }
  if (inspection.scripts.length === 0) {
    throw new InitError(
      `No package.json scripts were found in ${inspection.packageJsonPath}. Add an application startup script, then run \`lantern init\` again.`,
    );
  }

  const startScript = await prompter.selectStartScript(inspection.scripts);
  if (startScript === undefined) return { status: "cancelled" };
  if (!inspection.scripts.includes(startScript)) {
    throw new InitError(`The selected package.json script does not exist: ${startScript}`);
  }

  const sourceSelection = await prompter.selectSourceDirectory(inspection.sourceDirectories);
  if (sourceSelection === undefined) return { status: "cancelled" };
  const sourceDirectory = normalizeSourceDirectory(inspection.projectRoot, sourceSelection);

  const standard = await prompter.selectStandard([...KNOWN_STANDARDS], DEFAULT_STANDARD);
  if (standard === undefined) return { status: "cancelled" };

  const addIgnorePatterns = await prompter.confirmIgnorePatterns();
  if (addIgnorePatterns === undefined) return { status: "cancelled" };
  const ignorePatterns: string[] = [];
  if (addIgnorePatterns) {
    while (true) {
      const pattern = await prompter.inputIgnorePattern();
      if (pattern === undefined) return { status: "cancelled" };
      ignorePatterns.push(pattern);
      const addAnother = await prompter.confirmAnotherIgnorePattern();
      if (addAnother === undefined) return { status: "cancelled" };
      if (!addAnother) break;
    }
  }

  const minimalConfig = createMinimalInitConfig({
    startScript,
    sourceDirectory,
    standard,
    ignorePatterns: normalizeIgnorePatterns(ignorePatterns),
  });
  const configPath = join(inspection.projectRoot, ".lantern", "config.json");
  mkdirSync(dirname(configPath), { recursive: true });
  createConfigFile(configPath, minimalConfig);
  return { status: "created", configPath, config: configSchema.parse(minimalConfig) };
}

function findNearestPackageJson(cwd: string): string | undefined {
  let directory = resolve(cwd);
  while (true) {
    const candidate = join(directory, "package.json");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(directory);
    if (parent === directory) return undefined;
    directory = parent;
  }
}

function readPackageScripts(packageJsonPath: string): string[] {
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
  } catch (cause) {
    throw new InitError(`Could not parse ${packageJsonPath}. Fix its JSON, then run \`lantern init\` again.`, {
      cause,
    });
  }

  if (typeof data !== "object" || data === null) {
    throw new InitError(`${packageJsonPath} must contain a JSON object.`);
  }
  const scripts = (data as { readonly scripts?: unknown }).scripts;
  if (scripts === undefined) return [];
  if (typeof scripts !== "object" || scripts === null || Array.isArray(scripts)) {
    throw new InitError(`The scripts field in ${packageJsonPath} must be an object.`);
  }
  return Object.entries(scripts)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string")
    .map(([name]) => name);
}

function findExistingConfig(projectRoot: string): string | undefined {
  for (const fileName of CONFIG_FILE_NAMES) {
    const candidate = join(projectRoot, fileName);
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

function scriptGroup(script: string, likelyOrder: ReadonlyMap<string, number>): number {
  if (likelyOrder.has(script)) return 0;
  if (UNLIKELY_START_SCRIPTS.has(script)) return 2;
  return 1;
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}
