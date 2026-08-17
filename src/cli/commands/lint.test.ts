import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createProgram } from "../program.js";
import { resolveOutputMode } from "./lint.js";

describe("lantern lint", () => {
  let root: string;
  const originalCwd = process.cwd();

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "lantern-lint-"));
    process.chdir(root);
    writeFileSync(join(root, "lantern.config.json"), JSON.stringify({ project: {} }));
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(root, { recursive: true, force: true });
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  it("resolves output modes with CLI flags overriding config and compact as the default", () => {
    expect(resolveOutputMode({})).toBe("compact");
    expect(resolveOutputMode({}, "minimal")).toBe("minimal");
    expect(resolveOutputMode({ verbose: true }, "minimal")).toBe("verbose");
    expect(() => resolveOutputMode({ minimal: true, compact: true })).toThrow(/mutually exclusive/);
  });

  it("renders a ready component truthfully, with exit code 0", async () => {
    writeFileSync(
      join(root, "Button.tsx"),
      `
        type ButtonProps = { disabled?: boolean };
        export const Button = ({ disabled }: ButtonProps) => <button disabled={disabled} />;
      `,
    );
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const program = createProgram();
    program.exitOverride();

    await program.parseAsync(["lint"], { from: "user" });

    const output = log.mock.calls.map((call) => String(call[0])).join("\n");
    expect(output).toContain("Button");
    // Both Lantern-owned engines are enabled by default (RFC-008), but no
    // rule is configured (no `extends`/`rules` in this fixture), so nothing
    // is actually evaluated — "available" must not be read as "covered".
    expect(output).toContain("RUN  WCAG 2.2 AA");
    expect(output).toContain("Button.tsx#Button");
    expect(output).toContain("Components");
    expect(process.exitCode).toBe(0);
  });

  it("evaluates a genuine static check end-to-end and blocks on error severity", async () => {
    writeFileSync(
      join(root, "lantern.config.json"),
      JSON.stringify({ project: {}, rules: { "lantern/accessible-name": "error" } }),
    );
    writeFileSync(
      join(root, "Button.tsx"),
      `
        type ButtonProps = { disabled?: boolean };
        export const Button = ({ disabled }: ButtonProps) => <button disabled={disabled} />;
      `,
    );
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const program = createProgram();
    program.exitOverride();

    await program.parseAsync(["lint", "--verbose"], { from: "user" });

    const output = log.mock.calls.map((call) => String(call[0])).join("\n");
    expect(output).toContain("lantern/accessible-name");
    expect(output).toContain("lantern-static@1.0.0");
    expect(output).toContain("exposes no prop capable of providing an accessible name");
    expect(process.exitCode).toBe(1);
  });

  it("exits 0 by default for an unresolved component", async () => {
    writeFileSync(
      join(root, "Avatar.tsx"),
      `
        type AvatarProps = { user: { name: string } };
        export const Avatar = ({ user }: AvatarProps) => <img alt={user.name} />;
      `,
    );
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const program = createProgram();
    program.exitOverride();

    await program.parseAsync(["lint"], { from: "user" });

    expect(process.exitCode).toBe(0);
  });

  it("exits 1 for an unresolved component with --fail-on-skipped", async () => {
    writeFileSync(
      join(root, "Avatar.tsx"),
      `
        type AvatarProps = { user: { name: string } };
        export const Avatar = ({ user }: AvatarProps) => <img alt={user.name} />;
      `,
    );
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const program = createProgram();
    program.exitOverride();

    await program.parseAsync(["lint", "--fail-on-skipped"], { from: "user" });

    expect(process.exitCode).toBe(1);
  });

  it("exits 2 with an actionable error when --all and --since are combined", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const program = createProgram();
    program.exitOverride();

    await program.parseAsync(["lint", "--all", "--since", "main"], { from: "user" });

    expect(process.exitCode).toBe(2);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('"--all" and "--since"'));
  });

  it("targets a positional path and renders the target selection", async () => {
    writeFileSync(join(root, "Button.tsx"), "export const Button = () => <button />;");
    writeFileSync(join(root, "Card.tsx"), "export const Card = () => <article />;");
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const program = createProgram();
    program.exitOverride();

    await program.parseAsync(["lint", "Button.tsx"], { from: "user" });

    const output = log.mock.calls.map((call) => String(call[0])).join("\n");
    expect(output).toContain("Target     Button.tsx");
    expect(output).toContain("Selection  1 component");
    expect(output).toContain("Button");
    expect(output).not.toContain("Card");
  });

  it("renders a zero-component selection for an explicit non-component path", async () => {
    writeFileSync(join(root, "README.md"), "# docs");
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const program = createProgram();
    program.exitOverride();

    await program.parseAsync(["lint", "README.md"], { from: "user" });

    const output = log.mock.calls.map((call) => String(call[0])).join("\n");
    expect(output).toContain("Target     README.md");
    expect(output).toContain("Selection  no components");
    expect(process.exitCode).toBe(0);
  });

  it("rejects explicit path targeting combined with --since or --all", async () => {
    writeFileSync(join(root, "Button.tsx"), "export const Button = () => <button />;");
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const program = createProgram();
    program.exitOverride();

    await program.parseAsync(["lint", "Button.tsx", "--since", "HEAD~1"], { from: "user" });
    expect(process.exitCode).toBe(2);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("Cannot combine an explicit path target with --since."));

    process.exitCode = undefined;
    error.mockClear();
    const secondProgram = createProgram();
    secondProgram.exitOverride();
    await secondProgram.parseAsync(["lint", "Button.tsx", "--all"], { from: "user" });
    expect(process.exitCode).toBe(2);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("Cannot combine an explicit path target with --all."));
  });

  it("exits 2 for a nonexistent explicit target path", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const program = createProgram();
    program.exitOverride();

    await program.parseAsync(["lint", "src/nope"], { from: "user" });

    expect(process.exitCode).toBe(2);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("Target path does not exist: src/nope"));
  });

  it("prints the stack trace for a targeting error under --debug (RFC-009.1: typed errors keep their original CLI path)", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const program = createProgram();
    program.exitOverride();

    await program.parseAsync(["lint", "src/nope", "--debug"], { from: "user" });

    expect(process.exitCode).toBe(2);
    const messages = error.mock.calls.map((call) => String(call[0]));
    expect(messages[0]).toContain("Target path does not exist: src/nope");
    // `printCliError` only prints the stack under `--debug`; this is the same
    // typed-error CLI path used before RFC-009, not the generic
    // `status: "failed"` report path used for genuine operational failures.
    expect(messages.some((message) => message.includes("LintTargetingError"))).toBe(true);
  });

  it("exits 2 with an actionable error for --since outside a Git repository", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const program = createProgram();
    program.exitOverride();

    await program.parseAsync(["lint", "--since", "main"], { from: "user" });

    expect(process.exitCode).toBe(2);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("Git repository"));
  });

  it("reports nothing to configure and exits cleanly when nothing is unresolved", async () => {
    writeFileSync(join(root, "Button.tsx"), "export const Button = () => <button />;");
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const program = createProgram();
    program.exitOverride();

    await program.parseAsync(["lint", "--configure"], { from: "user" });

    expect(log.mock.calls.map((call) => String(call[0]))).toContainEqual(
      expect.stringContaining("nothing to configure"),
    );
    expect(process.exitCode).toBeUndefined();
  });

  it("exits 2 when --configure needs a TTY that is not available", async () => {
    writeFileSync(
      join(root, "Avatar.tsx"),
      `
        type AvatarProps = { user: { name: string } };
        export const Avatar = ({ user }: AvatarProps) => <img alt={user.name} />;
      `,
    );
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const program = createProgram();
    program.exitOverride();

    await program.parseAsync(["lint", "--configure"], { from: "user" });

    expect(process.exitCode).toBe(2);
  });

  it("exposes extra provenance under --verbose", async () => {
    writeFileSync(
      join(root, "Button.tsx"),
      `
        type ButtonProps = { size: "sm" | "lg" };
        export const Button = ({ size }: ButtonProps) => <button>{size}</button>;
      `,
    );
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const program = createProgram();
    program.exitOverride();

    await program.parseAsync(["lint", "--verbose"], { from: "user" });

    const output = log.mock.calls.map((call) => String(call[0])).join("\n");
    expect(output).toContain("(inferred)");
    expect(output).toContain("2 states not applicable");
    expect(output).not.toMatch(/Button\.tsx#Button#[0-9a-f]{10}/);
  });

  it("documents lint's flags in --help", () => {
    const program = createProgram();
    const lint = program.commands.find((command) => command.name() === "lint");
    const help = lint?.helpInformation() ?? "";

    expect(help).toContain("--since");
    expect(help).toContain("--configure");
    expect(help).toContain("--fail-on-skipped");
    expect(help.match(/Usage:/g)).toHaveLength(1);
  });
});
