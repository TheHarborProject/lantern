import type { Browser } from "playwright";
import { describe, expect, it, vi } from "vitest";
import { withBrowser } from "./with-browser.js";

describe("withBrowser", () => {
  it("returns the browser-backed result and closes the browser", async () => {
    const close = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const browser = { close } as unknown as Browser;

    await expect(
      withBrowser((receivedBrowser) => {
        expect(receivedBrowser).toBe(browser);
        return Promise.resolve("result");
      }, { launch: () => Promise.resolve(browser) }),
    ).resolves.toBe("result");
    expect(close).toHaveBeenCalledOnce();
  });

  it("closes the browser when browser-backed work fails", async () => {
    const close = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const browser = { close } as unknown as Browser;

    await expect(
      withBrowser(() => Promise.reject(new Error("audit failed")), {
        launch: () => Promise.resolve(browser),
      }),
    ).rejects.toThrow("audit failed");
    expect(close).toHaveBeenCalledOnce();
  });
});
