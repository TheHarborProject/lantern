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

The command writes `.lantern/scan.json`. It records component exports, source paths, analyzable props, and explicit diagnostics for exports that cannot be confirmed as React components. It does not create audit files.

## Quality

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```
