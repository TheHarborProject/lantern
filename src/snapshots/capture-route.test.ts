import { existsSync, readFileSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser, type BrowserContext } from "playwright";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { RawDynamicRoute, RawStaticRoute } from "../types/route.js";
import { captureRoute } from "./capture-route.js";
import { startFakeSnapshotServer, type FakeSnapshotServer } from "../testing/fake-snapshot-server.js";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function readPngHeight(filePath: string): number {
  const buffer = readFileSync(filePath);
  expect(buffer.subarray(0, 8)).toEqual(PNG_SIGNATURE);
  return buffer.readUInt32BE(20);
}

function staticRoute(overrides: Partial<RawStaticRoute> = {}): RawStaticRoute {
  return { id: "home", path: "/home", enableSnapshot: true, ...overrides };
}

function dynamicStayRoute(stayId: string): RawDynamicRoute {
  return {
    id: "stay",
    path: "/stays/[stayId]",
    isDynamic: true,
    parameters: { stayId },
    enableSnapshot: true,
  };
}

describe("captureRoute", () => {
  let browser: Browser;
  let server: FakeSnapshotServer;
  let context: BrowserContext;
  let outputDir: string;

  beforeAll(async () => {
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    server = await startFakeSnapshotServer();
    context = await browser.newContext();
    outputDir = mkdtempSync(join(tmpdir(), "snaprun-capture-route-"));
  });

  afterEach(async () => {
    await context.close();
    await server.close();
    rmSync(outputDir, { recursive: true, force: true });
  });

  it("écrit un PNG réel pour une route statique, en créant les dossiers intermédiaires", async () => {
    const filePath = join(outputDir, "nested", "home.png");
    const page = await context.newPage();

    await captureRoute({
      page,
      baseUrl: server.baseUrl,
      route: staticRoute(),
      filePath,
      fullPage: true,
    });

    expect(existsSync(filePath)).toBe(true);
    expect(readFileSync(filePath).subarray(0, 8)).toEqual(PNG_SIGNATURE);
    await page.close();
  });

  it("résout et capture une route dynamique (substitution de paramètre)", async () => {
    const filePath = join(outputDir, "stay.png");
    const page = await context.newPage();

    await captureRoute({
      page,
      baseUrl: server.baseUrl,
      route: dynamicStayRoute("seed-stay-123"),
      filePath,
      fullPage: true,
    });

    expect(existsSync(filePath)).toBe(true);
    expect(readFileSync(filePath).subarray(0, 8)).toEqual(PNG_SIGNATURE);
    await page.close();
  });

  it("respecte l'option fullPage : capture pleine page plus haute que la fenêtre visible", async () => {
    const viewportOnlyPath = join(outputDir, "tall-viewport.png");
    const fullPagePath = join(outputDir, "tall-full.png");

    const viewportPage = await context.newPage();
    await captureRoute({
      page: viewportPage,
      baseUrl: server.baseUrl,
      route: staticRoute({ id: "tall", path: "/tall" }),
      filePath: viewportOnlyPath,
      fullPage: false,
    });
    await viewportPage.close();

    const fullPage = await context.newPage();
    await captureRoute({
      page: fullPage,
      baseUrl: server.baseUrl,
      route: staticRoute({ id: "tall", path: "/tall" }),
      filePath: fullPagePath,
      fullPage: true,
    });
    await fullPage.close();

    expect(readPngHeight(fullPagePath)).toBeGreaterThan(readPngHeight(viewportOnlyPath));
  });
});
