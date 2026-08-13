import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runComponentScan } from "./run-component-scan.js";

function writeSource(root: string, path: string, content: string): void {
  const filePath = join(root, path);
  mkdirSync(join(filePath, ".."), { recursive: true });
  writeFileSync(filePath, content);
}

describe("runComponentScan", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "lantern-component-scan-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("discovers named and default TSX components with analyzable props", () => {
    writeSource(
      root,
      "src/Button.tsx",
      `
        export interface ButtonProps {
          disabled?: boolean;
          label: string;
        }
        export function Button(props: ButtonProps) {
          return <button disabled={props.disabled}>{props.label}</button>;
        }
      `,
    );
    writeSource(
      root,
      "src/Banner.tsx",
      `
        type BannerProps = { message: string; tone?: "info" | "warning" };
        export default function Banner({ message }: BannerProps) {
          return <aside>{message}</aside>;
        }
      `,
    );

    const index = runComponentScan(root);

    expect(index.components.map((component) => component.id)).toEqual([
      "src/Banner.tsx#default",
      "src/Button.tsx#Button",
    ]);
    expect(index.components[0]).toMatchObject({
      source: "src/Banner.tsx",
      exportName: "default",
      name: "Banner",
      exportKind: "default",
      analysis: { status: "complete", diagnostics: [] },
    });
    expect(index.components[0]?.props).toEqual([
      { name: "message", type: "string", required: true },
      { name: "tone", type: '"info" | "warning" | undefined', required: false },
    ]);
    expect(index.components[1]?.props).toEqual([
      { name: "disabled", type: "boolean | undefined", required: false },
      { name: "label", type: "string", required: true },
    ]);
    expect(index.diagnostics).toEqual([]);
  });

  it("marks untyped props as partial instead of inventing their shape", () => {
    writeSource(
      root,
      "Field.tsx",
      "export const Field = (props) => <input value={props.value} />;",
    );

    const index = runComponentScan(root);

    expect(index.components[0]).toMatchObject({
      name: "Field",
      props: [],
      analysis: {
        status: "partial",
        diagnostics: ["Props parameter has no analyzable TypeScript annotation."],
      },
    });
  });

  it("detects anonymous default and wrapped components", () => {
    writeSource(root, "src/Icon.tsx", "export default () => <svg />;");
    writeSource(
      root,
      "src/Notice.tsx",
      `
        declare function memo<T>(component: T): T;
        type NoticeProps = { text: string };
        export const Notice = memo((props: NoticeProps) => <p>{props.text}</p>);
      `,
    );

    const index = runComponentScan(root);

    expect(index.components.map((component) => component.id)).toEqual([
      "src/Icon.tsx#default",
      "src/Notice.tsx#Notice",
    ]);
    expect(index.components[0]?.name).toBe("Icon");
    expect(index.components[1]?.props).toEqual([
      { name: "text", type: "string", required: true },
    ]);
  });

  it("follows barrel exports while retaining the declaration source", () => {
    writeSource(root, "src/Card.tsx", "const Card = () => <article />; export default Card;");
    writeSource(root, "src/index.ts", "export { default as Card } from './Card.js';");

    const index = runComponentScan(root);

    expect(index.components).toContainEqual(
      expect.objectContaining({
        id: "src/Card.tsx#Card",
        source: "src/Card.tsx",
        exportName: "Card",
        exportKind: "named",
      }),
    );
  });

  it("reports PascalCase exports that cannot be confirmed as components", () => {
    writeSource(root, "src/theme.ts", "export const Theme = { color: 'red' };");

    const index = runComponentScan(root);

    expect(index.components).toEqual([]);
    expect(index.diagnostics).toEqual([
      {
        source: "src/theme.ts",
        exportName: "Theme",
        message: "Export could not be confirmed as a React component by static analysis.",
      },
    ]);
  });

  it("is deterministic and ignores internal, generated, and test sources", () => {
    writeSource(root, "src/Zed.tsx", "export const Zed = () => <div />;");
    writeSource(root, "src/Alpha.tsx", "export const Alpha = () => <div />;");
    writeSource(root, "src/Alpha.test.tsx", "export const TestOnly = () => <div />;");
    writeSource(root, ".lantern/Old.tsx", "export const Old = () => <div />;");
    writeSource(root, "node_modules/pkg/External.tsx", "export const External = () => <div />;");

    expect(runComponentScan(root)).toEqual(runComponentScan(root));
    expect(runComponentScan(root).components.map((component) => component.name)).toEqual([
      "Alpha",
      "Zed",
    ]);
  });
});
