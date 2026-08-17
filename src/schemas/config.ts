import { z } from "zod";
import { authSchema } from "./auth.js";
import { componentsSchema } from "./components.js";
import { enginesSchema } from "./engines.js";
import { extendsSchema } from "./extends.js";
import { fixturesSchema } from "./fixtures.js";
import { ignorePatternsSchema } from "./ignore-patterns.js";
import { isolationSchema } from "./isolation.js";
import { overridesSchema } from "./overrides.js";
import { outputSchema } from "./output.js";
import { projectSchema } from "./project.js";
import { rulesSchema } from "./rules.js";
import { settingsSchema } from "./settings.js";
import { standardsSchema } from "./standards.js";

/**
 * Durable user-owned Lantern configuration (`lantern.config.json`).
 *
 * `project` is the only required section (inherited from earlier RFCs);
 * `auth` and `isolation` remain the compatible runtime sections from RFC-002/003.
 *
 * RFC-005 adds the ESLint-style accessibility configuration surface. Each new
 * section is optional at the raw layer: defaults, preset (`extends`) resolution
 * and override merging happen in the dedicated resolution layer, so raw
 * configuration is never conflated with resolved configuration. Parsing stays
 * strict — unknown top-level keys are rejected.
 */
export const configSchema = z
  .object({
    project: projectSchema,
    auth: authSchema.optional(),
    isolation: isolationSchema.optional(),
    standards: standardsSchema.optional(),
    extends: extendsSchema.optional(),
    engines: enginesSchema.optional(),
    settings: settingsSchema.optional(),
    rules: rulesSchema.optional(),
    components: componentsSchema.optional(),
    overrides: overridesSchema.optional(),
    ignorePatterns: ignorePatternsSchema.optional(),
    fixtures: fixturesSchema.optional(),
    output: outputSchema.optional(),
  })
  .strict();

/** Validated Lantern configuration, inferred directly from {@link configSchema}. */
export type LanternConfig = z.infer<typeof configSchema>;
