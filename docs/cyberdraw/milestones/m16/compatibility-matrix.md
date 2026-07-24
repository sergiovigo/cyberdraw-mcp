# M16 Compatibility Matrix

Status: IN PROGRESS evidence record.

M16 verifies the existing Architecture Intelligence runtime path. It does not
add public tools, public APIs, persistence, mutation execution, semantic diff,
rollback or stable global identity.

M16.3 REAL LOCAL HTTP evidence is recorded in
[`real-environment-evidence.md`](real-environment-evidence.md). This matrix
distinguishes real-environment proof from unit/integration-only proof.

## Runtime Architecture Map

| Component | File | Responsibility | Contract/version | Caller | Callee | Tests | Real-environment evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Runtime contract package | `packages/cyberdraw-runtime-contract/src/index.ts` | Defines runtime snapshot event, capability, scopes, limits, validation and content revisions | `contractVersion: 1`, `cyberdraw.runtime-snapshot.v1`, `cyberdraw.runtimeSnapshot.v1` | Server and plugin | Pure validation/helpers | `packages/cyberdraw-runtime-contract/src/index.test.ts` | Indirect through server real-environment suites |
| Plugin runtime snapshot extractor | `packages/drawio-mcp-plugin/src/runtime-snapshot.ts` | Extracts bounded draw.io runtime snapshots for document/pages/layers/selection | Runtime snapshot v1 | Plugin bootstrap event handler | draw.io runtime APIs | `packages/drawio-mcp-plugin/src/runtime-snapshot.test.ts` | `packages/drawio-mcp-server/src/real-environment/runtime-snapshot.test.ts` |
| Plugin bootstrap/capability advertisement | `packages/drawio-mcp-plugin/src/bootstrap.ts` | Sends document state with runtime capabilities and handles runtime snapshot event | Runtime capabilities v1 | Browser plugin | Server WebSocket | Covered by server document/runtime tests | Real-environment harness startup |
| Draw.io version compatibility | `packages/drawio-mcp-plugin/src/drawio-compat/*` | Detects draw.io version and dispatches versioned plugin tools where applicable | draw.io compatibility matrix, floor `29.0.0` | Plugin tools | Versioned tool impls | `dispatch.test.ts`, `detect.test.ts`, `matrix.test.ts`, `report.test.ts` | Not a separate runtime snapshot dispatcher today |
| Server WebSocket/document registry | `packages/drawio-mcp-server/src/index.ts` | Tracks active documents and runtime capabilities per connection | `document-state`, `documents-changed`, `sync-document-state` | Plugin WebSocket | Server context/document routing | `documents-changed-broadcast.test.ts` | All real-environment suites |
| Request channel and FIFO queue | `packages/drawio-mcp-server/src/tool.ts`, `packages/drawio-mcp-server/src/request_queue.ts` | Resolves target document, injects routing, enqueues per connection and handles timeouts/replies | Internal MCP server channel | Tools/internal runtime callers | Event bus/plugin | `tool.test.ts`, `request_queue.test.ts`, `cyberdraw-runtime-snapshot.test.ts` | Indirect through real-environment suites |
| Runtime snapshot server client | `packages/drawio-mcp-server/src/cyberdraw-runtime-snapshot.ts` | Validates requested scope/capability, sends runtime snapshot request, parses and validates response | `cyberdraw.runtimeSnapshot.v1` | Hierarchical executor and tests | Plugin runtime snapshot extractor | `cyberdraw-runtime-snapshot.test.ts` | `real-environment/runtime-snapshot.test.ts` |
| Staleness classifier | `packages/drawio-mcp-server/src/cyberdraw-snapshot-staleness.ts` | Compares scoped revision evidence and classifies capture errors | Internal freshness model | Tests/future recapture paths | Runtime snapshot data | `cyberdraw-snapshot-staleness.test.ts` | Indirect via stale real-environment planner test |
| Hierarchical executor | `packages/drawio-mcp-server/src/cyberdraw-hierarchical-snapshot.ts` | Inventory, planning, scoped runtime requests, freshness checks, merge, graph adaptation and M9-M12 orchestration | Internal execution result | M13/M14 public wrapper and tests | Runtime snapshot client, graph model | `cyberdraw-hierarchical-snapshot.test.ts` | `real-environment/hierarchical-snapshot.test.ts` |
| Graph-model adapter/merge/planner | `packages/cyberdraw-graph-model/src/runtime-snapshot-adapter.ts`, `scoped-snapshot-merge.ts`, `hierarchical-snapshot-planner.ts` | Converts runtime snapshots to canonical input, merges scopes and plans bounded execution | Private graph-model API | Server hierarchical executor | Pure graph-model logic | `runtime-snapshot-adapter.test.ts`, `scoped-snapshot-merge.test.ts`, `hierarchical-snapshot-planner.test.ts` | Indirect through hierarchical real-environment tests |
| Structural analysis/query/planning/validation | `packages/cyberdraw-graph-model/src/structural-*.ts` | M9-M12 private Architecture Intelligence analysis flow | Private graph-model APIs | Server hierarchical executor | Pure graph-model logic | `structural-analysis.test.ts`, `structural-query.test.ts`, `structural-change-plan.test.ts`, `structural-change-plan-validation.test.ts` | `real-environment/hierarchical-snapshot.test.ts` |
| Public M13/M14 wrapper | `packages/drawio-mcp-server/src/tools/cyberdraw-analyze-structure.ts` | Maps private execution to sanitized `m13-v1` and `m14-v1` read-only responses | `m13-v1`, `m14-v1` | MCP clients | Hierarchical executor | `tools/cyberdraw-analyze-structure.test.ts` | `real-environment/hierarchical-snapshot.test.ts`, `real-environment/cyberdraw-public-m14.test.ts` |

