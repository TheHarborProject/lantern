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

Create the smallest valid project configuration interactively:

```bash
lantern init
```

Lantern detects the nearest `package.json`, package manager, and conventional
source directories, then guides you through the startup script, component
source location, accessibility standard, and optional ignore patterns. Every
package script remains selectable, source suggestions include only directories
that exist, and supported standards come from Lantern's schema.

The generated file is deliberately minimal. Choosing the project root, WCAG
2.2 AA, and no ignore patterns relies on Lantern's implicit defaults, producing:

```json
{
  "project": {
    "startScript": "dev"
  }
}
```

The command creates `.lantern/config.json` and never overwrites an existing
Lantern configuration. Lantern also recognizes the legacy conventional names
`lantern.config.json` and `.lantern.json`.

The selected standard is operational, not just a report label. Lantern enables
its stable compatible checks by default; today that means accessible-name
static analysis and rendered keyboard-access checks for WCAG 2.2 AA. Explicit
`rules` entries override these defaults, including `"off"`, and matching
per-file overrides apply last. This changes earlier behavior where a selected
standard with no explicit rules performed no checks.

A custom source directory, standard, and ignore selection is serialized using
the existing configuration model:

```json
{
  "project": {
    "startScript": "storybook",
    "sourceDirectory": "src/components"
  },
  "standards": ["wcag21-aa"],
  "ignorePatterns": ["src/generated/**"]
}
```

The foundation schema keeps project lifecycle and optional form authentication settings while component audit configuration is introduced by later RFCs. A manually authored configuration may include additional fields:

```json
{
  "project": {
    "root": ".",
    "workingDirectory": ".",
    "sourceDirectory": ".",
    "baseUrl": "http://localhost:3000",
    "startScript": "dev",
    "autoStart": false
  }
}
```

When `autoStart` is enabled and `baseUrl` is not already reachable, Lantern
runs `startScript` as a `package.json` script from `workingDirectory`. It uses
the nearest supported `packageManager` declaration (`npm`, `pnpm`, `yarn`, or
`bun`), then a recognized lockfile, and otherwise falls back to npm. Script
names are passed as a single process argument, so custom script names remain
available without accepting arbitrary shell commands in Lantern configuration.

The script itself is project code and may execute shell commands through the
package manager. Only run Lantern against projects you trust; `startScript`
removes Lantern's command-string injection surface, not the trust required to
execute a repository's scripts.

## Component Discovery

Build the regenerable component index from TypeScript and TSX sources under `project.root`:

```bash
lantern scan
lantern scan --all
lantern survey
lantern survey src/components
lantern survey --since origin/main
lantern survey --name "before navbar refactor"
lantern survey --no-save
lantern list surveys
lantern show last
lantern export last
lantern delete last
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

## Programmatic survey API

`@timoogo/lantern/api` exposes `resolveProject`, `scan`, and `runSurvey`. The canonical result is the strict JSON-safe `SurveyRunV1` contract identified by `schema: "lantern-survey-run"` and `version: 1`. It includes immutable project, Git, targeting, execution-config, engine, diagnostic, standards, component, state, check, evidence, lifecycle, and summary facts. `renderSurveyRun` replays that value without reading source or scan state. The deprecated `runAudit` and `AuditWireDto v1` adapter remain available during the compatibility window.

Completed, failed, and cancelled started surveys are saved locally by default in `.lantern/surveys`; CI defaults to no persistence and `--no-save` always disables it. History is project-scoped and supports full IDs, unique prefixes, and `last`. The stored and exported JSON are the same validated `SurveyRunV1` representation. Configure history under `survey.history` with `path`, optional `maxRuns`, optional `maxAge` (for example `30d`), and `listMax`. Relative paths resolve from the project root; an explicitly configured absolute path is treated as user-authorized external storage and is never searched globally.

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
