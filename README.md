<p align="center">
  <img src="./assets/banner.png" alt="SnapRun banner">
</p>

# SnapRun

[![npm version](https://img.shields.io/npm/v/@timoogo/snaprun.svg)](https://www.npmjs.com/package/@timoogo/snaprun)
[![npm downloads](https://img.shields.io/npm/dm/@timoogo/snaprun.svg)](https://www.npmjs.com/package/@timoogo/snaprun)
[![Node.js](https://img.shields.io/node/v/@timoogo/snaprun.svg)](https://www.npmjs.com/package/@timoogo/snaprun)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

SnapRun is a TypeScript CLI for discovering Next.js routes and capturing deterministic Playwright screenshots. It supports App Router and Pages Router projects, optional application auto-start, form authentication, bounded parallel execution, and predictable output structures.

## Install

```bash
npm install -D @timoogo/snaprun
```

or run it directly:

```bash
npx @timoogo/snaprun --help
```

SnapRun requires Node.js 20+ and Chromium for Playwright:

```bash
npx playwright install chromium
```

## Quick Start

Initialize an exhaustive starter configuration:

```bash
snaprun init
```

Discover routes from the current Next.js project:

```bash
snaprun scan
```

Enable the routes you want to capture in `snaprun.config.json`, then run:

```bash
snaprun
```

A minimal configuration can look like this:

```json
{
  "project": {
    "baseUrl": "http://127.0.0.1:3000",
    "startCommand": "pnpm dev",
    "autoStart": true
  },
  "output": {
    "directory": "./snapshots",
    "fullPage": true,
    "structure": "flat"
  },
  "routes": [
    {
      "id": "home",
      "path": "/",
      "enableSnapshot": true
    }
  ],
  "runs": [],
  "execution": {
    "concurrency": 4,
    "collisionStrategy": "prompt"
  }
}
```

## What SnapRun does

- discovers Next.js App Router and Pages Router routes;
- supports static and dynamic routes;
- captures deterministic Chromium screenshots through Playwright;
- supports reusable authenticated runs;
- can start and stop the target application automatically;
- runs independent snapshot jobs with bounded concurrency;
- detects output collisions before unsafe concurrent writes;
- keeps output paths predictable for scripting and CI.

## Configuration Resolution

SnapRun resolves configuration files in this order:

1. `--config <path>`;
2. a remembered project config stored in `.snaprun/project.json`;
3. conventional file names in the current directory:
   - `snaprun.config.json`
   - `.snaprun.json`
   - `snapshot.config.json`
   - `settings.json`

When SnapRun receives an explicit configuration path, the validated path may be remembered for the current project:

```json
{
  "configPath": "./config/snaprun.json"
}
```

This metadata is local project state and should normally be ignored rather than committed. SnapRun does not modify `.gitignore` automatically.

## Configuration

```jsonc
{
  "project": {
    "root": ".",
    "workingDirectory": ".",
    "baseUrl": "http://localhost:3000",
    "startCommand": "pnpm dev",
    "autoStart": false
  },
  "output": {
    "directory": "./artifacts/snaprun",
    "fullPage": true,
    "structure": "flat"
  },
  "auth": {
    "loginRoute": "/login",
    "selectors": {
      "email": "input[name='email']",
      "password": "input[name='password']",
      "submit": "button[type='submit']"
    },
    "successUrl": "**/dashboard",
    "users": {
      "member": {
        "email": "member@example.com",
        "password": "${MEMBER_PASSWORD}"
      }
    }
  },
  "routes": [
    {
      "id": "home",
      "path": "/",
      "scope": "public",
      "enableSnapshot": true
    }
  ],
  "runs": [],
  "execution": {
    "concurrency": 4,
    "collisionStrategy": "prompt"
  }
}
```

Only the `project` section is required. `routes` and `runs` default to empty arrays. `execution.concurrency` defaults to `4`.

### Secrets

Configuration values may reference environment variables:

```json
{ "password": "${MEMBER_PASSWORD}" }
```

Resolution order:

1. `process.env`;
2. `.env.local` in `project.workingDirectory`;
3. `.env` in `project.workingDirectory`.

## CLI

Initialize a starter config:

```bash
snaprun init
```

Capture snapshots:

```bash
snaprun
snaprun exec
snaprun --config ./config/snaprun.json
snaprun --runName member
snaprun --route /member/stays --user member
```

Discover routes:

```bash
snaprun scan
snaprun scan --default=enabled
```

### Options

- `--config <path>`: load a specific configuration file;
- `--debug`: print the full stack trace and original cause;
- `--runName <name>`: capture only one configured run;
- `--partial`: requires `--runName`; retained for CLI compatibility;
- `--route <path>`: capture one configured route by path;
- `--user <name>`: use this user when capturing a route outside a run;
- `scan --default <enabled|disabled>`: set `enableSnapshot` for newly discovered routes.

## Parallel Execution

SnapRun executes independent snapshot jobs with bounded concurrency:

```json
{
  "execution": {
    "concurrency": 4,
    "collisionStrategy": "prompt"
  }
}
```

A run remains one execution job: its routes stay ordered inside a shared isolated BrowserContext, preserving authentication and session reuse. Standalone routes remain isolated jobs.

Supported collision strategies:

- `prompt`: defer conflicting captures and resolve them interactively;
- `serialize`: keep unrelated jobs parallel while serializing jobs that target the same output path;
- `error`: abort before capture when output collisions are detected.

In non-interactive environments, `prompt` safely falls back to `error`.

## Screenshot Output Structures

### `flat`

```text
artifacts/snaprun/
├── member/
│   └── 01-member-home.png
└── standalone/
    └── home.png
```

### `run`

```text
artifacts/snaprun/
└── run/
    └── 2026-08-06_1856/
        ├── home/
        │   └── page.png
        └── member-stays/
            └── page.png
```

### `scope`

```text
artifacts/snaprun/
├── public/
│   └── home/
│       └── page.png
└── member/
    └── member-stays/
        └── page.png
```

Routes without `scope` are stored under `unscoped/`.

## Route Model

Static route:

```json
{
  "id": "member-calendar",
  "path": "/member/calendar",
  "scope": "member",
  "enableSnapshot": true,
  "user": "member"
}
```

Dynamic route:

```json
{
  "id": "member-stay",
  "path": "/member/stays/[stayId]",
  "isDynamic": true,
  "parameters": {
    "stayId": "seed-stay-123"
  },
  "scope": "member",
  "enableSnapshot": true,
  "user": "member"
}
```

## Runs

Runs group ordered routes and may provide a shared user:

```json
{
  "runs": [
    {
      "runName": "member",
      "order": 1,
      "user": "member",
      "routes": ["member-home", "member-calendar"]
    }
  ]
}
```

Routes inside one run execute sequentially in one isolated BrowserContext. Different runs may execute concurrently according to `execution.concurrency`.

## Development

```bash
pnpm install
pnpm exec playwright install chromium
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## Issues and RFCs

Bug reports and feature requests are tracked through GitHub Issues. Larger architectural changes are documented in `RFCs/` before implementation.

## License

MIT
