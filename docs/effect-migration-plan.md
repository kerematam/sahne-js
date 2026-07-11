# Effect v4 Migration Plan

Status: implemented on 2026-07-10.

Target: `effect@4.0.0-beta.97`, source tag `effect@4.0.0-beta.97`, commit
`f643dbb265093065dc0a61ca6133693dc2401678`.

This plan is version-specific. Follow `docs/effect-source.md` and use the pinned
`.repos/effect` checkout as the API authority throughout the migration.

## Executive Decision

- Migrate the maintained Sahne library, browser runner, and CLI internals to
  Effect while preserving the current consumer-facing configuration shape.
- Keep pure matching, URL rewriting, and object transformation code as ordinary
  TypeScript. Effect should own side effects, failure channels, concurrency, and
  resource lifetime rather than wrap every function indiscriminately.
- Preserve `Interceptor.handleRequest(request): Promise<void>` as a compatibility
  adapter. Add an internal Effect-native handler first; do not require existing
  Puppeteer consumers to run Effects or provide Layers.
- Keep the CLI parser replacement late and isolated. First move config loading
  and execution behind an Effect program while Commander is still present, then
  replace Commander after CLI contract tests pass.
- Do **not** add `@effect/cli`. Effect v4 moved those APIs into
  `effect/unstable/cli`. Add exact-pinned
  `@effect/platform-node-shared@4.0.0-beta.97` and compose only the Node runtime
  and services Sahne needs, then remove Commander after parity is established.

## Why Migrate

The current implementation has useful Effect boundaries rather than merely an
opportunity to change syntax:

- Puppeteer, file, fetch, hook, and dynamic-import failures are represented by
  a mix of thrown errors, swallowed errors, logs, and optional `error` fields.
- Browser and listener lifetime is unmanaged. Async Puppeteer event callbacks
  are started without observing their failures.
- Request rules must remain sequential for one request, while separate browser
  requests should run concurrently. That concurrency policy is currently
  implicit.
- The CLI owns a long-running browser but has no structured interruption or
  cleanup path.
- The public types describe several hooks as synchronous even though the
  implementation awaits them and the fixtures use async functions.

Effect can make those policies explicit through typed errors, scoped resources,
tracked fibers, Layers, and one runtime boundary.

## Current Baseline

### Maintained surfaces

| Surface                             | Current contract                                                          | Migration implication                                       |
| ----------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `packages/sahne/src/index.ts`       | Exports `Interceptor`, `defineConfig`, and config types                   | Preserve these exports during the migration                 |
| `packages/sahne/src/run.ts`         | Promise-based interception and browser runner                             | Split request orchestration from browser ownership          |
| `packages/sahne/src/Request.ts`     | Wraps Puppeteer actions and swallows action failures after logging        | Convert actions to typed leaf Effects                       |
| `packages/sahne/src/utils/index.ts` | Mixes pure transforms, hooks, file I/O, fetch, logging, and orchestration | Split by responsibility before or while converting          |
| `packages/sahne/src/cli.ts`         | Commander, one `--file` option, dynamic TS config import                  | Preserve behavior with black-box tests, then use Effect CLI |
| `tests/sahne-app/`                  | Browser integration and direct `Interceptor` API fixture                  | Keep testing the Promise-facing boundary                    |
| `playground/vite-8-react-ts-app/`   | Real Vite 8 package and bin consumer                                      | Keep as a compatibility and packaging smoke test            |

`effect` is already a runtime dependency at the required exact version, but no
maintained source file imports it yet.

### Baseline checks on 2026-07-10

- `npm run build:sahne-js`: passes.
- `npm run lint`: passes.
- `npm run typecheck --workspace sahne-js`: passes.
- `npm run typecheck --prefix tests`: passes when run after the library build.
  It can fail if run concurrently with `npm run build:sahne-js`, because the
  library's `prebuild` removes `dist` before recreating its declarations. The
  final verification script must sequence these checks.
- The root `test` script intentionally fails and does not delegate to the
  integration suite under `tests/`.
- Fixture and playground lockfiles still snapshot Sahne with Commander but
  without Effect. Root hoisting can therefore hide missing published runtime
  dependencies.

### Current CLI behavior to characterize

