import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

/**
 * Serveur HTTP minimal simulant un formulaire de connexion classique
 * (POST + redirection + cookie de session), utilisé uniquement par les
 * tests de `FormAuthAdapter` (RFC-007) — jamais exécuté hors des tests.
 */
export const VALID_EMAIL = "member@example.com";
export const VALID_PASSWORD = "correct-secret";
export const VALID_EMAIL_2 = "admin@example.com";
export const VALID_PASSWORD_2 = "other-correct-secret";

const LOGIN_FORM = `
  <form method="POST" action="/login">
    <input name="email" type="email" />
    <input name="password" type="password" />
    <button type="submit">Login</button>
  </form>
`;

const LOGIN_PAGE_HTML = `<!doctype html><html><body>${LOGIN_FORM}</body></html>`;
const LOGIN_PAGE_WITH_ERROR_HTML = `<!doctype html><html><body>
  <div data-testid="login-error">Invalid credentials</div>
  ${LOGIN_FORM}
</body></html>`;
const DASHBOARD_HTML = `<!doctype html><html><body>
  <div data-testid="dashboard">Welcome</div>
</body></html>`;

export interface FakeAuthServer {
  readonly baseUrl: string;
  loginAttemptCount(): number;
  close(): Promise<void>;
}

/** Démarre le serveur sur un port libre et attend qu'il soit prêt. */
export function startFakeAuthServer(): Promise<FakeAuthServer> {
  let loginAttempts = 0;

  const server: Server = createServer((req, res) => {
    if (req.method === "GET" && req.url === "/login") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(LOGIN_PAGE_HTML);
      return;
    }

    if (req.method === "POST" && req.url === "/login") {
      loginAttempts += 1;
      let body = "";
      req.on("data", (chunk: Buffer) => {
        body += chunk.toString();
      });
      req.on("end", () => {
        const params = new URLSearchParams(body);
        const email = params.get("email");
        const password = params.get("password");
        const isValid =
          (email === VALID_EMAIL && password === VALID_PASSWORD) ||
          (email === VALID_EMAIL_2 && password === VALID_PASSWORD_2);

        if (isValid) {
          res.writeHead(302, { Location: "/dashboard", "Set-Cookie": "session=ok; Path=/" });
          res.end();
        } else {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(LOGIN_PAGE_WITH_ERROR_HTML);
        }
      });
      return;
    }

    if (req.method === "GET" && req.url === "/dashboard") {
      const cookie = req.headers.cookie ?? "";
      if (!cookie.includes("session=ok")) {
        res.writeHead(302, { Location: "/login" });
        res.end();
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(DASHBOARD_HTML);
      return;
    }

    res.writeHead(404);
    res.end();
  });

  return new Promise((resolvePromise) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as AddressInfo;

      resolvePromise({
        baseUrl: `http://127.0.0.1:${address.port}`,
        loginAttemptCount: () => loginAttempts,
        close: () => new Promise((resolveClose) => server.close(() => resolveClose())),
      });
    });
  });
}
