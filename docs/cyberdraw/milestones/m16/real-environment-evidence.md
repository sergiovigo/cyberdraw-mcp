# M16.3 Real-Environment Compatibility Evidence

Status: FINAL evidence record for M16.3.

M16.3 records real-environment compatibility evidence for the existing
Architecture Intelligence runtime path. It does not close M16, add MCP tools,
change public contracts, add mutation execution, persistence, semantic diff,
rollback or stable global identity.

## Environment Classification

Classification: REAL LOCAL HTTP.

The server real-environment harness uses:

- real Chromium through Playwright;
- draw.io served by the repository HTTP editor server;
- the real browser plugin loaded into the page;
- the real server WebSocket runtime path between plugin and server;
- the real `cyberdraw.runtimeSnapshot.v1` snapshot request path;
- the real hierarchical executor and graph-model analysis path;
- an MCP `InMemoryTransport` client connected to the server app for tool calls.

The `InMemoryTransport` MCP client is only the local client transport used by the
test harness. It does not replace draw.io, the browser plugin, runtime snapshot
extraction or the server runtime path.

This is NOT HTTPS/Caddy evidence.

## Existing Real-Environment Tests

| Case | Test file | Test name | Real browser | Real draw.io | Real plugin | Real server path | In-memory MCP | Result classification | Coverage strength |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Visible/background runtime snapshot | `packages/drawio-mcp-server/src/real-environment/runtime-snapshot.test.ts` | `extracts visible and background pages without changing public tools or editor state` | yes | yes | yes | yes | no direct MCP tool; uses server context | real proven | Strong for current runtime snapshot success, visible/background pages, current revision and truncation |
| M13 default public scope | `packages/drawio-mcp-server/src/real-environment/hierarchical-snapshot.test.ts` | `resolves public M13 default scope through MCP without document snapshots` | yes | yes | yes | yes | yes | real proven | Strong for public M13 read-only default safe scope and no document snapshot broadening |
| Visible page, layer and selection scopes | `packages/drawio-mcp-server/src/real-environment/hierarchical-snapshot.test.ts` | `executes visible-page, explicit-layer and selection plans while preserving UI` | yes | yes | yes | yes | no direct MCP tool; uses server context | real proven | Strong for scoped runtime execution and UI preservation |
| Background page and stale plan | `packages/drawio-mcp-server/src/real-environment/hierarchical-snapshot.test.ts` | `covers background page, explicit page target, empty selection, hard-limit avoidance and stale plan` | yes | yes | yes | yes | no direct MCP tool; uses server context | real proven | Strong for background page, explicit pages, hard-limit avoidance and stale inventory classification |
| External-reference expansion | `packages/drawio-mcp-server/src/real-environment/hierarchical-snapshot.test.ts` | `executes real external-reference expansion into a second layer snapshot` | yes | yes | yes | yes | no direct MCP tool; uses server context | real proven | Strong for real layer expansion without document-scope fallback |
| Structural analysis over runtime | `packages/drawio-mcp-server/src/real-environment/hierarchical-snapshot.test.ts` | `executes real internal structural analysis with expansion, broken reference and orphan finding` | yes | yes | yes | yes | no direct MCP tool; uses server context | real proven | Strong for M9 analysis path and expansion-derived graph evidence |
| Public M14 contract | `packages/drawio-mcp-server/src/real-environment/cyberdraw-public-m14.test.ts` | `validates M14 scopes, aggregate queries, rejections and sanitization through MCP` | yes | yes | yes | yes | yes | real proven | Strong for M14 page/layer/mixed scopes, count, summarize, read-only safety and public negative rejections |

## M16 Matrix Classification

| Matrix case | M16.3 real-environment classification | Evidence |
| --- | --- | --- |
| 1. Plugin/server compatible versions | already proven in real environment for current bundled plugin/server | Harness startup and successful runtime snapshot calls in `runtime-snapshot.test.ts` and `hierarchical-snapshot.test.ts` |
| 2. Older compatible peer | proven only in unit/integration | `cyberdraw-runtime-contract/src/index.test.ts` covers document-only compatibility for missing scopes; no old browser/plugin peer is launched by the harness |
| 3. Missing capability | proven only in unit/integration | `cyberdraw-runtime-snapshot.test.ts` fail-closed unit coverage; the real harness always advertises the current capability |
| 4. Unsupported version | proven only in unit/integration for runtime capability; broad draw.io runtime fleet still unproven | `cyberdraw-runtime-snapshot.test.ts` and plugin draw.io-compat tests; no multi-version real draw.io lab exists |
| 5. Stale revision | already proven in real environment for stale inventory after live edit | `hierarchical-snapshot.test.ts` / `covers background page, explicit page target, empty selection, hard-limit avoidance and stale plan` |
| 6. Valid current revision | already proven in real environment | `runtime-snapshot.test.ts` compares repeated content revisions for equivalent snapshots |
| 7. Document scope | partially proven in real environment; public document-scope execution remains out of scope | Internal runtime document snapshot is used in `runtime-snapshot.test.ts`; public M14 document scope is rejected in `cyberdraw-public-m14.test.ts` |
| 8. Pages scope | already proven in real environment | `hierarchical-snapshot.test.ts` explicit background page target and M14 `pageIds` count/summarize |
| 9. Layers scope | already proven in real environment | `hierarchical-snapshot.test.ts` explicit layer target and M14 `layerTargets` count |
| 10. Selection scope | already proven in real environment | `hierarchical-snapshot.test.ts` visible selection and empty selection behavior |
| 11. Visible page | already proven in real environment | `runtime-snapshot.test.ts` and `hierarchical-snapshot.test.ts` |
| 12. Background page | already proven in real environment | `runtime-snapshot.test.ts` and `hierarchical-snapshot.test.ts` |
| 13. External references | already proven in real environment | `hierarchical-snapshot.test.ts` external-reference expansion into a second layer snapshot |
| 14. Malformed payload | proven only in unit/integration | Malformed plugin replies are injected in `cyberdraw-runtime-snapshot.test.ts`; current real harness has no safe way to make the real plugin emit malformed successful runtime payloads |
| 15. Oversize payload | partially proven in real environment and unit/integration | Real truncation/hard-limit behavior appears in `runtime-snapshot.test.ts` and `hierarchical-snapshot.test.ts`; malicious oversize reply injection remains unit-level |
| 16. Timeout | proven only in unit/integration | `cyberdraw-runtime-snapshot.test.ts` covers timeout/listener behavior; current real harness does not deliberately stall the real plugin |
| 17. Transport/plugin error | public negative paths proven in real environment; raw plugin error sanitization proven in unit/integration | M14 public rejections are real in `cyberdraw-public-m14.test.ts`; raw plugin `success:false` injection remains unit-level |
| 18. Real browser/draw.io runtime | already proven in real environment | Full server `test:real-environment` suite runs REAL LOCAL HTTP |