The built CLI currently has these observable behaviors:

| Invocation                     | Current result                                       |
| ------------------------------ | ---------------------------------------------------- |
| `sahne --help`                 | Commander-style help; exit 0                         |
| `sahne --version`              | Prints `2.0.0`; exit 0                               |
| `sahne -V`                     | Prints `2.0.0`; exit 0                               |
| `sahne` with no default config | Prints `Could not find a sahne.config file.`; exit 0 |
| Unknown option                 | Prints an error; exit 1                              |

The missing-config success exit is treated as a correctness issue, not a
compatibility requirement. The target behavior is a concise error on stderr and
exit 1.

## Scope

### In scope

- Typed failure channels for config loading, hooks, request actions, file reads,
  proxy requests, response decoding, browser launch, and page setup.
- Effect-based interception orchestration with explicit outcomes.
- Scoped Puppeteer browser ownership for the CLI runner.
- Tracked request and target-created fibers with listener cleanup.
- Effect logging with structured request metadata.
- An Effect-based CLI entrypoint and Node runtime.
- Unit, contract, integration, lifecycle, and packed-package verification.
- Public type corrections that widen existing hooks to accept async results.

### Out of scope

- Converting pure helpers to Effect solely for stylistic consistency.
- Converting the React playground or Express fixture server to Effect.
- Replacing Puppeteer.
- Requiring Effect values in `SahneConfig` callbacks in this migration.
- Replacing native fetch with `effect/unstable/http`. The public API currently
  exposes Web `RequestInit` and the raw Web `Response`; changing transports would
  be a separate public-contract decision.
- Making every config field Schema-decodable. Config modules contain functions,
  regular expressions, and Puppeteer objects, so targeted runtime validation is
  more appropriate than forcing the full object through Schema.

## Compatibility Contract

### Public API

Keep these source-compatible through the migration:

- `new Interceptor(config | configs)`.
- `Interceptor.handleRequest(request): Promise<void>`.
- `defineConfig(config)` and the existing `SahneConfig` / `InterceptorConfig`
  object shapes.
- `Match` values as string, `RegExp`, or predicate.
- Web `RequestInit`, Web `Response`, and Puppeteer request/response types exposed
  to callbacks.
- Direct `Interceptor` users retain ownership of their browser and page. The
  interceptor must never close caller-owned Puppeteer resources.

Widen callback result types to match existing runtime behavior:

```ts
type MaybePromise<A> = A | PromiseLike<A>;
```

- Hooks return `MaybePromise<void>`.
- conditional hooks return `MaybePromise<boolean>`.
- `onError` returns `MaybePromise<void | ResponseForRequest>`.
- action methods accurately expose `void | Promise<void>` as appropriate.

Do not require callbacks to return `Effect`. An Effect-native public API can be
added later as an additive feature after the internal model is stable.

### Interception behavior

Lock down these semantics before refactoring:

- Configs are evaluated sequentially for each request.
- Different browser requests may be processed concurrently.
- Within a rule, request actions retain the current precedence:
  `ignore`, `abort`, `next`, `match`, then `onRequest`.
- `ignore` resolves the Puppeteer request and stops rule evaluation.
- `abort` resolves the Puppeteer request and stops rule evaluation.
- `next` skips the current rule but permits later rules.
- An unmatched rule permits later rules.
- Response actions remain ordered as `ignoreOnResponse`, `abortOnResponse`,
  `nextOnResponse`, `onResponse`, then the default response.
- Exactly one Puppeteer resolution action may win.
- If all rules leave a request unresolved, continue it once.

Represent orchestration results with a discriminated outcome such as
`NextRule`, `Resolved`, and `Unmatched`; do not continue using optional booleans
and `{ response?: ..., error?: ... }` result bags.

### Failure policy

- Expected external failures use tagged error channels. Invalid internal states
  remain defects.
- A rule-processing failure invokes `onError` at most once.
- If `onError` returns a response, send that response.
- If `onError` resolves the request through an action, do not resolve it again.
- If `onError` does neither, allow later rules or the final default continue
  policy to run.
- Config, browser launch, and initial page setup failures fail the CLI with a
  nonzero exit code.