## Compatibility Matrix

| Case | Classification | Implementation path | Evidence | M16 action |
| --- | --- | --- | --- | --- |
| 1. Plugin/server compatible versions | real-proven for current bundled plugin/server | `createRuntimeCapabilities()` -> `findRuntimeSnapshotCapability()` -> `requestCyberdrawRuntimeSnapshot()` | `real-environment/runtime-snapshot.test.ts`; `cyberdraw-runtime-snapshot.test.ts` / `sends to a modern peer with the runtime snapshot capability`; `cyberdraw-runtime-contract/src/index.test.ts` / `creates and validates runtime snapshot capabilities` | Keep real and protocol regression coverage |
| 2. Older compatible peer | unit/integration only | Missing `scopes` defaults capability to document-only | `cyberdraw-runtime-contract/src/index.test.ts` / `treats old M4 capabilities without scopes as document-only` | No old browser peer in current real harness |
| 3. Missing capability | unit/integration only | `before_send` rejects before event emission | `cyberdraw-runtime-snapshot.test.ts` / `fails immediately when an older plugin peer does not advertise the capability` | Current real harness always advertises capability |
| 4. Unsupported version | unit/integration only for runtime capability; broad draw.io runtime fleet still unproven | Runtime capability mismatch and draw.io compat dispatch/report | `cyberdraw-runtime-snapshot.test.ts` / `fails immediately for unsupported capability versions`; plugin `drawio-compat/*test.ts` | Do not claim exhaustive draw.io version support |
| 5. Stale revision | real-proven for stale inventory after live edit | `compareSnapshotCompatibility()` and staleness helper | `real-environment/hierarchical-snapshot.test.ts` / `covers background page, explicit page target, empty selection, hard-limit avoidance and stale plan`; `cyberdraw-snapshot-staleness.test.ts` / `classifies changed content revision as stale` | Covered with real and unit regression |
| 6. Valid current revision | real-proven | content revision stable for equivalent complete snapshot | `real-environment/runtime-snapshot.test.ts` / `extracts visible and background pages without changing public tools or editor state` | Covered |
| 7. Document scope | partially real-proven internally; public document execution remains out of scope for M14 | Runtime snapshot document scope and planner document hard-limit avoidance | `real-environment/runtime-snapshot.test.ts` / same test; `real-environment/cyberdraw-public-m14.test.ts` rejects public document scope | Preserve boundary |
| 8. Pages scope | real-proven | `RuntimeSnapshotScope.kind: "pages"` through planner/runtime | `real-environment/hierarchical-snapshot.test.ts` / `covers background page, explicit page target, empty selection, hard-limit avoidance and stale plan`; `real-environment/cyberdraw-public-m14.test.ts` pageIds count/summarize | Covered |
| 9. Layers scope | real-proven | `RuntimeSnapshotScope.kind: "layers"` through planner/runtime | `real-environment/hierarchical-snapshot.test.ts` / `executes visible-page, explicit-layer and selection plans while preserving UI`; `real-environment/cyberdraw-public-m14.test.ts` layerTargets count | Covered |
| 10. Selection scope | real-proven | `RuntimeSnapshotScope.kind: "selection"` through planner/runtime | `real-environment/hierarchical-snapshot.test.ts` / `executes visible-page, explicit-layer and selection plans while preserving UI`; empty selection covered by `covers background page...` | Covered |
| 11. Visible page | real-proven | visible page extraction and UI preservation | `real-environment/runtime-snapshot.test.ts`; `real-environment/hierarchical-snapshot.test.ts` | Covered |
| 12. Background page | real-proven | background page execution via draw.io page preparation | `real-environment/runtime-snapshot.test.ts`; `real-environment/hierarchical-snapshot.test.ts` / `covers background page...` | Covered |
| 13. External references | real-proven | external reference metadata -> expansion scope -> merge | `real-environment/hierarchical-snapshot.test.ts` / `executes real external-reference expansion into a second layer snapshot` | Covered |
| 14. Malformed payload | unit/integration only | `validateRuntimeSnapshotResponseForRequest()` rejects malformed snapshot object | `cyberdraw-runtime-snapshot.test.ts` / `rejects malformed and oversize runtime responses before trusting payloads` | Not safely injectable through current real plugin without synthetic behavior |
| 15. Oversize payload | partially real-proven and unit/integration-proven | runtime contract validation rejects `measuredJsonBytes > hardSnapshotBytes`; real truncation/hard-limit behavior is observed | `real-environment/runtime-snapshot.test.ts` truncation; `real-environment/hierarchical-snapshot.test.ts` hard-limit avoidance; `cyberdraw-runtime-contract/src/index.test.ts`; server regression above | Malicious oversize reply remains unit-level |
| 16. Timeout | unit/integration only | channel timeout removes listener and later request resolves by request ID | `cyberdraw-runtime-snapshot.test.ts` / `ignores a late timed-out reply and resolves the next request by request id`; `times out when a modern peer advertises support but does not respond` | Current real harness does not stall the real plugin |
| 17. Transport/plugin error | public negative paths real-proven; raw plugin error sanitization unit/integration-only | `success:false` reply -> `formatSnapshotError()` -> public runtime error | `real-environment/cyberdraw-public-m14.test.ts` negative rejections; `cyberdraw-runtime-snapshot.test.ts` / `sanitizes plugin runtime errors before exposing them to callers`; `cyberdraw-analyze-structure.test.ts` / `sanitizes raw runtime plugin errors before returning public MCP errors` | No synthetic plugin fault added in M16.3 |
| 18. Real browser/draw.io runtime | real-proven for HTTP-local; HTTPS/Caddy still unproven | real-environment harness launches server, Chromium, draw.io and plugin | `real-environment/runtime-snapshot.test.ts`, `real-environment/hierarchical-snapshot.test.ts`, `real-environment/cyberdraw-public-m14.test.ts` | Classify as REAL LOCAL HTTP only |

