# M16 - Architecture Intelligence Runtime Integration Hardening

## Status

IN PROGRESS.

This is a design document for the recommended next CyberDraw milestone after
M15. It does not implement runtime behavior, add MCP tools, change public
contracts or reopen M13, M14 or M15.

M16.1/M16.2 evidence is being recorded in
[`m16/compatibility-matrix.md`](m16/compatibility-matrix.md). M16.3
real-environment evidence is recorded in
[`m16/real-environment-evidence.md`](m16/real-environment-evidence.md). M16 is
not closed.

## Objective

Harden and consolidate the existing Architecture Intelligence runtime
integration evidence across M2-M14, with a focus on compatibility, fail-closed
behavior, scoped runtime evidence and deterministic sanitized error reporting.

M16 should turn the backlog's suggested milestone, "Architecture Intelligence
Foundation runtime integration hardening and compatibility evidence", into a
bounded executable milestone.

## Rationale

The Architecture Intelligence foundation now exists as a private graph-model and
runtime-analysis stack:

- M2 accepted the private internal graph model direction through ADR 0003.
- M3-M5 added and hardened private runtime snapshots.
- M6-M8.1 selected and implemented scope-first hierarchical snapshot execution
  with real external-reference expansion evidence.
- M9-M12 added private structural analysis, query, planning and validation.
- M13-M14 exposed bounded read-only public structural analysis and query/scope
  controls.

The evidence is substantial but distributed. ADR 0003 and the M0 backlog still
identify runtime integration and compatibility evidence as the maturity risk.
M16 should close that risk without expanding the product surface.

## Scope

- Build a compatibility matrix for the Architecture Intelligence runtime path.
- Audit and regression-test current plugin/server runtime snapshot contracts.
- Verify scoped runtime behavior for document, pages, layers and selection where
  supported by existing harnesses.
- Verify visible and background page behavior.
- Verify external-reference expansion behavior from M8.1 remains intact.
- Verify stale revision, malformed payload, oversized payload, timeout and
  unsupported capability outcomes.
- Verify M13/M14 public read-only behavior still maps private runtime evidence
  without widening scope or exposing internals.
- Add minimal code fixes only for reproducible defects found during this
  milestone.
- Record real-environment evidence and residual limitations.

## Non-Goals

- No new MCP tools.
- No public contract changes.
- No changes to `m13-v1`, `m14-v1` or `m15-v1`.
- No public document-scope execution.
- No persistence, sidecars or database.
- No semantic diff.
- No stable global identity implementation.
- No mutation executor for M11 plans.
- No rollback, transactions or approval workflows.
- No arbitrary policy language or rule engine.
- No prompt-to-diagram extensions.
- No server-side LLM or provider integration.
- No chunking, streaming or incremental analysis unless accepted separately by
  ADR.
- No broad plugin rewrite.

## Architecture Constraints

- `packages/cyberdraw-graph-model` remains source-neutral and independent from
  MCP SDK, WebSocket messages, browser APIs and draw.io runtime objects.
- The server remains the runtime orchestrator for snapshot requests, bounded
  execution, analysis and public mapping.
- The plugin remains limited to draw.io runtime extraction and existing mutation
  primitives.
- Public M13/M14 analysis stays read-only.
- Public M15 Mermaid import stays separate from Architecture Intelligence
  analysis and is not expanded by M16.
- All runtime evidence must distinguish scoped coverage from complete-document
  coverage.

## Required Compatibility Matrix

| Compatibility Area | Required M16 Classification |
| --- | --- |
| Plugin/server contract versions | Already proven, needs regression evidence, still unproven or out of scope |
| Older peer compatibility | Expected fail-closed or compatibility behavior |
| Missing capability behavior | Deterministic fallback or rejection without silent broadening |
| Unsupported draw.io/runtime version behavior | Sanitized unsupported result or documented harness limitation |
| Stale revision behavior | Scoped stale/incompatible evidence with deterministic outcome |
| Document/page/layer/selection scopes | Scope-specific coverage, limits and fail-closed behavior |
| Visible/background pages | Real runtime evidence and limitations |
| External references | M8.1 regression coverage and unsupported-reference behavior |
| Malformed payloads | Rejection or partial coverage without internal leakage |
| Oversize payloads | Hard/soft limit behavior and deterministic diagnostics |
| Timeout/error classification | Sanitized deterministic outcome, no hidden retries |
| Real draw.io browser evidence | HTTP-local proof, with HTTPS/Caddy separated unless actually executed |