- Request-scoped failures are logged with context and recovered according to the
  policy above rather than becoming unobserved Promise rejections.

## Target Design

### Pure domain code

Keep the following as ordinary synchronous functions:

- glob compilation and URL matching;
- proxy URL construction and URL/path rewrites;
- request/response override merging;
- rule preprocessing that cannot perform I/O.

Wrap calls to user-provided predicates, rewrites, and overrides at their call
site with `Effect.try` so a thrown user error enters a named failure channel.

### Tagged errors

Introduce a small application error model, using the pinned v4 tagged-error
APIs and preserving opaque foreign causes. Expected categories are:

- `ConfigLoadError` and `ConfigValidationError`;
- `BrowserLaunchError` and `PageSetupError`;
- `RequestActionError` for Puppeteer `continue`, `abort`, and `respond`;
- `ProxyRequestError` and `ProxyResponseError`;
- `FileReadError`;
- `HookError` carrying the hook name.

Avoid a single generic wrapper error. Keep request URL, proxy URL, file path,
action, and hook name as structured fields where relevant so recovery and logs
do not parse strings.

### I/O services and Layers

Use services only where substitution or lifetime management has concrete value:

- Use Effect's `FileSystem` service and the Node file-system Layer for mock-file
  reads.
- Add a small Sahne-owned proxy transport service that wraps native fetch with
  `Effect.tryPromise`. This preserves the raw Web `Response` contract and gives
  unit tests a fake transport.
- Add a small Puppeteer launcher service for the CLI-owned browser. Direct
  `Interceptor` use still receives caller-owned `HTTPRequest` values and does
  not require this service.
- Use the standard Effect logger rather than a custom logger service.

The live Node Layer should compose these services in one place. Tests provide
small deterministic Layers rather than launching browsers or performing network
requests for every unit case.

For native fetch, compose the `AbortSignal` supplied to `Effect.tryPromise` with
any signal returned by `overrideRequestOptions` using `AbortSignal.any` (available
under the Node 22 runtime contract). Do not overwrite the consumer signal or
discard Effect interruption. Test cancellation from each signal independently
and when both are present.

### Request pipeline

Split `utils/index.ts` into cohesive modules as code is migrated. The exact
filenames can follow the existing style, but the responsibilities should be:

- pure matching and transformation;
- request action adapters;
- hook adapters;
- file response loading;
- proxy transport and response conversion;
- interception orchestration.

Create an internal function equivalent to:

```ts
handleRequestEffect(
  request: HTTPRequest
): Effect.Effect<void, InterceptionError, InterceptionServices>
```

The public class provides the live services and runs that Effect at the
Promise/Puppeteer boundary. Keep the Effect program available internally so the
CLI runner and unit tests do not immediately convert back to Promise.

### Browser lifecycle and event interop

The CLI runner owns the browser as a scoped resource:

1. Run `beforeLaunch`.
2. Acquire Puppeteer with `Effect.acquireRelease`.
3. Run `afterLaunch` before configuring pages, matching the current callback
   order.
4. Register browser and page listeners with matching finalizers that remove
   them.
5. Create a scoped `FiberSet`, derive the callback runner with
   `FiberSet.runtime`, and run Effects started by Puppeteer event callbacks in
   that set.
6. Race the browser-disconnected wait with `FiberSet.join`, or catch and report
   each callback Effect before forking it. Merely adding fibers to the set is not
   enough: in the pinned implementation, failures are observed only when the
   set is joined.
7. Configure the initial page, run `beforeGoto`, navigate, then run `afterGoto`.
8. Keep the main Effect alive until the browser disconnects, a tracked callback
   fails unexpectedly, or the runtime is interrupted.
9. On completion, failure, SIGINT, or SIGTERM, remove listeners, interrupt child
   fibers, and close the browser.

Requests remain concurrent across pages. The rules within each request remain
sequential.

Do not use `process.exit()` inside application or fixture callbacks because it
bypasses scope finalizers. Let `NodeRuntime.runMain` set process status and
complete teardown.

### Logging and observability

Replace direct logger calls with `Effect.logDebug`, `Effect.logInfo`, and
`Effect.logError`. Annotate request-scoped logs with stable fields such as:

