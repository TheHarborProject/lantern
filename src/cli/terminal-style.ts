export interface TerminalStyle {
  readonly success: (text: string) => string;
  readonly failure: (text: string) => string;
  readonly review: (text: string) => string;
  readonly skipped: (text: string) => string;
  readonly error: (text: string) => string;
  readonly accent: (text: string) => string;
  readonly muted: (text: string) => string;
  readonly strong: (text: string) => string;
}

export function shouldUseColor(isTTY: boolean, environment: NodeJS.ProcessEnv = process.env): boolean {
  return isTTY && !("NO_COLOR" in environment);
}

export function createTerminalStyle(enabled: boolean): TerminalStyle {
  const wrap = (code: number, text: string): string => enabled ? `\u001b[${code}m${text}\u001b[0m` : text;
  return {
    success: (text) => wrap(32, text),
    failure: (text) => wrap(31, text),
    review: (text) => wrap(33, text),
    skipped: (text) => wrap(2, text),
    error: (text) => wrap(31, text),
    accent: (text) => wrap(36, text),
    muted: (text) => wrap(2, text),
    strong: (text) => wrap(1, text),
  };
}
