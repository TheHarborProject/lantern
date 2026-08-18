import type { Command } from "commander";
import { runScanCommand } from "./scan.js";

/** Register component-audit discovery commands. */
export function registerAuditCommand(program: Command): void {
  const audit = program.command("audit").description("Manage component accessibility audits.");

  audit
    .command("scan")
    .description("Discover React components and refresh the scan projections.")
    .action((_options, command: Command) => runScanCommand(true, command, true));
}
