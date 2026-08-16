import { z } from "zod";

/**
 * Rule severities, mirroring ESLint (RFC-005).
 * `off` disables a rule; `warn` and `error` keep it active at different levels.
 */
export const severitySchema = z.enum(["off", "warn", "error"]);

/**
 * Namespaced Lantern rule identifier, e.g. `lantern/accessible-name`.
 *
 * Lantern-owned rule IDs are the stable public API. Rules are always namespaced
 * (`namespace/rule-name`) so they stay represented independently from
 * engine-native identifiers (such as `axe/button-name`), which are never the
 * user-facing configuration API. `lantern` is the namespace Lantern owns today.
 */
const RULE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*$/;

const ruleIdSchema = z
  .string()
  .regex(
    RULE_ID_PATTERN,
    'Rule id must be namespaced as "namespace/rule-name" (for example "lantern/accessible-name").',
  );

/**
 * Per-rule options bag. Kept as an open object here so that individual Lantern
 * rules can own and validate their own option schemas in a later RFC without a
 * central schema having to enumerate every rule's options. Options must be an
 * object — arrays and primitives are rejected.
 */
const ruleOptionsSchema = z.record(z.string(), z.unknown());

/**
 * ESLint-style rule configuration: either a bare severity, or a
 * `[severity, options]` tuple. The tuple form requires exactly two entries so
 * malformed shapes (missing options, extra entries) surface as errors.
 */
export const ruleConfigSchema = z.union([
  severitySchema,
  z.tuple([severitySchema, ruleOptionsSchema]),
]);

/** A map of namespaced rule id to its configuration. */
export const rulesSchema = z.record(ruleIdSchema, ruleConfigSchema);

/** Validated rule severity. */
export type Severity = z.infer<typeof severitySchema>;

/** Validated configuration for a single rule. */
export type RuleConfig = z.infer<typeof ruleConfigSchema>;

/** Validated `rules` map, inferred from {@link rulesSchema}. */
export type RulesConfig = z.infer<typeof rulesSchema>;
