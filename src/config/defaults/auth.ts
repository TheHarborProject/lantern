import type { AuthConfig } from "../../types/auth.js";

/**
 * Starter `auth` section written by `snaprun init` (RFC-013 §12). It documents
 * the full authentication structure (login route, selectors, both success
 * strategies, and a representative user) so users discover the available
 * options. Passwords use `${VARIABLE}` placeholders resolved from the
 * environment at login time (RFC-003), never stored in plain text.
 */
export const defaultAuthConfig: AuthConfig = {
  loginRoute: "/sign-in",
  selectors: {
    email: "input[name='email']",
    password: "input[name='password']",
    submit: "button[type='submit']",
  },
  successUrl: "**/dashboard",
  successSelector: "[data-testid='dashboard']",
  users: {
    example: {
      email: "user@example.com",
      password: "${EXAMPLE_PASSWORD}",
    },
  },
};
