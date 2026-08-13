import { routeHasPlaceholderParameters } from "../scan/route-has-placeholder-parameters.js";
import type { ScanResult } from "../types/scan-result.js";

/** Format the `snaprun scan` result for console output (RFC-006). */
export function formatScanSummary(result: ScanResult): string {
  const lines: string[] = [`Using configuration: ${result.configFilePath}`, ""];

  lines.push(`Added (${result.added.length})`);
  for (const route of result.added) {
    const placeholderNotice = routeHasPlaceholderParameters(route)
      ? " - manual parameter setup is required before this route can be enabled"
      : "";
    lines.push(`  + ${route.path} (${route.id})${placeholderNotice}`);
  }

  lines.push(`Unchanged (${result.unchanged.length})`);

  lines.push(`Potentially obsolete (${result.obsolete.length})`);
  for (const route of result.obsolete) {
    lines.push(`  ? ${route.path} (${route.id})`);
  }

  lines.push(`Unsupported catch-all routes (${result.unsupportedCatchAll.length})`);
  for (const route of result.unsupportedCatchAll) {
    lines.push(`  ! ${route.path} - cannot be configured automatically and was not added`);
  }

  lines.push("");
  lines.push(result.fileModified ? "Configuration file updated." : "Configuration file unchanged.");

  return lines.join("\n");
}
