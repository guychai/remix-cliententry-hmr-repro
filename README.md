# Remix 3.0.0 clientEntry HMR reproduction

## Result

Reproduced stale **server-side hydration metadata** when adding or removing `clientEntry` under the fresh official CLI app's HMR mode. Browser click testing was not completed: the cloud browser returned `net::ERR_BLOCKED_BY_CLIENT` for the local development URL. The findings below are from new HTTP requests, independent of an existing browser document or browser module cache.

- Node: 24.19.0; npm: 11.9.0
- App generated with: `npx --yes remix@3.0.0 new app`
- Installed: remix 3.0.0, @remix-run/component 1.0.0, @remix-run/component-hmr 1.0.0, @remix-run/node-hmr 1.0.0, @remix-run/assets 1.0.0
- Date: 2026-10-03
- `app/package-lock.json` captures the resolved dependency tree
- Original CLI configuration, HMR runner, server, asset pipeline, document and browser runtime entry retained
- Starter home page replaced by a Document containing only a heading and the Counter
- `evidence/counter.wrapped.tsx` is the supplied Counter verbatim; `counter.plain.tsx` is its unwrapped equivalent

## Reproduce automatically

Requires Node >=24.3.0.

```sh
cd app
npm ci
cd ..
node test-http-hmr.mjs
node test-dev-watch.mjs
```

The first harness starts the generated `hmr.ts`, requests a fresh document after each edit, saves the HTML under `evidence`, and restarts the HMR process for comparison. It also changes visible button labels to prove that ordinary component implementation updates are applied while hydration metadata remains stale. It deliberately asserts the observed buggy behavior, so an upstream fix should make it fail.

The second harness runs the generated dev script's underlying command (`NODE_ENV=development node --watch --import remix/node-tsx server.ts`) and verifies automatic restarts correctly update hydration metadata in both directions. Test ports are 45200 and 45300 respectively. Processes are stopped on completion.

## Fresh-response observations

| Step | Source | Process | Hydration markers | Counter hydration JSON |
|---|---|---|---:|---|
| 1 | Plain Counter | Cold HMR start | 0 | Absent |
| 2 | Add clientEntry | Same process after HMR update | 0 | Absent |
| 3 | Same wrapped source | Another fresh request | 0 | Absent |
| 4 | Same wrapped source | Restart HMR | 1 | Present |
| 5 | Remove clientEntry | Same process after HMR update | 1 | Present |
| 6 | Same plain source | Another fresh request | 1 | Present |
| 7 | Same plain source | Restart HMR | 0 | Absent |

A server-rendered `<!-- rmx:h:... -->` boundary and an application/json hydration record are expected for the wrapped Counter. They must be absent for the unwrapped Counter. Restarting fixes both directions. Ordinary label edits update under HMR, excluding a failure to detect or evaluate the source change.

## Manual browser steps

```sh
cd app
npm run hmr
```

1. Open http://localhost:44100. Counter begins plain; clicks should not update it
2. Copy `../evidence/counter.wrapped.tsx` over `app/actions/public/counter.tsx`
3. Reload without restarting: server still omits Counter hydration metadata
4. Stop/restart `npm run hmr`, then reload: metadata is present
5. Copy `../evidence/counter.plain.tsx` over `app/actions/public/counter.tsx`
6. Reload without restarting: server still emits Counter hydration metadata
7. Stop/restart HMR and reload: metadata is absent

Only the HTTP/server side of those steps is verified in this environment; the expected click behavior is not presented as a browser-test result.

## Likely cause in installed source

The component server HMR transform keeps imported component wrappers stable and redirects calls through `getCurrentComponentForHmr`. Its registry updates only implementations. `clientEntry` stores `$entry` and `$entryId` on a wrapper, and the renderer checks that wrapper metadata. The HMR export compatibility check skips component export value comparisons and does not compare hydration metadata. Existing importer references can therefore retain their original entry status while rendering the newest implementation.

Installed source locations:

- `node_modules/@remix-run/component-hmr/src/lib/transform.ts`: lines 253-389 (server transform), 577-651 (accept/export checks)
- `node_modules/@remix-run/component-hmr/src/lib/server-runtime.ts`: lines 1-25 (implementation-only registry)
- `node_modules/@remix-run/component/src/runtime/client-entries.ts`: `clientEntry` and `isEntry`
- `node_modules/@remix-run/component/src/server/stream.ts`: lines 527-537 (entry classification before component invocation)

## Verified workaround

Restart HMR and reload after adding/removing `clientEntry`. Alternatively use `npm run dev`: its Node watch-mode restarts correctly produce 0 → 1 → 0 hydration markers as the wrapper is added and removed. `npm run dev` does not provide in-place browser HMR.

## Other verification

- `npm run typecheck`: passed
- `npm test`: passed, 1 server test
- `npm exec remix doctor`: passed, 0 warnings, 0 advice
- No source framework patch or publication performed