- request URL and method;
- matched rule or action;
- proxy URL or file path;
- error tag.

Keep human-readable CLI errors concise. Do not print both an ad hoc stack trace
and the runtime's rendered Cause for the same failure.

## CLI Decision

### Do not install `@effect/cli`

The pinned v4 source maps the former v3 package to the core unstable modules:

- `@effect/cli/Command` -> `effect/unstable/cli/Command`;
- `@effect/cli/Options` -> `effect/unstable/cli/Flag`;
- `@effect/cli/Args` -> `effect/unstable/cli/Argument`.

There is no `@effect/cli` package in the pinned v4 checkout. Installing the old
standalone package would mix v3-era package organization with the v4 runtime and
would conflict with the repository's exact-version policy.

Use:

```ts
import * as NodeChildProcessSpawner from '@effect/platform-node-shared/NodeChildProcessSpawner';
import * as NodeFileSystem from '@effect/platform-node-shared/NodeFileSystem';
import * as NodePath from '@effect/platform-node-shared/NodePath';
import * as NodeRuntime from '@effect/platform-node-shared/NodeRuntime';
import * as NodeStdio from '@effect/platform-node-shared/NodeStdio';
import * as NodeTerminal from '@effect/platform-node-shared/NodeTerminal';
import { Effect, Layer } from 'effect';
import { CliOutput, Command, Flag } from 'effect/unstable/cli';

const NodeCliServices = Layer.provideMerge(
  NodeChildProcessSpawner.layer,
  Layer.mergeAll(NodeFileSystem.layer, NodePath.layer, NodeStdio.layer, NodeTerminal.layer)
);
```

Build the `--file` / `-f` option with `Flag`, run the command with
`Command.run`, provide `NodeCliServices`, and terminate through
`NodeRuntime.runMain`.

The pinned full `@effect/platform-node` package follows the official CLI guide,
but it also declares an unrelated, non-optional `ioredis` peer and includes HTTP
dependencies Sahne does not need. The narrower published
`@effect/platform-node-shared` package provides every service in
`Command.Environment` plus `NodeRuntime` without that Redis peer. Keep this
choice behind the single `NodeCliServices` composition above and re-evaluate it
on each pinned Effect upgrade.

### Why replace Commander at all

Replacement is worthwhile by the end of the migration because the current CLI
has only one option and one handler. The Effect CLI handler can directly compose
typed config loading, browser acquisition, interruption, and error reporting.
`Command.runWith` also enables parser tests without mutating `process.argv`.

The module is explicitly `unstable` and Effect v4 is beta. Keep all CLI imports
inside the entrypoint area, do not re-export them, and protect behavior with
black-box tests before every Effect version upgrade.

### CLI compatibility decisions

Effect CLI's built-ins do not exactly match Commander. The migration must test
and document these changes deliberately:

- Preserve `--file` and `-f` and the no-argument fallback to
  `sahne.config.ts`.
- Preserve `--version`; retain `-V` as a compatibility alias even though Effect
  CLI uses `-v` for its built-in version flag.
- Preserve the current machine-readable version output (`2.0.0`) by providing a
  small `CliOutput.Formatter` override for `formatVersion`; do not silently
  adopt Effect's default `sahne v2.0.0` output.
- Accept Effect's additive `--completions` and `--log-level` built-ins unless
  they conflict with a later Sahne option.
- Change missing or invalid config from exit 0 to exit 1.
- Test invalid options, config import failures, runtime failures, and SIGINT.

`Flag.file` may validate a provided path, but it does not load a TypeScript
module or validate `SahneConfig`; keep that work in the config-loading Effect.

### CLI error rendering

Use one top-level rendering policy. In the pinned implementation,
`Command.run` renders a `CliError.ShowHelp` and then re-fails it. A default
`NodeRuntime.runMain` would render the resulting Cause again.

- Let `Command.run` render help and parser errors.
- Render tagged Sahne domain failures once with concise messages.
- Render unexpected defects once with enough Cause detail to diagnose them.
- Re-fail after rendering so the runtime still selects a nonzero status.
- Call `NodeRuntime.runMain({ disableErrorReporting: true })` so the runtime does
  not duplicate output.

