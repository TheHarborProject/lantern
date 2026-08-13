import type { BrowserContext } from "playwright";

/**
 * Lightweight authentication abstraction (RFC-007), intentionally minimal:
 * one method only, independent from any provider (Better Auth, NextAuth,
 * custom forms, and so on).
 *
 * `context` is provided by the caller (a run, RFC-008): this adapter neither
 * creates nor manages browser contexts on its own.
 */
export interface AuthAdapter {
  /**
   * Authenticate `userId` on `context`. If `context` already carries a valid
   * session for that user (already logged in during this run), perform no
   * additional network action.
   *
   * @throws {UserNotFoundError} `userId` is not present in the configuration.
   * @throws {AuthenticationFailedError} The configured success strategy is never reached.
   */
  login(context: BrowserContext, userId: string): Promise<void>;
}
