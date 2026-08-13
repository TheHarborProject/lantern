import { chromium, type Browser } from "playwright";

export interface WithBrowserOptions {
  readonly launch?: (() => Promise<Browser>) | undefined;
}

/** Run browser-backed work while keeping browser ownership in one place. */
export async function withBrowser<T>(
  work: (browser: Browser) => Promise<T>,
  options: WithBrowserOptions = {},
): Promise<T> {
  const launch = options.launch ?? ((): Promise<Browser> => chromium.launch());
  const browser = await launch();

  try {
    return await work(browser);
  } finally {
    await browser.close();
  }
}
