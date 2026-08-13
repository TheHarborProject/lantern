# RFC-014 — Parallel Snapshot Execution

## Status

Implemented

## Dependency

This RFC depends on:

`RFC-013 — Configuration Schema & Init`

RFC-013 must be implemented first because it introduces the validated configuration architecture that this RFC extends with the `execution` configuration domain.

---

# 1. Summary

This RFC introduces bounded parallel execution for SnapRun snapshot jobs.

Currently, screenshot work is effectively processed sequentially.

Conceptually:

```ts
for (const route of routes) {
  await snapshot(route);
}
```

This RFC changes execution to use a concurrency-limited scheduler.

Target architecture:

```text
Validated Config
      │
      ▼
Snapshot Jobs
      │
      ▼
Bounded Scheduler
      │
      ▼
Concurrent Playwright Work
      │
      ▼
Results / Output
```

Parallel execution must remain safe for:

* routes;
* runs;
* authentication;
* browser contexts;
* screenshots;
* output paths;
* errors.

---

# 2. Goals

Introduce:

```json
{
  "execution": {
    "concurrency": 4
  }
}
```

and execute snapshot jobs concurrently while strictly respecting that limit.

The scheduler must prevent uncontrolled `Promise.all()` style execution.

---

# 3. Execution schema

Add a new configuration domain:

```text
execution
```

Recommended schema:

```ts
export const executionSchema = z.object({
  concurrency: z.number().int().min(1).default(4),
});
```

Then integrate it into the root SnapRun schema.

Conceptually:

```ts
export const snaprunConfigSchema = z.object({
  ...
  execution: executionSchema.optional(),
});
```

Because `concurrency` has a runtime default, the resolved runtime configuration should still have a usable value when `execution` is absent.

Exact schema composition should follow the conventions introduced in RFC-001.

---

# 4. Init integration

Update the `snaprun init` configuration introduced by RFC-001 to expose:

```json
{
  "execution": {
    "concurrency": 4
  }
}
```

This keeps the generated configuration exhaustive.

---

# 5. Bounded concurrency

Do not implement unbounded execution such as:

```ts
await Promise.all(routes.map(snapshot));
```

Instead, at most:

```text
execution.concurrency
```

snapshot jobs may be active at the same time.

Example:

```text
jobs:
A B C D E F G

concurrency:
3
```

Possible execution:

```text
worker 1: A ── D ── G
worker 2: B ── E
worker 3: C ── F
```

Completion order does not need to match input order.

Result association must remain deterministic.

---

# 6. Scheduler abstraction

Concurrency logic should be isolated from route-specific logic.

Prefer an abstraction conceptually equivalent to:

```ts
runWithConcurrency(jobs, concurrency, worker)
```

or:

```ts
scheduler.run(jobs)
```

The scheduler should only understand:

* jobs;
* maximum concurrency;
* job execution;
* completion/failure.

It should not need to understand:

* Next.js routing;
* authentication internals;
* screenshot naming;
* configuration resolution.

Possible location:

```text
src/runner/
├── scheduler.ts
├── snapshot-runner.ts
└── ...
```

Adapt to the current repository structure if a better domain already exists.

---

# 7. Job model

Before introducing concurrency, identify the smallest independent unit of screenshot work.

A job should contain all state necessary for one snapshot operation.

Conceptually:

```ts
type SnapshotJob = {
  route: ...
  run: ...
  user: ...
  output: ...
}
```

The actual structure should reflect existing SnapRun semantics.

Avoid requiring mutable global state such as:

```ts
currentRoute
currentRun
currentUser
```

because concurrent execution would make such state unsafe.

---

# 8. Playwright lifecycle

Inspect the current Playwright resource lifecycle before implementation.

Determine how SnapRun currently manages:

* browser;
* browser context;
* page;
* authentication state;
* storage state.

Do not automatically launch one full Chromium process for every route.

Prefer reuse where safe.

Possible architecture:

```text
Browser
 ├── Context/Page job A
 ├── Context/Page job B
 ├── Context/Page job C
 └── Context/Page job D
```