The current in-progress matrix is recorded in
[`m16/compatibility-matrix.md`](m16/compatibility-matrix.md). It maps each case
to the implementation path and exact automated or real-environment evidence.
M16.3's real-environment subset is recorded separately in
[`m16/real-environment-evidence.md`](m16/real-environment-evidence.md) so REAL
LOCAL HTTP evidence is not mixed with unit/integration evidence.

## Real-Environment Evidence Required

M16 should reuse the existing HTTP-local real-environment harness before adding
any new harness. Evidence should cover:

- visible page runtime snapshot;
- background page runtime snapshot;
- explicit page scope;
- explicit layer scope;
- selection scope where supported;
- scoped stale revision behavior;
- external-reference expansion regression;
- malformed or oversized runtime response behavior where safely injectable;
- M13/M14 public read-only regression over the same runtime path.

If HTTPS/Caddy or multiple draw.io runtime versions cannot run in the local
harness, M16 must record that as a limitation and must not convert it into a PASS
claim.

## Acceptance Criteria

- M16 compatibility matrix is created and maps each area to evidence.
- Public M13, M14 and M15 contracts remain unchanged.
- No new public MCP tool is registered.
- Architecture Intelligence read paths remain read-only.
- Existing unit, integration and real-environment suites for M8-M14 remain green.
- Focused M16 tests prove missing capability, stale revision, malformed payload,
  oversize payload and timeout/error behavior where the harness permits it.
- Real draw.io HTTP-local evidence covers visible/background page behavior and
  external-reference expansion.
- No response exposes XML, raw snapshots, raw graph, plugin internals or stack
  traces.
- No scope silently broadens from layer to page, page to document or selection to
  document.
- Any defect fix is minimal, documented and covered by a regression test.
- Residual limitations are recorded explicitly.

Current M16 gap handling:

- Added focused server-path regression evidence for malformed and oversize
  runtime snapshot replies.
- Fixed a runtime error sanitization defect where a plugin `success:false`
  message could carry XML, stack or local path detail into Architecture
  Intelligence callers.
- Recorded M16.3 REAL LOCAL HTTP evidence for visible/background pages, scoped
  runtime execution, external-reference expansion, public M13/M14 read-only
  behavior and public negative-path sanitization.
- Kept public M13/M14/M15 contracts unchanged.

## Exit Criteria

- `docs/cyberdraw/milestones/m16/compatibility-matrix.md` or equivalent evidence
  record exists.
- M16 milestone document is updated from PROPOSED / NOT STARTED to the actual
  completion state only after implementation and validation.
- Validation commands and exact results are recorded.
- Real-environment evidence is recorded separately from unit/integration tests.
- HTTPS/Caddy and cross-version draw.io limitations are either proven or left as
  visible limitations.
- No deferred capability is implemented accidentally.

M16 is not yet complete. Closure still requires the full validation matrix,
including package builds, lint, unit suites, real-environment suites, plugin
tests, extension builds and dependency audit results.

## Explicit Deferrals

- Stable identity across page moves, clones or imports.
- Public graph-model schema.
- Semantic diff.
- Persistence or review sessions.
- Mutation execution of M11 plans.
- Approval workflows.
- Rollback or transactions.
- Incremental analysis, chunking or streaming.
- Prompt-to-diagram expansion beyond the closed M15 MVP.

## Recommended Branch

`feat/m16-architecture-intelligence-runtime-hardening`

Use an implementation branch only after this proposal is reviewed and accepted.
