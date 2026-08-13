import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isBaseUrlReachable } from "./is-base-url-reachable.js";

describe("isBaseUrlReachable", () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    server = createServer((_req, res) => {
      res.writeHead(200);
      res.end("ok");
    });

    await new Promise<void>((resolvePromise) => {
      server.listen(0, "127.0.0.1", () => resolvePromise());
    });

    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolvePromise) => server.close(() => resolvePromise()));
  });

  it("renvoie true quand le serveur répond", async () => {
    await expect(isBaseUrlReachable(baseUrl)).resolves.toBe(true);
  });

  it("renvoie true même si le serveur répond avec une erreur (4xx/5xx toujours joignable)", async () => {
    server.close();
    const errorServer = createServer((_req, res) => {
      res.writeHead(500);
      res.end();
    });
    await new Promise<void>((resolvePromise) => {
      errorServer.listen(0, "127.0.0.1", () => resolvePromise());
    });
    const address = errorServer.address() as AddressInfo;

    await expect(isBaseUrlReachable(`http://127.0.0.1:${address.port}`)).resolves.toBe(true);

    await new Promise<void>((resolvePromise) => errorServer.close(() => resolvePromise()));
  });

  it("renvoie false quand rien n'écoute sur ce port", async () => {
    await expect(isBaseUrlReachable("http://127.0.0.1:1", 500)).resolves.toBe(false);
  });

  it("renvoie false au-delà du délai imparti", async () => {
    server.close();
    const hangingServer = createServer(() => {
      // Ne répond jamais.
    });
    await new Promise<void>((resolvePromise) => {
      hangingServer.listen(0, "127.0.0.1", () => resolvePromise());
    });
    const address = hangingServer.address() as AddressInfo;

    await expect(isBaseUrlReachable(`http://127.0.0.1:${address.port}`, 200)).resolves.toBe(false);

    await new Promise<void>((resolvePromise) => hangingServer.close(() => resolvePromise()));
  });
});