However, isolation requirements take precedence over browser reuse.

---

# 9. Authentication isolation

Authentication must remain correct during concurrent execution.

Jobs belonging to different roles/users must never leak state.

Potential failure cases include:

* cookies from user A being visible to user B;
* shared localStorage;
* shared authentication context;
* login actions racing;
* mutable storage-state files being overwritten.

If SnapRun currently creates one authenticated context per run/user, preserve or strengthen that isolation.

If authentication currently relies on mutable global state, refactor it before enabling parallel execution.

---

# 10. Run semantics

Existing `runs` behavior must remain unchanged.

Parallelization changes **when** jobs execute, not **what** a run means.

If a run selects:

* a set of routes;
* a user;
* a role;
* a configuration variant;

each generated job must retain that association independently.

---

# 11. Output safety

Concurrent jobs must not write to the wrong screenshot location.

Output paths should be computed from immutable job data.

Avoid patterns relying on mutable global values.

Conceptually:

```ts
const outputPath = resolveOutputPath(job);
await capture(job, outputPath);
```

rather than:

```ts
currentRoute = route;
await capture();
```

Ensure two valid jobs cannot unintentionally target the same path unless existing SnapRun semantics explicitly permit overwriting.

---

# 12. Scheduler semantics

For a concurrency value of:

```text
1
```

execution should behave sequentially.

For:

```text
4
```

no more than four jobs may execute concurrently.

The scheduler should continue consuming queued jobs as workers become free.

Conceptually:

```text
queue
  │
  ├── worker
  ├── worker
  ├── worker
  └── worker
```

Workers do not need to be explicit long-lived classes if a simpler implementation provides the same semantics.

Avoid unnecessary architecture.

---

# 13. Failures

One snapshot failure must not corrupt the scheduler.

After a job rejects:

* its execution slot must become available again;
* queued jobs must continue according to SnapRun's chosen failure semantics;
* browser/page resources must be cleaned up;
* the failed job must remain associated with its error.

Do not introduce retries in this RFC.

---

# 14. Fail-fast behavior

Inspect current SnapRun behavior.

If SnapRun currently stops the entire command on the first screenshot error, explicitly decide whether that behavior remains appropriate under parallel execution.

Prefer preserving existing external behavior unless changing it provides a clear benefit.

Regardless of user-facing fail-fast semantics, the scheduler itself must not be left in an inconsistent state.

---

# 15. Resource cleanup

Every concurrently allocated Playwright resource must be closed safely.

Use `try/finally` or equivalent protection around:

* pages;
* contexts;
* temporary resources.

One job failing must not prevent cleanup for another.

Browser shutdown should happen only after all relevant work has settled.

---

# 16. Concurrency boundaries

`execution.concurrency` applies to actual independent screenshot jobs.

Do not accidentally parallelize internal operations that are unsafe, such as:

* project startup;
* configuration loading;
* global authentication initialization;
* final browser shutdown.

Concurrency should begin only when independent work is ready.

---

# 17. Project startup

If SnapRun starts the target project through:

```text
project.startCommand
```

the project must be fully started before concurrent route work begins.

Target sequence:

```text
Resolve Config
     │
     ▼
Start Project
     │
     ▼
Wait Until Ready
     │
     ▼
Prepare Auth / Runtime
     │
     ▼
Build Snapshot Jobs
     │
     ▼
Parallel Execution
     │
     ▼
Cleanup
```

Do not spawn multiple application servers because multiple jobs are running.

---

# 18. Performance

The purpose of this RFC is to reduce snapshot execution time without making SnapRun unstable.

Avoid premature optimization such as:

* custom worker threads;
* process pools;
* complex resource schedulers;
* distributed execution.

Node.js asynchronous concurrency is sufficient for this RFC.

Playwright performs much of its work outside the JavaScript execution thread.

---

# 19. Ordering

Execution order between jobs is not guaranteed when concurrency is greater than one.

Do not make internal behavior depend on screenshot completion order.

If the CLI displays a final summary, preserve a stable logical order where practical.

For example, results may be reordered according to the original job index before rendering the summary.

---

# 20. Tests

