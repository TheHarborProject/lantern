import { relative } from "node:path";
import type { Command } from "commander";
import { projectAccessibility } from "../../component-scan/project-accessibility.js";
import { projectHumanScan } from "../../component-scan/project-human-scan.js";
import { runComponentScan } from "../../component-scan/run-component-scan.js";
import { writeAccessibilityIndex } from "../../component-scan/write-accessibility-index.js";
import { writeComponentScanCache } from "../../component-scan/write-component-scan-cache.js";
import { writeScanIndex } from "../../component-scan/write-scan-index.js";
import { loadConfig } from "../../config/load-config.js";
import { LanternError } from "../../errors/lantern-error.js";
import type { GlobalCliOptions } from "../global-cli-options.js";
import { printCliError } from "../print-cli-error.js";

/** Register component-audit discovery commands. */
export function registerAuditCommand(program: Command): void {
  const audit = program.command("audit").description("Manage component accessibility audits.");

  audit
    .command("scan")
    .description("Discover React components and refresh the scan projections.")
    .action((_options, command: Command) => {
      const globalOptions = command.optsWithGlobals<GlobalCliOptions>();
      try {
        const config = loadConfig({ cwd: process.cwd(), explicitPath: globalOptions.config });
        const root = config.project.root;

        const model = runComponentScan(root);
        writeComponentScanCache(root, model);
        const humanIndexPath = writeScanIndex(root, projectHumanScan(model));
        writeAccessibilityIndex(root, projectAccessibility(model));

        const diagnosticSuffix = model.diagnostics.length === 0
          ? ""
          : `, ${model.diagnostics.length} requiring review`;
        console.log(
          `Discovered ${model.components.length} components${diagnosticSuffix}. Index: ${relative(process.cwd(), humanIndexPath)}`,
        );
      } catch (error) {
        if (error instanceof LanternError) {
          printCliError(error, globalOptions.debug ?? false);
          process.exitCode = 1;
          return;
        }
        throw error;
      }
    });
}