Test unknown options and domain failures at the subprocess level to prove that
each error appears once and still exits 1.

## Dependency Plan

| Package                        | Action                                                             | Reason                                                                 |
| ------------------------------ | ------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `effect`                       | Keep exact `4.0.0-beta.97` runtime dependency                      | Core Effect, logging, errors, FiberSet, and CLI modules                |
| `@effect/platform-node-shared` | Add exact `4.0.0-beta.97` runtime dependency                       | Narrow Node runtime and CLI/file-system Layers without the Redis peer  |
| `@effect/platform-node`        | Do not add at this pin                                             | Pulls an unused non-optional `ioredis` peer and broader HTTP footprint |
| `@effect/vitest`               | Add exact `4.0.0-beta.97` development dependency                   | Effect-aware unit and Layer tests                                      |
| `vitest`                       | Add/use a compatible v4 development version for library unit tests | Test runner for `@effect/vitest`                                       |
| `commander`                    | Keep temporarily, remove after the CLI contract phase              | Isolate runtime migration from parser migration                        |
| `puppeteer`                    | Keep as peer dependency and development dependency                 | Existing public/runtime contract                                       |
| `@effect/cli`                  | Do not add                                                         | v4 API lives in `effect/unstable/cli`                                  |

Every `@effect/*` package must use the exact version in
`docs/effect-source.md`. Do not use ranges for the Effect family. Update the
package dependency, source checkout/tag, and reference document together on a
future beta upgrade.

## Migration Phases

### Phase 0: Characterization and reliable gates

Deliverables:

- Add focused tests for rule ordering, no-match, `next`, ignore, abort, default
  continue, response actions, overrides, file failure, proxy failure, hook
  failure, and `onError` recovery.
- Add black-box CLI tests for help, version aliases, default config, custom
  config, missing/invalid config, unknown flags, exit status, and stdout/stderr.
- Stabilize the browser fixture so it waits for all expected results rather than
  one request before reading every selector.
- Capture failures from the Promise returned by
  `Interceptor.handleRequest` in the Puppeteer listener so a defect fails the
  test instead of hanging until timeout.
- Remove `process.exit()` from the CLI fixture, explicitly close its browser in
  the callback, and let the process terminate naturally.
- Make the test fixture's clean install and library-build prerequisites
  explicit, and add sequential root scripts that delegate to maintained checks.
- Add a clean packed-artifact smoke test that installs the generated tarball in
  a temporary consumer and checks import, types, and the `sahne` bin.

Exit gate: the current intended behavior is deterministic, failures are visible,
and all known deviations are documented as bugs rather than accidentally frozen.

### Phase 1: Effect foundation

Deliverables:

- Add the exact-pinned Node shared-platform and test dependencies.
- Add `MaybePromise` corrections to public hook/action types.
- Introduce tagged error types and structured Effect logging.
- Define the minimal file, proxy, and Puppeteer live/test Layers.
- Keep public exports and runtime behavior unchanged.

Exit gate: unit tests can execute leaf Effects with fake services, and package
build/typecheck still emits the existing public entrypoint.

### Phase 2: Convert leaf side effects

Deliverables:

- Convert Puppeteer request actions to `Effect.tryPromise` and stop swallowing
  their failures.
- Convert user hook/predicate/override invocation to named Effect adapters.
- Replace blocking `readFileSync` with the Effect `FileSystem` service.
- Wrap native fetch and response-body reads in interruptible, typed Effects and
  test composition with a consumer-provided abort signal.
- Leave pure matching and transformation helpers synchronous.

Exit gate: file, proxy, hook, and request-action success/failure cases pass using
test Layers without a real browser or network.

### Phase 3: Convert interception orchestration

Deliverables:

- Replace optional response/error bags and ambiguous booleans with tagged errors
  and discriminated outcomes.
- Compose request and response phases as Effect programs.
- Preserve sequential rule evaluation and one-resolution semantics.
- Implement the `onError` policy once at the orchestration boundary.
- Add internal `handleRequestEffect` and keep the public Promise adapter.
- Fix the known correctness defects listed below with regression tests.

Exit gate: Effect unit tests and the direct `Interceptor` browser integration
suite both pass with the same configuration files.

