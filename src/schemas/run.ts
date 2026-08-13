import { z } from "zod";

/**
 * A run associates an ordered set of routes (referenced by `id`, RFC-004)
 * with an optional user. `order` defines the execution order between runs
 * (RFC-008), while the `routes` array order is the exact capture order
 * within the run.
 */
export const runSchema = z
  .object({
    runName: z.string(),
    user: z.string().optional(),
    order: z.number(),
    routes: z.array(z.string()),
  })
  .strict();

/**
 * Run list: each entry is validated by {@link runSchema}, and run names
 * (`runName`) must be unique across the list (RFC-008, consistent with route
 * id uniqueness in RFC-004).
 */
export const runsSchema = z.array(runSchema).superRefine((runs, ctx) => {
  const seenNames = new Set<string>();

  runs.forEach((run, index) => {
    if (seenNames.has(run.runName)) {
      ctx.addIssue({
        code: "custom",
        message: `Duplicate run name: ${run.runName}`,
        path: [index, "runName"],
      });
    }

    seenNames.add(run.runName);
  });
});