Add deterministic scheduler tests.

Avoid tests that rely only on arbitrary sleeps.

Track currently active jobs.

Example:

```ts
let active = 0;
let maxActive = 0;

const worker = async () => {
  active++;
  maxActive = Math.max(maxActive, active);

  await barrier();

  active--;
};
```

Then assert:

```ts
expect(maxActive).toBeLessThanOrEqual(concurrency);
```

Tests should cover at minimum:

### Concurrency 1

* jobs execute sequentially;
* max active jobs equals 1.

### Concurrency N

* multiple jobs can execute simultaneously;
* active jobs never exceed N.

### Complete queue

* every queued job eventually executes.

### Failure

* a failed job releases its concurrency slot;
* subsequent work can continue;
* failure/result association remains correct.

### Output association

* each result remains attached to the correct job.

---

# 21. Integration tests

Where practical, add a small Playwright integration test verifying that multiple routes can be captured concurrently.

Do not overbuild the integration fixture.

The important behaviors are:

* screenshots complete;
* paths remain correct;
* resources close correctly.

If authentication fixtures already exist, add a focused isolation test rather than constructing a new test application.

---

# 22. Logging / CLI output

Concurrent execution may make existing progress logs visually inconsistent.

Avoid having jobs write uncontrolled multi-line logs simultaneously.

If the existing logger can handle concurrency, preserve it.

Otherwise, collect per-job status and render concise lifecycle messages.

Do not turn this RFC into a full CLI UI redesign.

---

# 23. Out of scope

Do not implement:

* retries;
* priority queues;
* worker threads;
* process pools;
* distributed workers;
* browser pools beyond what is strictly required;
* rate limiting;
* cancellation APIs;
* adaptive concurrency;
* CPU detection;
* automatic concurrency tuning;
* screenshot diffing;
* reporting;
* responsive presets;
* hooks;
* plugins.

These may build on the scheduler later.

---

# 24. Future compatibility

The scheduler should remain simple enough that future capabilities can build around it:

```text
Retry queue
Priority
Cancellation
Rate limiting
Browser pool
```

Do not implement those abstractions prematurely.

The scheduler only needs a clean bounded-concurrency contract today.

---

# 25. Implementation order

Recommended sequence:

1. inspect current runner;
2. inspect browser/context/page lifecycle;
3. inspect run and auth state;
4. identify the independent snapshot job unit;
5. add `executionSchema`;
6. expose `execution.concurrency` in init defaults;
7. create bounded scheduler;
8. convert existing route work into jobs;
9. integrate scheduler;
10. verify authentication isolation;
11. verify output isolation;
12. ensure Playwright cleanup;
13. add scheduler tests;
14. add focused integration tests;
15. benchmark sequential vs parallel behavior manually.

---

# 26. Acceptance criteria

This RFC is complete when:

* SnapRun supports `execution.concurrency`;
* default concurrency is `4`;
* concurrency must be an integer >= 1;
* `snaprun init` exposes the execution configuration;
* snapshot jobs execute concurrently;
* the concurrency limit is strictly respected;
* concurrency `1` behaves sequentially;
* no uncontrolled `Promise.all()` launches every job simultaneously;
* run associations remain correct;
* authentication remains isolated;
* output paths remain deterministic;
* one job failure does not corrupt scheduler state;
* Playwright resources are correctly cleaned up;
* tests verify concurrency limits and failure behavior;
* existing SnapRun behavior remains compatible.

---

# 27. Implementation-agent instructions

Before changing code:

1. inspect the existing snapshot execution pipeline;
2. document current browser/context/page ownership;
3. document current authentication state ownership;
4. identify mutable state that would become unsafe under concurrency;
5. identify the actual snapshot job boundary.

Do not start by blindly replacing loops with `Promise.all`.

After implementation, report:

* files created;
* files modified;
* new execution schema;
* scheduler API;
* snapshot job representation;
* browser reuse strategy;
* context/page isolation strategy;
* authentication isolation strategy;
* output safety strategy;
* failure semantics;
* tests added;
* measured or observed performance impact;
* remaining risks.
