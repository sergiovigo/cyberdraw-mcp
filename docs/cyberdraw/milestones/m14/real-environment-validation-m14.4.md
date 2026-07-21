# M14.4 Real-Environment Validation

## Scope

- Milestone: M14.4 — Real-Environment Validation.
- Source: `docs/cyberdraw/milestones/M14-public-structural-query-and-scope-controls.md`.
- Objective: validate the public M14 contract through real or representative MCP calls against Draw.io.
- Date: 2026-07-21.
- Branch: `test/m14-real-environment-validation`.
- Base commit: `1911a624d7a8cca425744681bb9612d18627c7fd`.

M14.4 is validation only except for defects found by that validation. During this run a reproducible public M14 multi-page defect was found and fixed with a minimal server-side correction plus real-environment coverage.

## Environment

- OS: Linux 6.8.0-134-lowlatency x86_64 GNU/Linux.
- Node: v24.18.0.
- pnpm: 10.8.1.
- Server package: `drawio-mcp-server` 2.2.0.
- Extension package: `drawio-mcp-extension` 2.2.0.
- Plugin package: `drawio-mcp-plugin` 2.2.0.
- Transport under primary validation: MCP client over in-memory transport, server HTTP editor, WebSocket bridge, Chromium headless.
- Draw.io runtime: repository-hosted editor assets loaded by the official real-environment harness.
- Artifact directory: `.artifacts/real-environment/` is gitignored and contains transient screenshots/XML from existing real-environment diagnostics. Those artifacts are not committed.

## Commands

```sh
git fetch origin --prune
git switch main
git pull --ff-only
git switch -c test/m14-real-environment-validation

pnpm run audit:dependencies
pnpm --filter cyberdraw-graph-model run build
pnpm --filter cyberdraw-graph-model run lint
pnpm --filter cyberdraw-graph-model run test
pnpm --filter drawio-mcp-server run build
pnpm --filter drawio-mcp-server run lint
pnpm --filter drawio-mcp-server run format:check
pnpm --filter drawio-mcp-server run test:unit
NODE_OPTIONS=--experimental-vm-modules pnpm --filter drawio-mcp-server exec jest build/tools/cyberdraw-analyze-structure.test.js --runInBand
NODE_OPTIONS=--experimental-vm-modules pnpm --filter drawio-mcp-server exec jest build/cyberdraw-runtime-snapshot.test.js build/cyberdraw-snapshot-staleness.test.js build/cyberdraw-hierarchical-snapshot.test.js --runInBand
NODE_OPTIONS=--experimental-vm-modules pnpm --filter cyberdraw-graph-model exec jest build/hierarchical-snapshot-planner.test.js --runInBand
pnpm --filter drawio-mcp-server run test:real-environment
```

HTTPS/Caddy was also attempted with:

```sh
pnpm --filter drawio-mcp-server run test:real-environment:https
```

That lane is recorded as a harness/environment limitation: 13 suites passed, 2 suites failed because HTTPS mode exercised tests that still construct direct `http://localhost:<port>` URLs against the proxied HTTPS server. This is not treated as an M14 public contract failure.

## Automated Results

| Command | Result |
| --- | --- |
| `pnpm run audit:dependencies` | PASS, exit 0; 1 low severity vulnerability reported |
| `pnpm --filter cyberdraw-graph-model run build` | PASS |
| `pnpm --filter cyberdraw-graph-model run lint` | PASS |
| `pnpm --filter cyberdraw-graph-model run test` | PASS, 12 suites, 260 tests |
| `pnpm --filter drawio-mcp-server run build` | PASS |
| `pnpm --filter drawio-mcp-server run lint` | PASS, 120 files checked |
| `pnpm --filter drawio-mcp-server run format:check` | PASS |
| `pnpm --filter drawio-mcp-server run test:unit` | PASS, 32 suites, 396 tests |
| public tool suite | PASS, 1 suite, 43 tests |
| runtime/snapshot/staleness suites | PASS, 3 suites, 37 tests |
| hierarchical planner suite | PASS, 1 suite, 10 tests |
| `pnpm --filter drawio-mcp-server run test:real-environment` | PASS, 16 suites, 42 tests |
| `pnpm --filter drawio-mcp-server run test:real-environment:https` | LIMITATION, 13 suites passed, 2 failed due harness URL scheme mismatch |

Warnings observed:

- Node emitted `[DEP0169]` warnings for transitive `url.parse()` usage.
- Jest emitted VM Modules experimental warnings.

## Defect Found

### M14.4-DEFECT-001 — M14 public multi-page scope rejected valid background page

Reproduction:

1. Start the official real-environment harness.
2. Create a second page through MCP.
3. Call `cyberdraw_analyze_structure` with:

