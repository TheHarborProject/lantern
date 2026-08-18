import { relative } from "node:path";
import type { Command } from "commander";
import { loadConfig } from "../../config/load-config.js";
import { scanProject } from "../../scan/scan-service.js";
import { SCAN_INDEX_PATH } from "../../component-scan/artifact-paths.js";
import { LanternError } from "../../errors/lantern-error.js";
import type { GlobalCliOptions } from "../global-cli-options.js";
import { printCliError } from "../print-cli-error.js";

export function registerScanCommand(program: Command): void {
  program.command("scan")
    .description("Discover or refresh the canonical component model.")
    .option("--all", "Force a complete discovery rebuild")
    .action((options: { readonly all?: boolean }, command: Command) => runScanCommand(options.all === true, command));
}

export function runScanCommand(force: boolean, command: Command, deprecated = false): void {
  const globalOptions = command.optsWithGlobals<GlobalCliOptions>();
  try {
    if (deprecated) console.error('Warning: "lantern audit scan" is deprecated; use "lantern scan".');
    const config = loadConfig({ cwd: process.cwd(), explicitPath: globalOptions.config });
    const result = scanProject({ root: config.project.root, sourceDirectory: config.project.sourceDirectory, ignorePatterns: config.ignorePatterns, force });
    const d = result.delta;
    const suffix = `new ${d.new.length}, changed ${d.changed.length}, unchanged ${d.unchanged.length}, removed ${d.removed.length}`;
    const verb = deprecated ? "Discovered" : result.refreshed ? "Scanned" : "Reused scan for";
    console.log(`${verb} ${result.model.components.length} components (${suffix}). Index: ${relative(process.cwd(), `${config.project.root}/${SCAN_INDEX_PATH}`)}`);
  } catch (error) {
    if (error instanceof LanternError) { printCliError(error, globalOptions.debug ?? false); process.exitCode = 2; return; }
    throw error;
  }
}
