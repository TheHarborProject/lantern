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
  })
  .strict()
  .default({
    scan: { nonInteractive: "refresh" },
    persistence: { local: true, ci: false },
    git: { capture: true },
  });

export type SurveyConfig = z.infer<typeof surveyConfigSchema>;
export type SurveyScanPolicy = SurveyConfig["scan"]["nonInteractive"];
