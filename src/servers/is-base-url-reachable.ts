const DEFAULT_CHECK_TIMEOUT_MS = 2_000;

/**
 * Check whether `baseUrl` responds (RFC-011): any HTTP response, regardless
 * of status code, means a server is already there and should be reused as-is.
 * Only lack of response (connection refused, unreachable host, timeout) is
 * treated as unreachable.
 */
export async function isBaseUrlReachable(
  baseUrl: string,
  timeoutMs: number = DEFAULT_CHECK_TIMEOUT_MS,
): Promise<boolean> {
  try {
    await fetch(baseUrl, { method: "GET", signal: AbortSignal.timeout(timeoutMs) });
    return true;
  } catch {
    return false;
  }
}