```json
{
  "mode": "query",
  "scope": { "pageIds": ["<active-page-id>", "<background-page-id>"] },
  "query": { "operation": "summarize", "groupBy": "finding-type" }
}
```

Observed before fix:

- response `version: "m14-v1"`;
- `outcome: "rejected"`;
- limitation `page-not-found`;
- no execution.

Cause:

- M14 explicit scope resolution used a selection-scoped inventory snapshot.
- In the real runtime, that inventory contained the active page only.
- Valid background pages were therefore absent from `pagesById`.

Fix:

- M14 explicit scope resolution now requests an inventory snapshot bounded to the explicit M14 scope:
  - `pageIds` -> pages inventory;
  - single-page `layerTargets` -> layer inventory;
  - mixed or multi-page layer targets -> bounded pages inventory for target pages;
  - default remains selection inventory.
- `scope.document` remains rejected before snapshots.
- Executed scope remains the normalized requested scope; inventory selection does not broaden public execution.

Verification:

- `build/real-environment/cyberdraw-public-m14.test.js` reproduces the real public M14 path and now passes.
- The public tool unit suite was updated to assert the new bounded inventory requests and no document broadening.

## Case Matrix

Status meanings:

- PASS: covered by real-environment, public tool unit tests, runtime/snapshot/staleness tests, or hierarchical planner tests.
- LIMITATION: attempted but blocked by harness/environment, not a contract failure.