## Gap Analysis

| Gap | Class | Severity | Reproduction | Expected | Actual before M16 | Code change required |
| --- | --- | --- | --- | --- | --- | --- |
| Foundation compatibility matrix absent | F. documentation-only gap | Medium | M16 proposal required `docs/cyberdraw/milestones/m16/compatibility-matrix.md`; file did not exist | Single matrix with evidence paths and classifications | Evidence remained distributed across M3-M14 docs/tests | Documentation only |
| Server-path malformed/oversize response regression missing | A. missing test evidence | Medium | Unit test could send malformed or oversize successful runtime reply | Server rejects before trusting nested payloads | Contract package covered validation, but server path lacked direct focused regression | Test only |
| Raw plugin error detail could reach Architecture Intelligence callers | E. observability/error-classification defect | High | Runtime reply `success:false` with `message` containing stack, `/home/...` and `<mxGraphModel>` | Deterministic sanitized error without XML/path/stack | `formatSnapshotError()` propagated the first 500 chars of plugin message | Minimal sanitization fix |

No gap required adding a public API, public DTO version, mutation path,
persistence, semantic diff, rollback or stable global identity.

## M16 Slice Plan

### M16.1 - Regression And Compatibility Evidence

Create this compatibility matrix, add focused unit regressions for malformed and
oversize runtime responses, and map existing tests by capability.

### M16.2 - Runtime Hardening Defects

Fix only reproducible defects found during M16. Current M16 defect fixed:
sanitize raw runtime plugin errors before they can surface through Architecture
Intelligence callers.

### M16.3 - Real-Environment Compatibility Evidence

Run existing REAL LOCAL HTTP harness:

- `runtime-snapshot.test.ts`;
- `hierarchical-snapshot.test.ts`;
- `cyberdraw-public-m14.test.ts`.

Do not claim HTTPS/Caddy evidence unless that harness is executed and passes.

Detailed M16.3 classification is recorded in
[`real-environment-evidence.md`](real-environment-evidence.md).

### M16.4 - Closure And Documentation

After validation, update M16 status and evidence. This document is not closure;
M16 remains in progress until full validation is completed and reviewed.

## Security And Boundary Checks

- M13 and M14 remain read-only.
- `cyberdraw_analyze_structure` remains the only public Architecture
  Intelligence tool.
- No raw snapshots, graph internals, `mxGraphModel`, `mxCell`, plugin payloads,
  stack traces or local paths should appear in public M13/M14 responses.
- M16 changed only error-detail sanitization for runtime snapshot failures.

## Residual Limitations

- REAL LOCAL HTTP evidence is not HTTPS/Caddy evidence.
- Broad multi-version draw.io runtime compatibility remains unproven unless a
  dedicated compatibility lab is added.
- Stable global identity, persistence, semantic diff, mutation execution and
  rollback remain explicitly deferred.
