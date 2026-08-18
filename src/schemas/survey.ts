import { z } from "zod";

export const surveyConfigSchema = z
  .object({
    scan: z
      .object({
        nonInteractive: z.enum(["refresh", "current", "error"]).default("refresh"),
        interactive: z.object({
          missing: z.enum(["scan", "error"]).default("scan"),
          stale: z.enum(["refresh", "current", "prompt", "error"]).default("prompt"),
        }).strict().default({ missing: "scan", stale: "prompt" }),
      })
      .strict()
      .default({ nonInteractive: "refresh", interactive: { missing: "scan", stale: "prompt" } }),
    interactive: z.object({
      defaultSelection: z.enum(["all", "changed", "previous"]).default("all"),
      confirm: z.boolean().default(true),
    }).strict().default({ defaultSelection: "all", confirm: true }),
    persistence: z
      .object({
        local: z.boolean().default(true),
        ci: z.boolean().default(false),
      })
      .strict()
      .default({ local: true, ci: false }),
    git: z
      .object({
        capture: z.boolean().default(true),
      })
      .strict()
      .default({ capture: true }),
    history: z
      .object({
        path: z.string().trim().min(1).default(".lantern/surveys"),
        maxRuns: z.number().int().positive().optional(),
        maxAge: z.string().regex(/^[1-9]\d*(?:m|h|d|w)$/, "Expected a positive duration such as 30d.").optional(),
        listMax: z.number().int().positive().default(20),
      })
      .strict()
      .default({ path: ".lantern/surveys", listMax: 20 }),
  })
  .strict()
  .default({
    scan: { nonInteractive: "refresh", interactive: { missing: "scan", stale: "prompt" } },
    interactive: { defaultSelection: "all", confirm: true },
    persistence: { local: true, ci: false },
    git: { capture: true },
    history: { path: ".lantern/surveys", listMax: 20 },
  });

export type SurveyConfig = z.infer<typeof surveyConfigSchema>;
export type SurveyScanPolicy = SurveyConfig["scan"]["nonInteractive"];
export type InteractiveMissingScanPolicy = SurveyConfig["scan"]["interactive"]["missing"];
export type InteractiveStaleScanPolicy = SurveyConfig["scan"]["interactive"]["stale"];
export type InteractiveDefaultSelection = SurveyConfig["interactive"]["defaultSelection"];
