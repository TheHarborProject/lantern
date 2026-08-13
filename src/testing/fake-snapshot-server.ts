import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

/**
 * Serveur HTTP minimal simulant une application à capturer, utilisé
 * uniquement par les tests de captures (RFC-009) — jamais exécuté hors des
 * tests. Sert quelques pages distinctes (statique, dynamique, page haute
 * pour `fullPage`) et trace, par requête, l'identifiant de session vu (pour
 * vérifier l'isolation des `BrowserContext` sans avoir à inspecter les PNG).
 *
 * Sert également un formulaire de connexion minimal (même origine que les
 * pages capturées, pour un partage de cookies réaliste), utilisé pour
 * vérifier empiriquement (compte de requêtes réseau) le nombre réel
 * d'authentifications déclenchées via `FormAuthAdapter` (RFC-007).
 */
export interface FakeSnapshotServer {
  readonly baseUrl: string;
  /** Identifiant de session (cookie `sid`) vu pour chaque requête GET, dans l'ordre. */
  sessionIdsSeen(): readonly string[];
  /** Nombre de requêtes POST /login reçues, quel qu'en soit le résultat. */
  loginAttemptCount(): number;
  close(): Promise<void>;
}

export const VALID_EMAIL = "member@example.com";
export const VALID_PASSWORD = "correct-secret";

const TALL_PAGE_HTML = `<!doctype html><html><body style="margin:0">
  <div data-testid="tall" style="height: 3000px; background: linear-gradient(red, blue);">tall</div>
</body></html>`;

const LOGIN_PAGE_HTML = `<!doctype html><html><body>
  <form method="POST" action="/login">
    <input name="email" type="email" />
    <input name="password" type="password" />
    <button type="submit">Login</button>
  </form>
</body></html>`;

export function startFakeSnapshotServer(): Promise<FakeSnapshotServer> {
  const sessionIdsSeen: string[] = [];
  let loginAttempts = 0;

  const server: Server = createServer((req, res) => {
    if (req.method === "POST" && req.url === "/login") {
      loginAttempts += 1;
      let body = "";
      req.on("data", (chunk: Buffer) => {
        body += chunk.toString();
      });
      req.on("end", () => {
        const params = new URLSearchParams(body);
        const isValid =
          params.get("email") === VALID_EMAIL && params.get("password") === VALID_PASSWORD;

        if (isValid) {
          res.writeHead(302, { Location: "/home", "Set-Cookie": "session=ok; Path=/" });
          res.end();
        } else {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(LOGIN_PAGE_HTML);
        }
      });
      return;
    }

    if (req.method !== "GET" || req.url === undefined) {
      res.writeHead(404);
      res.end();
      return;
    }

    if (req.url === "/login") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(LOGIN_PAGE_HTML);
      return;
    }

    const cookieHeader = req.headers.cookie ?? "";
    const existingSessionId = /sid=([^;]+)/.exec(cookieHeader)?.[1];
    const sessionId = existingSessionId ?? randomUUID();
    sessionIdsSeen.push(sessionId);

    const headers: Record<string, string> = { "Content-Type": "text/html" };
    if (existingSessionId === undefined) {
      headers["Set-Cookie"] = `sid=${sessionId}; Path=/`;
    }

    const url = new URL(req.url, "http://localhost");

    if (url.pathname === "/home") {
      res.writeHead(200, headers);
      res.end(`<!doctype html><html><body><div data-testid="home">Home</div></body></html>`);
      return;
    }

    if (url.pathname === "/calendar") {
      res.writeHead(200, headers);
      res.end(
        `<!doctype html><html><body><div data-testid="calendar">Calendar</div></body></html>`,
      );
      return;
    }

    if (url.pathname.startsWith("/stays/")) {
      const stayId = url.pathname.slice("/stays/".length);
      res.writeHead(200, headers);
      res.end(
        `<!doctype html><html><body><div data-testid="stay">Stay ${stayId}</div></body></html>`,
      );
      return;
    }

    if (url.pathname === "/tall") {
      res.writeHead(200, headers);
      res.end(TALL_PAGE_HTML);
      return;
    }

    res.writeHead(404, headers);
    res.end();
  });

  return new Promise((resolvePromise) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as AddressInfo;

      resolvePromise({
        baseUrl: `http://127.0.0.1:${address.port}`,
        sessionIdsSeen: () => sessionIdsSeen,
        loginAttemptCount: () => loginAttempts,
        close: () => new Promise((resolveClose) => server.close(() => resolveClose())),
      });
    });
  });
}
