import { describe, expect, it } from "vitest";
import type { ScanResult } from "../types/scan-result.js";
import { formatScanSummary } from "./format-scan-summary.js";

describe("formatScanSummary", () => {
  it("inclut le chemin de configuration, les compteurs et l'état du fichier", () => {
    const result: ScanResult = {
      configFilePath: "/project/snaprun.config.json",
      added: [{ id: "blog", path: "/blog", enableSnapshot: false }],
      unchanged: [{ id: "home", path: "/", enableSnapshot: true }],
      obsolete: [{ id: "gone", path: "/gone", enableSnapshot: false }],
      unsupportedCatchAll: [],
      fileModified: true,
    };

    const output = formatScanSummary(result);

    expect(output).toContain("/project/snaprun.config.json");
    expect(output).toContain("Added (1)");
    expect(output).toContain("/blog (blog)");
    expect(output).toContain("Unchanged (1)");
    expect(output).toContain("Potentially obsolete (1)");
    expect(output).toContain("/gone (gone)");
    expect(output).toContain("Configuration file updated.");
  });

  it("indique que le fichier est inchangé si fileModified est faux", () => {
    const result: ScanResult = {
      configFilePath: "/project/snaprun.config.json",
      added: [],
      unchanged: [],
      obsolete: [],
      unsupportedCatchAll: [],
      fileModified: false,
    };

    expect(formatScanSummary(result)).toContain("Configuration file unchanged.");
  });

  it("signale une route dynamique ajoutée comme nécessitant une configuration manuelle", () => {
    const result: ScanResult = {
      configFilePath: "/project/snaprun.config.json",
      added: [
        {
          id: "stays-stayId",
          path: "/stays/[stayId]",
          isDynamic: true,
          parameters: { stayId: "REPLACE_ME" },
          enableSnapshot: false,
        },
      ],
      unchanged: [],
      obsolete: [],
      unsupportedCatchAll: [],
      fileModified: true,
    };

    expect(formatScanSummary(result)).toContain(
      "manual parameter setup is required before this route can be enabled",
    );
  });

  it("liste les routes catch-all non prises en charge", () => {
    const result: ScanResult = {
      configFilePath: "/project/snaprun.config.json",
      added: [],
      unchanged: [],
      obsolete: [],
      unsupportedCatchAll: [
        {
          path: "/docs/[...slug]",
          filePath: "/project/app/docs/[...slug]/page.tsx",
          router: "app",
          isDynamic: true,
        },
      ],
      fileModified: false,
    };

    const output = formatScanSummary(result);

    expect(output).toContain("Unsupported catch-all routes (1)");
    expect(output).toContain("/docs/[...slug]");
    expect(output).toContain("was not added");
  });
});
