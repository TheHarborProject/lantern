import { chromium, type Browser, type BrowserContext } from "playwright";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AuthenticationFailedError } from "../errors/authentication-failed-error.js";
import { EnvVariableMissingError } from "../errors/env-variable-missing-error.js";
import { UserNotFoundError } from "../errors/user-not-found-error.js";
import type { AuthConfig } from "../types/auth.js";
import {
  startFakeAuthServer,
  VALID_EMAIL,
  VALID_EMAIL_2,
  VALID_PASSWORD,
  VALID_PASSWORD_2,
  type FakeAuthServer,
} from "../testing/fake-auth-server.js";
import { FormAuthAdapter } from "./form-auth-adapter.js";

const SELECTORS = {
  email: 'input[name="email"]',
  password: 'input[name="password"]',
  submit: 'button[type="submit"]',
};

function authConfig(overrides: Partial<AuthConfig> = {}): AuthConfig {
  return {
    loginRoute: "/login",
    selectors: SELECTORS,
    successUrl: "**/dashboard",
    users: { member: { email: VALID_EMAIL, password: VALID_PASSWORD } },
    ...overrides,
  };
}

describe("FormAuthAdapter", () => {
  let browser: Browser;
  let server: FakeAuthServer;
  let context: BrowserContext;

  beforeAll(async () => {
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    server = await startFakeAuthServer();
    context = await browser.newContext();
  });

  afterEach(async () => {
    await context.close();
    await server.close();
  });

  it("réussit via la stratégie de succès par URL", async () => {
    const adapter = new FormAuthAdapter({
      auth: authConfig({ successUrl: "**/dashboard", successSelector: undefined }),
      baseUrl: server.baseUrl,
      workingDirectory: process.cwd(),
      timeoutMs: 5000,
    });

    await expect(adapter.login(context, "member")).resolves.toBeUndefined();
  });

  it("réussit via la stratégie de succès par sélecteur", async () => {
    const adapter = new FormAuthAdapter({
      auth: authConfig({ successUrl: undefined, successSelector: "[data-testid='dashboard']" }),
      baseUrl: server.baseUrl,
      workingDirectory: process.cwd(),
      timeoutMs: 5000,
    });

    await expect(adapter.login(context, "member")).resolves.toBeUndefined();
  });

  it("lève AUTHENTICATION_FAILED sur des identifiants incorrects", async () => {
    const adapter = new FormAuthAdapter({
      auth: authConfig({
        users: { member: { email: VALID_EMAIL, password: "wrong-password" } },
      }),
      baseUrl: server.baseUrl,
      workingDirectory: process.cwd(),
      timeoutMs: 1000,
    });

    try {
      await adapter.login(context, "member");
      expect.fail("login aurait dû lever une erreur");
    } catch (error) {
      expect(error).toBeInstanceOf(AuthenticationFailedError);
      expect((error as AuthenticationFailedError).code).toBe("AUTHENTICATION_FAILED");
      expect((error as AuthenticationFailedError).userId).toBe("member");
    }

    expect(server.loginAttemptCount()).toBe(1);
  });

  it("lève USER_NOT_FOUND si l'utilisateur n'existe pas dans la configuration", async () => {
    const adapter = new FormAuthAdapter({
      auth: authConfig(),
      baseUrl: server.baseUrl,
      workingDirectory: process.cwd(),
    });

    try {
      await adapter.login(context, "absent");
      expect.fail("login aurait dû lever une erreur");
    } catch (error) {
      expect(error).toBeInstanceOf(UserNotFoundError);
      expect((error as UserNotFoundError).code).toBe("USER_NOT_FOUND");
      expect((error as UserNotFoundError).userId).toBe("absent");
    }

    expect(server.loginAttemptCount()).toBe(0);
  });

  it("lève ENV_VARIABLE_MISSING si le mot de passe référence une variable absente (secret absent)", async () => {
    const adapter = new FormAuthAdapter({
      auth: authConfig({
        users: { member: { email: VALID_EMAIL, password: "${SNAPRUN_TEST_MISSING_SECRET}" } },
      }),
      baseUrl: server.baseUrl,
      workingDirectory: process.cwd(),
    });

    await expect(adapter.login(context, "member")).rejects.toBeInstanceOf(EnvVariableMissingError);
    expect(server.loginAttemptCount()).toBe(0);
  });

  it("ne journalise jamais le mot de passe résolu dans le message d'une erreur d'échec", async () => {
    const adapter = new FormAuthAdapter({
      auth: authConfig({ users: { member: { email: VALID_EMAIL, password: "wrong-password" } } }),
      baseUrl: server.baseUrl,
      workingDirectory: process.cwd(),
      timeoutMs: 1000,
    });

    try {
      await adapter.login(context, "member");
    } catch (error) {
      expect((error as AuthenticationFailedError).message).not.toContain("wrong-password");
      expect((error as AuthenticationFailedError).message).not.toContain(VALID_PASSWORD);
    }
  });

  it("réutilise la session dans le run : un deuxième login() pour le même utilisateur ne refait aucune requête", async () => {
    const adapter = new FormAuthAdapter({
      auth: authConfig(),
      baseUrl: server.baseUrl,
      workingDirectory: process.cwd(),
      timeoutMs: 5000,
    });

    await adapter.login(context, "member");
    expect(server.loginAttemptCount()).toBe(1);

    await adapter.login(context, "member");
    expect(server.loginAttemptCount()).toBe(1);

    // La session est bien portée par le contexte : navigation directe vers
    // une page protégée sans repasser par le formulaire de connexion.
    const page = await context.newPage();
    await page.goto(`${server.baseUrl}/dashboard`);
    expect(page.url()).toBe(`${server.baseUrl}/dashboard`);
    await page.close();
  });

  it("le même utilisateur dans un autre contexte doit se réauthentifier (cache lié au contexte)", async () => {
    const adapter = new FormAuthAdapter({
      auth: authConfig(),
      baseUrl: server.baseUrl,
      workingDirectory: process.cwd(),
      timeoutMs: 5000,
    });

    await adapter.login(context, "member");
    expect(server.loginAttemptCount()).toBe(1);

    const otherContext = await browser.newContext();
    try {
      // Ce contexte ne possède aucun cookie de session : le login ne doit
      // jamais être sauté, même pour un utilisateur déjà authentifié
      // ailleurs sur la même instance de FormAuthAdapter.
      await adapter.login(otherContext, "member");
      expect(server.loginAttemptCount()).toBe(2);
    } finally {
      await otherContext.close();
    }
  });

  it("un échec initial ne marque pas le contexte comme authentifié : une nouvelle tentative n'est pas ignorée", async () => {
    const adapter = new FormAuthAdapter({
      auth: authConfig(),
      baseUrl: server.baseUrl,
      workingDirectory: process.cwd(),
      timeoutMs: 1000,
    });

    // Première tentative : identifiants incorrects, échec attendu.
    const failingAdapter = new FormAuthAdapter({
      auth: authConfig({ users: { member: { email: VALID_EMAIL, password: "wrong-password" } } }),
      baseUrl: server.baseUrl,
      workingDirectory: process.cwd(),
      timeoutMs: 1000,
    });

    await expect(failingAdapter.login(context, "member")).rejects.toBeInstanceOf(
      AuthenticationFailedError,
    );
    expect(server.loginAttemptCount()).toBe(1);

    // Nouvelle tentative sur le même contexte, avec les bons identifiants
    // cette fois : ne doit pas être ignorée, doit refaire une vraie requête.
    await adapter.login(context, "member");
    expect(server.loginAttemptCount()).toBe(2);
  });

  it("deux utilisateurs différents dans le même contexte restent suivis séparément", async () => {
    const adapter = new FormAuthAdapter({
      auth: authConfig({
        users: {
          member: { email: VALID_EMAIL, password: VALID_PASSWORD },
          admin: { email: VALID_EMAIL_2, password: VALID_PASSWORD_2 },
        },
      }),
      baseUrl: server.baseUrl,
      workingDirectory: process.cwd(),
      timeoutMs: 5000,
    });

    await adapter.login(context, "member");
    expect(server.loginAttemptCount()).toBe(1);

    await adapter.login(context, "admin");
    expect(server.loginAttemptCount()).toBe(2);

    // Chacun reste mémorisé indépendamment : aucune nouvelle requête.
    await adapter.login(context, "member");
    await adapter.login(context, "admin");
    expect(server.loginAttemptCount()).toBe(2);
  });
});
