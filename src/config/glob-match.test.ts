import { describe, expect, it } from "vitest";
import { matchesAnyGlob, matchesGlob } from "./glob-match.js";

describe("matchesGlob", () => {
  it("matches a directory pattern with a trailing slash against files beneath it", () => {
    expect(matchesGlob("node_modules/pkg/index.ts", "node_modules/")).toBe(true);
    expect(matchesGlob("src/node_modules.ts", "node_modules/")).toBe(false);
  });

  it("matches a bare directory name the same as its trailing-slash form", () => {
    expect(matchesGlob("dist/index.js", "dist")).toBe(true);
  });

  it("matches ** across path segments", () => {
    expect(matchesGlob("src/components/internal/Foo.tsx", "src/components/internal/**")).toBe(true);
    expect(matchesGlob("src/components/internal/nested/Foo.tsx", "src/components/internal/**")).toBe(
      true,
    );
  });

  it("matches * within a single path segment only", () => {
    expect(matchesGlob("src/a.ts", "src/*.ts")).toBe(true);
    expect(matchesGlob("src/nested/a.ts", "src/*.ts")).toBe(false);
  });

  it("matches an unanchored pattern at any depth", () => {
    expect(matchesGlob("a.stories.tsx", "*.stories.tsx")).toBe(true);
    expect(matchesGlob("src/components/a.stories.tsx", "*.stories.tsx")).toBe(true);
  });

  it("anchors a pattern containing a slash at the root", () => {
    expect(matchesGlob("app/src/theme.ts", "src/theme.ts")).toBe(false);
    expect(matchesGlob("src/theme.ts", "src/theme.ts")).toBe(true);
  });

  it("does not match on a partial segment prefix", () => {
    expect(matchesGlob("foobar/index.ts", "foo/")).toBe(false);
  });

  it("matchesAnyGlob matches when any pattern matches", () => {
    expect(matchesAnyGlob("dist/index.js", ["node_modules/", "dist/"])).toBe(true);
    expect(matchesAnyGlob("src/index.ts", ["node_modules/", "dist/"])).toBe(false);
  });
});
