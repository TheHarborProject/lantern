/**
 * Common base class for SnapRun application errors.
 *
 * The message intentionally stays readable without raw technical details.
 * The original cause (parse errors, Zod errors, and so on) is stored in the
 * standard `cause` property and is meant to be displayed only in `--debug`
 * mode.
 */
export abstract class SnapRunError extends Error {
  abstract readonly code: string;

  constructor(message: string, options?: { readonly cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}
