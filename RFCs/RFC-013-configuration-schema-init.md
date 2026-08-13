# RFC-013 — Configuration Schema & Init Command

## Status

Implemented

## Summary

This RFC introduces a formal configuration contract for SnapRun using Zod and adds a new `snaprun init` command.

The objectives are:

* make Zod the runtime source of truth for SnapRun configuration;
* derive TypeScript configuration types from Zod where practical;
* validate configuration at load time;
* provide clear CLI validation errors;
* modularize configuration schemas by domain;
* add `snaprun init`;
* generate an exhaustive starter configuration exposing all supported options.

This RFC does **not** introduce execution parallelization.

---

# 1. Context

SnapRun currently consumes configuration from `snaprun.config.json`.

Existing configuration domains include, among others:

* `project`
* `routes`
* `runs`
* `auth`
* `output`

The current configuration format already works, but the project now needs a stronger contract before new execution capabilities are introduced.

Configuration should no longer be treated as an unvalidated JSON object.

The target architecture is:

```text
snaprun.config.json
        │
        ▼
       Zod
        │
        ▼
Validated SnapRun Config
        │
        ├── CLI
        ├── Scan
        ├── Auth
        ├── Runner
        └── Output
```

---

# 2. Goals

## 2.1 Introduce Zod

Add Zod as the runtime validation layer for SnapRun configuration.

Zod should provide:

* runtime validation;
* configuration defaults where they are true runtime defaults;
* TypeScript inference;
* structured validation errors.

Prefer:

```ts
export type SnaprunConfig = z.infer<typeof snaprunConfigSchema>;
```

over manually maintained duplicate TypeScript interfaces.

Existing public types may be preserved temporarily if removing them would create unnecessary compatibility issues.

---

# 3. Preserve existing behavior

Before implementation, inventory the current configuration system.

Locate:

* existing config types;
* config parsing;
* config resolution;
* default values;
* optional fields;
* route configuration;
* run configuration;
* authentication configuration;
* output configuration;
* every runtime consumer of the config.

Every currently supported configuration option must remain supported.

This RFC must not silently:

* remove fields;
* rename fields;
* change semantics;
* make previously optional fields required;
* change default behavior.

The repository implementation remains authoritative if this RFC contains an outdated example.

---

# 4. Schema architecture

Schemas must be modular.

Recommended structure:

```text
src/config/
├── schema/
│   ├── project.ts
│   ├── auth.ts
│   ├── output.ts
│   ├── route.ts
│   ├── run.ts
│   └── index.ts
│
├── defaults/
│   ├── project.ts
│   ├── auth.ts
│   ├── output.ts
│   └── index.ts
│
├── loader.ts
├── writer.ts
└── index.ts
```

Exact filenames may adapt to the current repository architecture.

The responsibility boundaries should remain.

## `schema/`

Defines:

> What is a valid SnapRun configuration?

## `defaults/`

Defines:

> What should `snaprun init` write?

## `loader.ts`

Responsible for:

* reading the configuration;
* parsing JSON;
* validating the result;
* applying actual runtime defaults;
* returning a validated configuration object.

## `writer.ts`

Responsible for configuration serialization and file creation.

---

# 5. Root schema

The root schema should compose the domain schemas.

Conceptually:

```ts
export const snaprunConfigSchema = z.object({
  project: projectSchema,
  routes: z.array(routeSchema),
  runs: z.array(runSchema).optional(),
  auth: authSchema.optional(),
  output: outputSchema.optional(),
});
```

This example is illustrative only.

The final shape must reflect the actual current SnapRun configuration.

---

# 6. Runtime defaults vs init defaults

A strict distinction must exist between:

```text
runtime default
```

and:

```text
starter/example value
```

Use Zod `.default()` only when SnapRun genuinely assumes that value when the field is absent.

Example:

```ts
autoStart: z.boolean().default(true)
```

is appropriate only if `true` is genuinely the existing runtime behavior.

Do not use Zod defaults merely because a value is useful in the generated config.

For example:

```json
{
  "loginRoute": "/sign-in",
  "selectors": {
    "email": "#email",
    "password": "#password",
    "submit": "button[type='submit']"
  }
}
```

may be appropriate for the `init` template while remaining optional or application-specific in the runtime schema.

The rule is:

```text
schema
→ validity and actual runtime defaults

defaults
→ discoverable starter configuration
```

---

# 7. Configuration loading

Replace unchecked casts/manual assumptions with schema validation.

Conceptually:

```ts
const rawConfig = JSON.parse(content);

const result = snaprunConfigSchema.safeParse(rawConfig);
```

If valid:

```ts
return result.data;
```

If invalid, expose a human-readable CLI error.

Avoid exposing raw Zod stack traces.

Desired output:

```text
Invalid snaprun.config.json

auth.selectors.submit
  Expected string

project.baseUrl
  Invalid URL
```

Error formatting should preserve the path to the invalid field.

---

# 8. Type inference

Where practical, configuration types should come directly from the schemas.

Example:

```ts
export type ProjectConfig = z.infer<typeof projectSchema>;
export type RouteConfig = z.infer<typeof routeSchema>;
export type AuthConfig = z.infer<typeof authSchema>;
export type SnaprunConfig = z.infer<typeof snaprunConfigSchema>;
```

Avoid maintaining this:

```ts
interface RouteConfig {
  ...
}
```