### Phase 4: Scope browser and listener lifetime

Deliverables:

- Model CLI-owned Puppeteer launch/close with `Effect.acquireRelease`.
- Register and remove `targetcreated`, `request`, and `disconnected` listeners in
  scope.
- Track callback-launched Effects with a scoped FiberSet and surface unexpected
  failures by joining the set (or by catching and reporting each callback
  Effect).
- Keep the main scope alive until browser disconnect, an unexpected tracked
  failure, or interruption.
- Verify callback ordering and cleanup on success, setup failure, navigation
  failure, `afterLaunch` failure, browser disconnect, and direct Effect
  interruption. End-to-end SIGINT/SIGTERM behavior is verified after the Node
  entrypoint is wired in the next phase.

Exit gate: no unobserved event-handler rejection, orphan browser process, or
listener remains after the program completes.

### Phase 5: Migrate the CLI

Deliverables:

- First retain Commander only for argument parsing, then run the completed
  program once through `NodeRuntime.runMain`. Run CLI and signal contract tests
  to isolate runtime changes from parsing changes.
- Replace Commander with `Command` and `Flag` from `effect/unstable/cli`.
- Provide `NodeCliServices` and run with
  `NodeRuntime.runMain({ disableErrorReporting: true })` behind the single error
  renderer.
- Meet the version and help compatibility decisions listed in the CLI section.
- Remove `commander` only after the packaged-bin tests pass.

Exit gate: source execution and the packed `dist/cli.js` artifact pass the CLI
contract suite, including interruption and exit status.

### Phase 6: Consumer and release hardening

Deliverables:

- Refresh the root, test fixture, and playground install boundaries and
  lockfiles after dependency changes. Avoid redundant nested lockfiles inside
  the `tests` workspace.
- Build and typecheck the maintained playground without changing its consumer
  API.
- Run the two-server browser integration against the packed package, not only a
  source-linked or hoisted install.
- Update README error/lifecycle behavior and CLI output examples.
- Record the exact Effect version and upgrade procedure in release notes.

Exit gate: a clean consumer can install the packed artifact, import the public
API, run the CLI, proxy a request, read a file response, and shut down cleanly.

## Known Correctness Defects To Fix

These should receive regression tests and intentional fixes rather than being
preserved as baseline behavior:

| Location                   | Defect                                                                        | Target behavior                                            |
| -------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `run.ts` error branch      | A response returned by `onError` causes an immediate return and is never sent | Send the returned response exactly once                    |
| `run.ts` error branch      | Checks the `isRequestHandled` method object instead of calling it             | Evaluate handled state and apply fallback correctly        |
| `run.ts` event listeners   | Async request and target-created failures are discarded                       | Track fibers and report/recover failures                   |
| `Request.ts` actions       | Puppeteer action errors are logged and swallowed                              | Use typed failures and prevent a second resolution attempt |
| `utils/index.ts` file path | `readFileSync` blocks inside an async function                                | Use Effect `FileSystem.readFile`                           |
| `cli.ts` config loading    | Missing/import-failing config returns normally                                | Print a concise error and exit 1                           |
| `types.ts` hooks/actions   | Types say synchronous while implementation supports async                     | Widen to `MaybePromise` and accurate action returns        |

## Test Strategy

| Level               | Coverage                                                                  | Tooling                                       |
| ------------------- | ------------------------------------------------------------------------- | --------------------------------------------- |
| Pure unit           | glob, URL match, rewrite, override merge                                  | Vitest                                        |
| Effect unit         | typed failures, outcomes, recovery, fake file/proxy/launcher Layers       | `@effect/vitest`                              |
| Public adapter      | `Interceptor.handleRequest(): Promise<void>` and caller browser ownership | Vitest with Puppeteer fakes/fixture           |
| CLI command         | explicit argv, help/version/options/config failures                       | `Command.runWith` plus test platform services |
| CLI process         | exit code, stderr/stdout, SIGINT/SIGTERM, packaged shebang                | Node child process against built artifact     |
| Browser integration | ordered rules, proxy, file, overrides, redirects, multiple pages          | Existing `tests/sahne-app` fixture            |
| Package smoke       | clean install, import, declarations, peer/runtime dependencies, bin       | `npm pack` temporary consumer                 |
| Playground          | clean Vite 8 consumer config and bin resolution                           | playground typecheck/build/smoke              |

