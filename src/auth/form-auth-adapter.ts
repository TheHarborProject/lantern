import type { BrowserContext, Page } from "playwright";
import { AuthenticationFailedError } from "../errors/authentication-failed-error.js";
import { UserNotFoundError } from "../errors/user-not-found-error.js";
import { resolveEnvValue } from "../env/resolve-env-value.js";
import type { AuthConfig } from "../types/auth.js";
import type { AuthAdapter } from "./auth-adapter.js";

const DEFAULT_TIMEOUT_MS = 10_000;

export interface FormAuthAdapterOptions {
  readonly auth: AuthConfig;
  readonly baseUrl: string;
  /** Directory used to resolve `${VARIABLE}` placeholders from `auth.users` (RFC-003). */
  readonly workingDirectory: string;
  /** Maximum time to wait for the success strategy. Default: 10 s. */
  readonly timeoutMs?: number;
}

/**
 * Generic HTML form authentication (RFC-007), independent from any provider
 * (Better Auth, NextAuth, and others). Fills `selectors.email` /
 * `selectors.password`, clicks `selectors.submit`, then waits for
 * `successUrl` and/or `successSelector` (success as soon as the first
 * configured criterion is met).
 */
export class FormAuthAdapter implements AuthAdapter {
  /**
   * Session state lives on the `BrowserContext` (its cookies), not on this
   * adapter instance: the "already authenticated" cache must therefore be
   * attached to each context rather than shared globally by the adapter
   * (review follow-up, RFC-007). `WeakMap` avoids strong references that
   * would keep a closed context alive.
   */
  private readonly authenticatedUserIdsByContext = new WeakMap<BrowserContext, Set<string>>();

  constructor(private readonly options: FormAuthAdapterOptions) {}

  async login(context: BrowserContext, userId: string): Promise<void> {
    if (this.authenticatedUserIdsByContext.get(context)?.has(userId) === true) {
      // Already authenticated in this context: session state is stored in its
      // cookies, so no new network action is required. Avoiding another form
      // submission is necessary, not just an optimization: an already
      // authenticated app usually redirects away from the login page, where
      // the form selectors no longer exist.
      return;
    }

    const credentials = this.options.auth.users[userId];
    if (credentials === undefined) {
      throw new UserNotFoundError(userId);
    }

    const email = resolveEnvValue(credentials.email, {
      workingDirectory: this.options.workingDirectory,
    });
    const password = resolveEnvValue(credentials.password, {
      workingDirectory: this.options.workingDirectory,
    });

    const page = await context.newPage();

    try {
      const { selectors, loginRoute } = this.options.auth;

      await page.goto(new URL(loginRoute, this.options.baseUrl).toString());
      await page.fill(selectors.email, email);
      await page.fill(selectors.password, password);
      await page.click(selectors.submit);

      const succeeded = await this.waitForSuccess(page);
      if (!succeeded) {
        // A failed login must never mark the context as authenticated: exit
        // before any write to authenticatedUserIdsByContext.
        throw new AuthenticationFailedError(userId);
      }

      const authenticatedUserIds = this.authenticatedUserIdsByContext.get(context) ?? new Set();
      authenticatedUserIds.add(userId);
      this.authenticatedUserIdsByContext.set(context, authenticatedUserIds);
    } finally {
      await page.close();
    }
  }

  /**
   * Race the configured criteria: resolve as soon as the first present
   * criterion succeeds, without waiting for the others to expire
   * (`Promise.any`, not `Promise.all`). Losing criteria are still consumed
   * cleanly by `Promise.any`, so no late rejected promise escapes this method.
   */
  private async waitForSuccess(page: Page): Promise<boolean> {
    const timeout = this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const { successUrl, successSelector } = this.options.auth;
    const checks: Promise<void>[] = [];

    if (successUrl !== undefined) {
      checks.push(page.waitForURL(successUrl, { timeout }));
    }

    if (successSelector !== undefined) {
      checks.push(page.waitForSelector(successSelector, { timeout }).then(() => undefined));
    }

    try {
      await Promise.any(checks);
      return true;
    } catch {
      return false;
    }
  }
}