alongside an equivalent Zod schema unless there is a concrete reason.

---

# 9. `snaprun init`

Add:

```bash
snaprun init
```

The command creates:

```text
snaprun.config.json
```

in the current working directory.

Expected UX:

```text
$ snaprun init

✔ Created snaprun.config.json
```

No interactive questionnaire is required in this RFC.

No automatic snapshot execution is required.

No automatic route scan is required.

`init` should remain small and predictable.

---

# 10. Exhaustive generated configuration

The generated configuration should expose **all configuration capabilities currently supported by SnapRun**.

The design principle is:

> It is easier for the user to delete unused configuration than to discover missing configuration options.

Therefore, optional configuration sections should still appear in the generated starter file.

At minimum, current domains should include:

```text
project
routes
runs
auth
output
```

If repository inspection reveals other supported optional fields or domains, they must also appear.

---

# 11. Routes and runs

Do not generate fake project routes.

Use:

```json
{
  "routes": [],
  "runs": []
}
```

The generated file should not pretend to know the application structure.

Route discovery remains the responsibility of the scan functionality.

---

# 12. Starter values

Object-based domains should contain useful starter values where appropriate.

Existing/common project values currently include equivalents of:

```json
{
  "project": {
    "root": ".",
    "workingDirectory": ".",
    "baseUrl": "http://127.0.0.1:3000",
    "startCommand": "pnpm dev",
    "autoStart": true
  }
}
```

Existing/common output configuration includes equivalents of:

```json
{
  "output": {
    "directory": "./artifacts/snaprun",
    "fullPage": true
  }
}
```

Authentication may expose representative selectors and routes so the generated file documents the available structure.

However, inspect the actual repository before finalizing values.

---

# 13. Existing config protection

`snaprun init` must not silently overwrite an existing configuration file.

Example:

```text
$ snaprun init

✖ snaprun.config.json already exists
```

If SnapRun already has a consistent `--force` convention, it may be reused.

Do not introduce a force mechanism solely for this RFC unless it naturally fits the current CLI architecture.

---

# 14. Init template validity

The generated configuration must remain compatible with the schema.

Add a test validating the starter configuration:

```ts
expect(() => {
  snaprunConfigSchema.parse(defaultConfig);
}).not.toThrow();
```

This prevents future drift between:

* supported config;
* Zod schema;
* generated config.

---

# 15. Writer

Introduce a small configuration writer abstraction rather than embedding filesystem logic directly inside the CLI command.

Conceptually:

```ts
writeConfig(path, config)
```

Responsibilities:

* serialize JSON;
* use stable formatting;
* append a newline;
* prevent accidental overwrite when requested;
* surface filesystem errors cleanly.

Recommended JSON formatting:

```ts
JSON.stringify(config, null, 2)
```

---

# 16. Tests

Add tests covering at minimum:

## Schemas

* valid complete configuration;
* valid minimal configuration;
* optional fields;
* nested validation;
* invalid types;
* invalid values;
* runtime defaults;
* existing configuration fixtures.

## Loader

* valid JSON;
* malformed JSON;
* schema-invalid JSON;
* useful validation messages.

## Init

* creates `snaprun.config.json`;
* generated content is valid JSON;
* generated config passes `snaprunConfigSchema`;
* all supported top-level configuration domains are represented;
* `routes` is generated;
* `runs` is generated if supported;
* existing config is not silently overwritten.

---

# 17. Compatibility

Existing valid SnapRun projects should continue to work after this RFC.

The migration to Zod is an internal strengthening of the configuration contract, not a configuration format redesign.

Any compatibility issue discovered during implementation must be reported before intentionally changing behavior.

---

# 18. Out of scope

Do not implement as part of this RFC:

* parallel snapshot execution;
* concurrency configuration;
* retries;
* screenshot comparison;
* report generation;
* responsive presets;
* plugins;
* hooks;
* TypeScript config files;
* automatic documentation generation;
* interactive onboarding;
* CLI redesign.

---

# 19. Implementation order

Recommended sequence:

1. inventory current configuration;
2. add Zod dependency;
3. create domain schemas;
4. compose root schema;
5. derive TypeScript config types;
6. migrate loader;
7. format validation errors;
8. create init defaults/template;
9. add config writer;
10. add `snaprun init`;
11. add tests;
12. verify existing config compatibility.

---

# 20. Acceptance criteria

This RFC is complete when:

* Zod validates SnapRun configuration at runtime;
* schemas are separated by domain;
* TypeScript config types derive from schemas where practical;
* existing valid configurations remain compatible;
* invalid configs produce understandable CLI errors;
* `snaprun init` exists;
* `snaprun init` creates `snaprun.config.json`;
* the generated config exposes all supported configuration capabilities;
* generated routes/runs do not invent application data;
* existing config files are not silently overwritten;
* generated configuration is tested against the root Zod schema;
* existing tests remain green.

---

# 21. Implementation-agent instructions

Before changing code:

1. inspect the current SnapRun repository;
2. identify every configuration-related type and consumer;
3. produce a short inventory of the existing configuration shape;
4. identify any mismatch between the repository and this RFC;
5. preserve repository behavior unless a change is explicitly required.

After implementation, report:

* files created;
* files modified;
* types removed or replaced;
* schema structure;
* runtime defaults;
* init defaults;
* loader changes;
* generated configuration shape;
* tests added;
* compatibility concerns.
