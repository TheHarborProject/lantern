import { createHash } from "node:crypto";

/** Stable logical identity; the final segment leaves room for future per-rule instances. */
export function computeCheckId(
  componentId: string,
  stateId: string,
  ruleId: string,
  instance = "default",
): string {
  const digest = createHash("sha256")
    .update(JSON.stringify([componentId, stateId, ruleId, instance]))
    .digest("hex")
    .slice(0, 12);
  return `${stateId}#check-${digest}`;
}
