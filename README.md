# Lantern

Lantern is a TypeScript CLI for auditing the accessibility of web components in a real browser. This repository currently contains the reusable foundation: command-line conventions, Zod configuration, environment handling, application lifecycle helpers, and Playwright integration.

## Requirements

- Node.js 20 or newer
- pnpm
- a Playwright browser when browser-backed commands are added

## Development

```bash
pnpm install
pnpm build
node dist/index.js --help
node dist/index.js --version
```

The published binary is `lantern`:

```bash
pnpm exec lantern --help
```

## Configuration

Lantern recognizes `lantern.config.json` and `.lantern.json`. The foundation schema keeps project lifecycle and optional form authentication settings while component audit configuration is introduced by later RFCs.

```json
{
  "project": {
    "root": ".",
    "workingDirectory": ".",
    "baseUrl": "http://localhost:3000",
    "autoStart": false
  }
}
```

## Component Discovery

Build the regenerable component index from TypeScript and TSX sources under `project.root`:

```bash
lantern audit scan
```

Component discovery builds one canonical internal model and derives several projections from it — sources are never scanned separately per view:

```text
.lantern/
├── scan.json                 # human-readable projection
├── accessibility.json        # accessibility projection
└── cache/
    └── component-scan.json   # exhaustive internal model
```

- `scan.json` is the concise, human-readable view. It lists component identity, source path, export name/kind, **component-owned props only**, and actionable diagnostics. The inherited DOM/React prop surface is intentionally omitted here.
- `cache/component-scan.json` is the exhaustive machine-readable model. Every prop is resolved (including inherited DOM/React props) and tagged with its `origin` (`declared` vs `inherited`) and portable `provenance`.
- `accessibility.json` derives accessibility-oriented facts — native/derived semantics, focusability, accessible-name sources, ARIA/state props, and whether runtime analysis may be required. It describes the target component and encodes no rule catalog specific to any accessibility engine.

## Programmatic audit API

`@timoogo/lantern/api` exposes the narrow RFC-009 service boundary: `resolveProject`, `discoverComponents`, `runAudit`, and explicit conversion to the versioned JSON-safe audit DTO. Audit requests may select canonical component IDs and observe typed lifecycle events without depending on Commander or parsing terminal output. State/check selectors are reserved by the request model and currently reject with a structured failed run instead of being ignored.

`lantern/keyboard-access` currently verifies one deliberately narrow property: whether rendered interactive output participates in the sequential keyboard focus order, or is correctly excluded when natively disabled. It does not claim to verify activation keys, custom keyboard handlers, focus-order quality, focus traps, or complete keyboard operability.

The command does not create audit files, and obvious configuration files (for example `*.config.ts`) are skipped while genuinely ambiguous sources still produce partial-analysis diagnostics.

## Isolated Component Runtime

Lantern can mount a single discovered component in a real browser without a Storybook file or a per-component harness. It generates a temporary render harness it fully owns, bundles the component (with React resolved from the project), serves a minimal page with a `#root` mount point, and drives it with Playwright so audit engines can inspect the rendered DOM:

```text
Component source → generated harness → Lantern runtime → Playwright → rendered DOM → audit engines
```

The harness is never written into the project, and a render failure raises an actionable error stating what is missing (source, dependency, provider, or global style).

Genuinely global context is configured once for the project under `isolation`, so components never redeclare it:

```json
{
  "project": { "root": "." },
  "isolation": {
    "globalCss": ["src/app/globals.css"],
    "wrapper": "lantern/isolation-wrapper.tsx",
    "wrapperExport": "default"
  }
}
```

- `globalCss` — stylesheets inlined into every isolation page.
- `wrapper` / `wrapperExport` — a shared wrapper module (compose `ThemeProvider`, i18n, and context providers there) applied around every mounted component.

## Quality

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```
