import { z } from "zod";

const authSelectorsSchema = z.object({
  email: z.string(),
  password: z.string(),
  submit: z.string(),
});

/**
 * `email` and `password` may contain literal values or `${VARIABLE}`
 * placeholders resolved by `resolveEnvValue` (RFC-003) at login time, never
 * while loading the configuration, so validation never logs a secret by
 * accident.
 */
const userCredentialsSchema = z.object({
  email: z.string(),
  password: z.string(),
});

/**
 * Optional configuration section (RFC-002: configuration without
 * authentication is valid). When present, its full structure is required.
 * The login success strategy (`successUrl` and/or `successSelector`) must
 * define at least one success criterion (RFC-007): at least one of them must
 * allow SnapRun to determine that login succeeded.
 */
export const authSchema = z
  .object({
    loginRoute: z.string(),
    selectors: authSelectorsSchema,
    successUrl: z.string().optional(),
    successSelector: z.string().optional(),
    users: z.record(z.string(), userCredentialsSchema),
  })
  .superRefine((auth, ctx) => {
    if (auth.successUrl === undefined && auth.successSelector === undefined) {
      ctx.addIssue({
        code: "custom",
        message:
          "auth.successUrl or auth.successSelector must be defined so SnapRun can detect a successful login.",
        path: ["successUrl"],
      });
    }
  });