| ID | Case | Environment | Status | Evidence |
| --- | --- | --- | --- | --- |
| 1 | M13 valid request -> `m13-v1` | Real + unit | PASS | `hierarchical-snapshot`, public tool suite |
| 2 | M14 valid request -> `m14-v1` | Real + unit | PASS | `cyberdraw-public-m14`, public tool suite |
| 3 | Recognized M14 field selects M14 before validation | Unit | PASS | public tool suite, model suite |
| 4 | Unknown field -> pre-runtime rejection | Unit | PASS | public tool suite, model suite |
| 5 | Ambiguous request does not mix contracts | Unit | PASS | public tool suite |
| 6 | `pageIds` one page | Real + unit | PASS | `cyberdraw-public-m14`, public tool suite |
| 7 | `pageIds` multiple pages | Real + unit | PASS | `cyberdraw-public-m14`, public tool suite |
| 8 | `layerTargets` one layer | Unit | PASS | public tool suite |
| 9 | `layerTargets` multiple layers | Real + unit | PASS | `cyberdraw-public-m14`, public tool suite |
| 10 | Mixed non-redundant scope | Real + unit | PASS | `cyberdraw-public-m14`, public tool suite |
| 11 | Missing page | Real + unit | PASS | `cyberdraw-public-m14`, public tool suite |
| 12 | Missing layer | Unit | PASS | public tool suite |
| 13 | Layer under wrong page | Real + unit | PASS | `cyberdraw-public-m14`, public tool suite |
| 14 | Duplicate target | Real + unit | PASS | `cyberdraw-public-m14`, model suite |
| 15 | Empty scope | Real + unit | PASS | `cyberdraw-public-m14`, model suite |
| 16 | `scope.document` rejected | Real + unit | PASS | `cyberdraw-public-m14`, public tool suite |
| 17 | Invalid target without fallback | Real + unit | PASS | `cyberdraw-public-m14`, public tool suite |
| 18 | Layer scope not broadened to page | Real + unit | PASS | `cyberdraw-public-m14`, public tool suite |
| 19 | Page scope not broadened to document | Real + unit | PASS | `cyberdraw-public-m14`, public tool suite |
| 20 | Invalidation all-or-nothing | Real + unit | PASS | `cyberdraw-public-m14`, public tool suite |
| 21 | Normal M13 query | Real + unit | PASS | `hierarchical-snapshot`, public tool suite |
| 22 | Count with non-empty population | Real + unit | PASS | `cyberdraw-public-m14`, public tool suite |
| 23 | Count with empty population | Unit | PASS | public tool suite |
| 24 | Count after filters | Unit | PASS | public tool suite |
| 25 | Summarize with buckets | Real + unit | PASS | `cyberdraw-public-m14`, public tool suite |
| 26 | Summarize without findings | Unit | PASS | public tool suite |
| 27 | Deterministic ordering | Unit | PASS | public tool suite, model suite |
| 28 | Findings bounds | Unit | PASS | public tool suite |
| 29 | Bucket bounds | Unit | PASS | public tool suite |
| 30 | Unsupported operation | Unit | PASS | public tool suite |
| 31 | `nonStale` satisfied | Real + unit | PASS | `cyberdraw-public-m14`, public tool suite |
| 32 | `nonStale` violated | Unit | PASS | public tool suite, staleness suite |
| 33 | `completeTargetScopes` satisfied | Real + unit | PASS | `cyberdraw-public-m14`, public tool suite |
| 34 | `completeTargetScopes` violated | Unit | PASS | public tool suite |
| 35 | Truncation | Unit | PASS | public tool suite, runtime snapshot suite |
| 36 | Stale coverage | Unit | PASS | public tool suite, staleness suite |
| 37 | `conclusive: true` with partial non-document scope | Unit | PASS | public tool suite |
| 38 | `conclusive: false` | Unit | PASS | public tool suite |
| 39 | Timeout/runtime limitation | Unit | PASS | hierarchical snapshot suite |
| 40 | Structured partial coverage | Unit | PASS | public tool suite |
| 41 | Page limit | Real + unit | PASS | `cyberdraw-public-m14`, model suite |
| 42 | Layer limit | Unit | PASS | model suite |
| 43 | Findings limit | Unit | PASS | public tool suite |
| 44 | Proposals limit | Unit | PASS | public tool suite |
| 45 | Expansion limit | Unit | PASS | public tool suite |
| 46 | Response size limit | Unit | PASS | public tool suite |
| 47 | Execution limit | Unit | PASS | public tool suite |
| 48 | Reply timeout limit | Unit | PASS | runtime/hierarchical suites |
| 49 | Requested limits narrow internals | Unit | PASS | public tool suite, model suite |
| 50 | Requested limits never raise internals | Unit | PASS | model suite |
| 51 | `readOnly: true` | Real + unit | PASS | `cyberdraw-public-m14`, public tool suite |
| 52 | `mutationAttempted: false` | Real + unit | PASS | `cyberdraw-public-m14`, public tool suite |
| 53 | `mutationInvocations: 0` | Real + unit | PASS | `cyberdraw-public-m14`, public tool suite |
| 54 | Plan non-executable | Real + unit | PASS | `hierarchical-snapshot`, public tool suite |
| 55 | Validate does not execute plan | Real + unit | PASS | `hierarchical-snapshot`, public tool suite |
| 56 | Pre-runtime rejection without snapshot | Unit | PASS | public tool suite |
| 57 | Pre-runtime rejection without analysis | Unit | PASS | public tool suite |
| 58 | No XML | Real + unit | PASS | `cyberdraw-public-m14`, public tool suite |
| 59 | No raw snapshot | Real + unit | PASS | `cyberdraw-public-m14`, public tool suite |
| 60 | No raw graph | Real + unit | PASS | `cyberdraw-public-m14`, public tool suite |
| 61 | No planner internals | Real + unit | PASS | `cyberdraw-public-m14`, public tool suite |
| 62 | Registered reason codes only | Real + unit | PASS | `cyberdraw-public-m14`, model suite |
| 63 | Sanitized data | Real + unit | PASS | `cyberdraw-public-m14`, public tool suite |
| 64 | Bounded payload | Unit | PASS | public tool suite |
| 65 | M13 analyze | Real + unit | PASS | `hierarchical-snapshot`, public tool suite |
| 66 | M13 query | Real + unit | PASS | `hierarchical-snapshot`, public tool suite |
| 67 | M13 plan | Real + unit | PASS | `hierarchical-snapshot`, public tool suite |
| 68 | M13 validate | Real + unit | PASS | `hierarchical-snapshot`, public tool suite |
| 69 | M13 default safe scope | Real + unit | PASS | `hierarchical-snapshot`, public tool suite |
| 70 | M13 explicit page | Unit | PASS | public tool suite |
| 71 | M13 explicit layer | Real + unit | PASS | `hierarchical-snapshot`, public tool suite |
| 72 | M13 ambiguous document fail-closed | Unit | PASS | public tool suite |
| 73 | M13 responses contain no M14 fields | Unit | PASS | public tool suite |
| 74 | Pre-M14 behavior without regression | Real + unit | PASS | real-environment suite, public tool suite |

## Safety And Privacy

- No public document-scope execution was observed.
- `scope.document` returned `document-scope-not-supported` with `executedScope.executed: false`.
- Public M14 outputs were asserted not to contain labels from the fixture, `<mxGraphModel`, raw snapshots, raw graph markers, planner stop reasons or planner internals.
- Safety fields remained:

```json
{
  "readOnly": true,
  "mutationAttempted": false,
  "mutationInvocations": 0
}
```

## Verdict

PASS WITH LIMITATIONS.

The primary real-environment HTTP validation passes and covers the public M14 contract through MCP calls against the Draw.io runtime. HTTPS/Caddy remains a harness limitation for two existing real-environment suites that use direct HTTP URLs under `HARNESS_HTTPS=1`.
