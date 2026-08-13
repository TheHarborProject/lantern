import { z } from "zod";

/**
 * Project-level component isolation runtime (RFC-003).
 *
 * Everything here is genuinely global and configured once for the project, so
 * individual components never need to redeclare it:
 * - `globalCss` lists stylesheets injected into every isolation page;
 * - `wrapper` points at a module exporting a shared provider/wrapper component
 *   (compose ThemeProvider, i18n, context providers there) applied around the
 *   mounted component;
 * - `wrapperExport` selects which export of that module is the wrapper.
 *
 * Paths are relative to `project.root` and resolved when the runtime mounts a
 * component.
 */
export const isolationSchema = z
  .object({
    globalCss: z.array(z.string()).default([]),
    wrapper: z.string().optional(),
    wrapperExport: z.string().default("default"),
  })
  .strict();

/** Validated `isolation` section, inferred from {@link isolationSchema}. */
export type IsolationConfig = z.infer<typeof isolationSchema>;
