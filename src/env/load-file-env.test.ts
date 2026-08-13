import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadFileEnv } from "./load-file-env.js";

describe("loadFileEnv", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "snaprun-load-file-env-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("retourne un objet vide si aucun fichier n'existe", () => {
    expect(loadFileEnv(dir)).toEqual({});
  });

  it("lit .env seul", () => {
    writeFileSync(join(dir, ".env"), "FOO=bar");

    expect(loadFileEnv(dir)).toEqual({ FOO: "bar" });
  });

  it("fait primer .env.local sur .env pour une clé commune", () => {
    writeFileSync(join(dir, ".env"), "FOO=from-env\nSHARED=env-value");
    writeFileSync(join(dir, ".env.local"), "FOO=from-env-local");

    expect(loadFileEnv(dir)).toEqual({ FOO: "from-env-local", SHARED: "env-value" });
  });

  it("préserve un '=' dans la valeur (délégué à dotenv.parse)", () => {
    writeFileSync(join(dir, ".env"), "CONNECTION_STRING=key=value;other=thing");

    expect(loadFileEnv(dir)).toEqual({ CONNECTION_STRING: "key=value;other=thing" });
  });

  it("retire les guillemets entourant une valeur (délégué à dotenv.parse)", () => {
    writeFileSync(join(dir, ".env"), "FOO=\"bar baz\"\nQUX='quux'");

    expect(loadFileEnv(dir)).toEqual({ FOO: "bar baz", QUX: "quux" });
  });

  it("ignore les lignes de commentaire (délégué à dotenv.parse)", () => {
    writeFileSync(join(dir, ".env"), "# ceci est un commentaire\nFOO=bar");

    expect(loadFileEnv(dir)).toEqual({ FOO: "bar" });
  });

  it("accepte le préfixe 'export' (délégué à dotenv.parse)", () => {
    writeFileSync(join(dir, ".env"), "export FOO=bar");

    expect(loadFileEnv(dir)).toEqual({ FOO: "bar" });
  });
});
