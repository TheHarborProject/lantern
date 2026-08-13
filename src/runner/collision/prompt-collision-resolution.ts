import { createInterface } from "node:readline/promises";
import { formatCollisions } from "./format-collisions.js";
import type { CollisionGroup, CollisionResolution } from "./types.js";

interface PromptChoice {
  readonly key: string;
  readonly label: string;
  readonly resolution: CollisionResolution;
}

/** Deterministic default when input is empty or unrecognized (RFC-014.5 §7 first entry). */
const DEFAULT_RESOLUTION: CollisionResolution = "rerun-sequentially";

/** Menu order follows RFC-014.5 §7; the first entry is the default on empty input. */
const CHOICES: readonly PromptChoice[] = [
  { key: "1", label: "Re-run sequentially", resolution: "rerun-sequentially" },
  { key: "2", label: "Overwrite sequentially", resolution: "overwrite-sequentially" },
  { key: "3", label: "Create subfolders", resolution: "create-subfolders" },
  { key: "4", label: "Skip", resolution: "skip" },
];

/**
 * Default interactive collision prompt (RFC-014.5 §7). Prints the deterministic
 * collision queue and the available actions, then reads the user's choice from
 * stdin. Only used in interactive sessions — non-interactive environments fall
 * back to `error` before this is ever called (RFC-014.5 §10). Injectable, so
 * tests never touch stdin.
 */
export async function promptCollisionResolution(
  groups: readonly CollisionGroup[],
): Promise<CollisionResolution> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    process.stdout.write(`${formatCollisions(groups)}\n\nChoose a strategy\n`);
    for (const choice of CHOICES) {
      process.stdout.write(`  ${choice.key}) ${choice.label}\n`);
    }

    const answer = (await rl.question("> ")).trim();
    const selected = CHOICES.find(
      (choice) =>
        choice.key === answer || choice.label.toLowerCase() === answer.toLowerCase(),
    );

    // Empty or unrecognized input keeps the deterministic default (first entry).
    return selected?.resolution ?? DEFAULT_RESOLUTION;
  } finally {
    rl.close();
  }
}
