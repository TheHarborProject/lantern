import { z } from "zod";

export const surveyConfigSchema = z
  .object({
    scan: z
      .object({
        nonInteractive: z.enum(["refresh", "current", "error"]).default("refresh"),
      })
      .strict()
      .default({ nonInteractive: "refresh" }),
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
    scan: { nonInteractive: "refresh" },
    persistence: { local: true, ci: false },
    git: { capture: true },
    history: { path: ".lantern/surveys", listMax: 20 },
  });

export type SurveyConfig = z.infer<typeof surveyConfigSchema>;
export type SurveyScanPolicy = SurveyConfig["scan"]["nonInteractive"];