Add a root `verify` script as the final local/CI gate. It should delegate to
commands equivalent to:

```sh
npm run lint
npm run typecheck --workspace sahne-js
npm run build:sahne-js
npm run test:unit --workspace sahne-js
npm run typecheck --prefix tests
npm test --prefix tests
npm run build --prefix playground/vite-8-react-ts-app
npm run test:pack
```

The exact script names may be introduced incrementally, but the final gate must
cover all listed concerns in this order rather than relying on the current
intentionally failing root `test` placeholder or running the fixture typecheck
while `dist` is being rebuilt.

## Risks and Mitigations

| Risk                                      | Mitigation                                                                                   |
| ----------------------------------------- | -------------------------------------------------------------------------------------------- |
| Effect v4 beta and unstable CLI API churn | Exact pins, small CLI adapter, pinned-source references, contract tests on every upgrade     |
| Accidental public Effect requirements     | Keep Promise/config adapters and inspect emitted declarations in the pack smoke              |
| Changed sequential rule semantics         | Characterization tests and discriminated outcomes; never parallelize configs for one request |
| Unobserved Puppeteer callback failures    | FiberSet tracking plus `FiberSet.join` and explicit request-level recovery                   |
| Browser closes immediately after `goto`   | Await browser disconnect inside the scoped main program                                      |
| Finalizers bypassed                       | Remove direct `process.exit`, run through `NodeRuntime.runMain`                              |
| Native HTTP response contract breaks      | Keep native fetch transport for this migration                                               |
| Consumer abort signal is overwritten      | Compose it with Effect interruption via `AbortSignal.any` and test both sources              |
| Duplicate CLI error output                | One renderer plus `disableErrorReporting: true` at `runMain`                                 |
| Unrelated Node platform dependencies      | Use narrow shared-platform imports and verify the packed dependency tree                     |
| Dependency/hoisting defects               | Exact runtime dependencies, refreshed locks, clean packed install                            |
| Over-engineering a small library          | Keep pure functions pure and add services only for external I/O or owned resources           |

## Definition of Done

- Maintained asynchronous side effects are created and composed as Effects;
  Promise use remains only at deliberate Puppeteer/public compatibility edges.
- Expected failures are typed, logged once with context, and recovered or
  surfaced by an explicit policy.
- One request evaluates rules sequentially; separate requests remain concurrent.
- CLI-owned browser, listeners, and callback fibers are scoped and cleaned up on
  success, failure, disconnect, and interruption.
- Existing `defineConfig` and direct `Interceptor` consumers compile without
  adopting Effect in their application code.
- Commander is removed and the CLI uses `effect/unstable/cli`.
- `@effect/cli` and `@effect/platform-node` are absent; `effect`,
  `@effect/platform-node-shared`, and `@effect/vitest` match the exact pinned v4
  beta where applicable.
- Library unit tests, CLI contracts, browser integration, packed-package smoke,
  and playground verification all pass from clean install boundaries.

## Pinned References

- Repository contract: `docs/effect-source.md`.
- Core Effect guidance: `.repos/effect/LLMS.md` and
  `.repos/effect/ai-docs/src/`.
- CLI guide: `.repos/effect/ai-docs/src/70_cli/10_basics.ts`.
- v3-to-v4 CLI import map: `.repos/effect/migration/v3-to-v4.md`.
- CLI implementation/tests: `.repos/effect/packages/effect/src/unstable/cli/`
  and `.repos/effect/packages/effect/test/unstable/cli/`.
- Node runtime/services:
  `.repos/effect/packages/platform-node-shared/src/NodeRuntime.ts` plus its
  `NodeFileSystem.ts`, `NodePath.ts`, `NodeStdio.ts`, `NodeTerminal.ts`, and
  `NodeChildProcessSpawner.ts` modules.
- Full Node package dependency comparison:
  `.repos/effect/packages/platform-node/package.json`.
- Resource and integration examples:
  `.repos/effect/ai-docs/src/01_effect/05_resources/` and
  `.repos/effect/ai-docs/src/04_integration/`.
