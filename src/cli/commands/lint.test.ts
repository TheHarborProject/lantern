import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createProgram } from "../program.js";

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
    expect(output).toContain("no checks executed (no check provider configured)");
    expect(process.exitCode).toBe(0);
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
    expect(output).toMatch(/Button\.tsx#Button#[0-9a-f]{10}/);
    expect(output).toContain("(inferred)");
  });

  it("documents lint's flags in --help", () => {
    const program = createProgram();
    const lint = program.commands.find((command) => command.name() === "lint");

    expect(lint?.helpInformation()).toContain("--since");
    expect(lint?.helpInformation()).toContain("--configure");
    expect(lint?.helpInformation()).toContain("--fail-on-skipped");
  });
});
