import type { z } from "zod";
import type { runSchema } from "../schemas/run.js";

export type RawRun = z.infer<typeof runSchema>;
