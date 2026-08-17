import { z } from "zod";

export const outputModeSchema = z.enum(["minimal", "compact", "verbose"]);
export type OutputMode = z.infer<typeof outputModeSchema>;

export const outputSchema = z.object({ mode: outputModeSchema }).strict();
export type OutputConfig = z.infer<typeof outputSchema>;
