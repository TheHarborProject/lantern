import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Page } from "playwright";
import { resolveRoutePath } from "../routes/resolve-route-path.js";
import type { RawRoute } from "../types/route.js";

const DEFAULT_TIMEOUT_MS = 15_000;

export interface CaptureRouteOptions {
  readonly page: Page;
  readonly baseUrl: string;
  readonly route: RawRoute;
  /** Target PNG file path, already computed (RFC-009). */
  readonly filePath: string;
  readonly fullPage: boolean;
  readonly timeoutMs?: number;
}

/**
 * Capture a single route (RFC-009): resolve its URL (static, dynamic, or
 * `snapshotPath`, RFC-004), navigate to it, wait for network stability
 * (`networkidle`), then write a PNG to the target path. Create parent
 * directories when needed.
 */
export async function captureRoute(options: CaptureRouteOptions): Promise<void> {
  const { page, baseUrl, route, filePath, fullPage } = options;
  const timeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const path = resolveRoutePath(route);
  const url = new URL(path, baseUrl).toString();

  mkdirSync(dirname(filePath), { recursive: true });

  await page.goto(url, { waitUntil: "networkidle", timeout });
  await page.screenshot({ path: filePath, fullPage });
}