## Negative Paths

Real-environment negative paths demonstrated through the public
`cyberdraw_analyze_structure` wrapper:

- `scope.document` is rejected with `document-scope-not-supported`;
- missing page is rejected with `page-not-found`;
- wrong-page layer is rejected with `layer-not-found`;
- redundant mixed scope is rejected with `duplicate-scope-target`;
- empty scope is rejected with `empty-scope`;
- scope above configured breadth is rejected with `scope-too-broad`.

The same real test verifies:

- `safety.readOnly` remains `true`;
- `mutationAttempted` remains `false`;
- `mutationInvocations` remains `0`;
- `executedScope.document` remains `false`;
- the response does not contain fixture labels, `<mxGraphModel`, `snapshot`,
  `graph` or `stopReason`.

Malformed runtime payloads, oversize malicious replies, timeouts and raw plugin
`success:false` errors are not safely reproducible with the current real harness
without adding synthetic plugin behavior. They remain covered by focused
unit/integration tests and are recorded as not proven real.

## Revision And Stale Evidence

Current revision is real-proven by repeated runtime snapshot extraction in
`runtime-snapshot.test.ts`, where equivalent complete snapshots produce the same
content revision.

Stale revision behavior is real-proven for the hierarchical executor by
capturing an inventory snapshot, mutating a cell in the real draw.io graph and
executing with the stale inventory. The result stops with `stale-snapshot`.

The harness does not currently expose a stable way to force every public M14
coverage requirement stale path through the real browser without adding
synthetic plugin behavior. Public stale coverage remains primarily unit-tested.

## Version And Capability Evidence

Current plugin/server capability compatibility is real-proven by successful
runtime snapshot extraction through the current bundled plugin and server.

Older compatible peers, missing capability and unsupported capability versions
are protocol-level compatibility cases. They are covered by unit/integration
tests because the real harness launches the current repository plugin only and
does not provide old or intentionally incompatible browser peers.

## Commands

Focused real-environment command:

```bash
pnpm --filter drawio-mcp-server run test:real-environment -- \
  runtime-snapshot.test.js \
  hierarchical-snapshot.test.js \
  cyberdraw-public-m14.test.js \
  --runInBand
```

Full real-environment command:

```bash
pnpm --filter drawio-mcp-server run test:real-environment
```

## Validation Results

Results recorded on branch `test/m16-real-environment-compatibility`:

| Command | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Passed; lockfile was up to date |
| `pnpm run audit:dependencies` | Passed configured moderate threshold; 1 low advisory remains |
| `pnpm --filter drawio-mcp-server run build` | Passed |
| `pnpm --filter drawio-mcp-server run lint` | Passed |
| `pnpm --filter drawio-mcp-server run format:check` | Passed |
| `pnpm --filter drawio-mcp-server run test:unit` | Passed; 34 suites / 446 tests |
| `pnpm --filter drawio-mcp-server run test:real-environment` | Passed; 17 suites / 44 tests; REAL LOCAL HTTP |
| `pnpm --filter drawio-mcp-plugin run build` | Passed |
| `pnpm --filter drawio-mcp-plugin run test` | Passed; 8 suites / 32 tests |
| `pnpm --filter drawio-mcp-extension run build` | Passed |
| `pnpm --filter drawio-mcp-extension run build:firefox` | Passed |
| `pnpm --filter cyberdraw-runtime-contract run build` | Passed |
| `pnpm --filter cyberdraw-runtime-contract run lint` | Passed |
| `pnpm --filter cyberdraw-runtime-contract run test` | Passed; 1 suite / 10 tests |
| `pnpm --filter cyberdraw-graph-model run build` | Passed |
| `pnpm --filter cyberdraw-graph-model run lint` | Passed |
| `pnpm --filter cyberdraw-graph-model run test` | Passed; 12 suites / 260 tests |
| `git diff --check` | Passed |

## Limitations

- REAL LOCAL HTTP is not HTTPS/Caddy evidence.
- The harness uses InMemoryTransport for the MCP client.
- Broad multi-version draw.io runtime compatibility is not proven.
- Old plugin/server peer behavior is not real-browser-proven.
- Malformed runtime replies, raw plugin failures and timeout paths remain
  unit/integration evidence only because forcing them in the real plugin would
  require synthetic behavior outside M16.3's evidence scope.
- M16 is closed separately by `formal-closure-m16.md`.
