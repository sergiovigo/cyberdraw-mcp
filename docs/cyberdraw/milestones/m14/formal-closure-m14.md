# M14 Formal Closure: Public Structural Query And Scope Controls

## Executive Summary

M14 is complete and formally closed. The milestone extends the existing public
read-only CyberDraw MCP tool, `cyberdraw_analyze_structure`, with bounded
multi-scope controls and sanitized aggregate query operations while preserving
M13-compatible behavior and the `m13-v1` response contract.

Final verdict: PASS WITH LIMITATIONS. The public M14 contract passed automated,
unit, integration and HTTP real-environment validation. HTTPS/Caddy validation
remains a harness limitation: 13 suites passed and 2 suites failed because
existing tests constructed direct `http://localhost` URLs while
`HARNESS_HTTPS=1` was enabled.

## Final Status

- Milestone: M14 — Public Structural Query and Scope Controls.
- Status: COMPLETE / CLOSED.
- Public MCP tool: `cyberdraw_analyze_structure`.
- Public DTO versions: `m13-v1` and `m14-v1`.
- Closure slice: M14.5 — Documentation And Closure.
- Closure date: 2026-07-21.
- Base implementation commit for closure: `dcfb59d`.

## Milestone Chronology

| Slice | Status | Commit | PR | Result |
| --- | --- | --- | --- | --- |
| M14.0 — Design And Contracts | Completed | `775ce7c` | #22 | Milestone, ADR, contract, compatibility matrix, limits model and reason-code registry defined. |
| M14.1 — Scope Model | Completed | `2beed6a` | #23 | Pure public request/version/scope model added to `cyberdraw-graph-model`. |
| M14.2 — Public MCP Contract Integration | Completed | `1911a62` | #24 | Existing public tool integrated with `m14-v1`, M14 scope resolution, count, summarize, coverage and safety mapping. |
| M14.3 — Server Contract And Safety | Completed by absorption | `1911a62` | #24 | M14.2 covered version selection, response mapping, safety counters, privacy filters, limits and structured reason codes. |
| M14.4 — Real-Environment Validation | Completed with limitations | `dcfb59d` | #25 | Real HTTP validation passed; explicit multi-page runtime defect was found and fixed. |
| M14.5 — Documentation And Closure | Completed | pending closure commit | pending | Formal closure documentation and index updates. |

## Delivered Capabilities

M14 delivered:

- one public CyberDraw MCP tool, unchanged in name;
- request-driven selection between `m13-v1` and `m14-v1`;
- validation through the pure public contract model before runtime execution;
- explicit `scope.pageIds`;
- explicit page-qualified `scope.layerTargets`;
- multi-page, multi-layer and mixed non-redundant page/layer scopes;
- structured rejection of public document scope;
- sanitized `query.operation: "count"`;
- sanitized `query.operation: "summarize"`;
- coverage requirements for `nonStale` and `completeTargetScopes`;
- requested limits that narrow server-side caps;
- structured public reason codes;
- bounded deterministic public responses;
- read-only safety evidence in every public response.

M14 did not deliver mutation, semantic diff, persistence, review sessions,
human approval, rollback, transactions, streaming, chunking, stable identity
across revisions or complete-document public execution.

## Public Contract

The public tool remains:

```text
cyberdraw_analyze_structure
```

M13-compatible requests continue to return `version: "m13-v1"` and do not gain
M14 response fields. Requests that use recognized M14 capabilities return
`version: "m14-v1"`. Version selection is based on request shape before
execution, not on analysis results.

Unknown fields fail validation. Recognized M14 fields with invalid values
produce structured `m14-v1` rejection when the M14 trigger is valid enough to
select the contract. Rejected pre-runtime responses do not include normalized
executable targets, findings or runtime summaries.

## Compatibility

M13 behavior is preserved for:

- `analyze`;
- `query`;
- `plan`;
- `validate`;
- default safe scope;
- explicit inherited `scope.pageId`;
- explicit inherited `scope.layerId`;
- expansion, planning, validation and response controls;
- ambiguous-document fail-closed behavior;
- read-only safety fields.

M14 does not add fields to M13 responses and does not route M13-compatible
requests through the `m14-v1` mapper.

## Scope Semantics

Supported public scopes:

- default safe current page/layer scope;
- inherited explicit single page;
- inherited explicit single layer;
- M14 explicit multi-page scope through `scope.pageIds`;
- M14 explicit multi-layer scope through `scope.layerTargets`;
- M14 mixed page/layer scope when targets are non-redundant.

Unsupported public scopes:

- complete-document execution;
- `scope.document`;
- silent fallback from invalid explicit scope;
- layer-to-page broadening;
- page-to-document broadening;
- partial execution after an explicit target resolution failure.

Explicit target resolution is all-or-nothing. A missing page, missing layer,
wrong-page layer, duplicate target or over-broad scope rejects the request
without executing a subset.

## Query Semantics

M14 keeps the top-level modes `analyze`, `query`, `plan` and `validate`.
`count` and `summarize` exist only as `query.operation` values under
`mode: "query"`.

`count` returns sanitized aggregate counts over the bounded, filtered analysis
population. It includes aggregate totals and buckets such as finding type,
classification, confidence, inspected scopes, proposals and validation issues
when applicable. It does not return raw findings unless a separate inherited
response control explicitly allows public findings within caps.

`summarize` returns bounded deterministic grouping buckets and aggregate
summary fields. It does not expose labels, XML, raw cells, raw snapshots,
internal graph objects or planner internals.

## Coverage Semantics

M14 coverage reports distinguish:

- stale evidence;
- truncation;
- conclusive inspection of requested targets;
- complete requested target coverage;
- unknown complete-document coverage.

`coverage.conclusive: true` does not mean complete-document coverage. M14 does
not provide public complete-document coverage. `completeTargetScopes` means
every normalized requested page/layer target was inspected as requested, not
that the whole draw.io document was inspected.

Coverage requirements are evaluated as conditions:

- `nonStale` fails stale coverage with `stale-coverage`;
- `completeTargetScopes` fails incomplete target coverage with
  `incomplete-target-scope`;
- `any` accepts bounded results with explicit limitations.

Runtime limitations produce `ok-with-limitations` or `partial` according to the
implemented public mapper. Structural pre-runtime failures produce `rejected`.

## Limits

M14 applies limits for:

- pages;
- layers;
- findings;
- proposals;
- expansion steps;
- execution time;
- response size.

Client-requested limits only narrow server-side caps and never expand them.
Limit hits are reported through structured limitations such as
`scope-too-broad`, `expansion-limit-reached` and `result-limit-reached`.

M14 does not require `effectiveLimits` in every `m14-v1` response. That
reporting decision remains open and should not be inferred by clients.

## Reason Codes

M14 exposes only the registered public reason codes:

- `active-page-unavailable`;
- `ambiguous-document`;
- `document-scope-not-supported`;
- `duplicate-scope-target`;
- `empty-scope`;
- `expansion-limit-reached`;
- `incomplete-target-scope`;
- `layer-not-found`;
- `page-not-found`;
- `result-limit-reached`;
- `revision-incompatible`;
- `scope-too-broad`;
- `stale-coverage`;
- `unsupported-query-operation`.

Reason codes are public compatibility surface. New codes require updating the
contract and ADR before exposure.

## Safety And Privacy

M14 remains read-only:

```json
{
  "readOnly": true,
  "mutationAttempted": false,
  "mutationInvocations": 0
}
```

Public plans remain non-executable, and `validate` does not execute plans. M14
does not call mutation adapters and does not invoke add, edit, delete or import
operations through the CyberDraw public structural tool.

Public responses must not expose XML, `mxGraphModel`, raw snapshots, raw graph
objects, raw cell payloads, full labels, style strings, source/target payloads,
planner traces, stack traces, local paths or environment values.

## Real-Environment Validation

M14.4 validation is recorded in
[`real-environment-validation-m14.4.md`](real-environment-validation-m14.4.md).

Primary HTTP validation passed:

- real-environment HTTP: 16 suites / 42 tests;
- public M14 requests exercised through the MCP server against the draw.io
  runtime;
- matrix result across real, unit and integration coverage: 74 PASS / 0 FAIL /
  0 BLOCKED.

The matrix is combined evidence, not 74 separate real-environment tests.

## Defect Found And Fixed

M14.4 found one implementation defect:

- ID: M14.4-DEFECT-001.
- Symptom: explicit M14 multi-page scope rejected a valid background page as
  `page-not-found`.
- Cause: scope resolution used a selection-scoped inventory snapshot that only
  included the active page in the real runtime.
- Fix: explicit M14 scopes now request bounded inventory derived from the
  explicit target scope before resolution.

The fix did not introduce document scope, fallback, broadening, mutation or
public `executedScope` changes.

## Residual Limitation

HTTPS/Caddy real-environment validation remains incomplete:

- command attempted: `pnpm --filter drawio-mcp-server run
  test:real-environment:https`;
- observed result: 13 suites passed, 2 suites failed;
- cause: existing harness tests construct direct `http://localhost:<port>` URLs
  while `HARNESS_HTTPS=1` routes through the proxied HTTPS server;
- classification: harness/environment limitation;
- contract impact: no known M14 public contract failure.

This limitation must not be reclassified as a full PASS until the harness is
corrected and rerun successfully.

## Automated Evidence

Recorded M14 evidence:

- `cyberdraw-graph-model`: 12 suites / 260 tests;
- `drawio-mcp-server` unit: 32 suites / 396 tests;
- public tool suite: 43 tests;
- runtime/snapshot/staleness: 37 tests;
- hierarchical planner: 10 tests;
- real-environment HTTP: 16 suites / 42 tests;
- CI on Node.js 22.x and 24.x: passed;
- dependency audit: passed the configured threshold with 1 low advisory
  remaining.

## Files And Components Affected

Implementation touched the pure public contract model, hierarchical snapshot
planning primitives where required, and the existing
`cyberdraw_analyze_structure` server tool. M14 did not add a second public MCP
tool and did not modify inherited draw.io mutation tools.

## Known Non-Goals

The following remain outside M14:

- semantic diff;
- persistence;
- review sessions;
- human approval;
- mutation;
- rollback;
- transactions;
- complete-document public execution;
- stable cross-revision identity;
- execution of structural proposals.

## Residual Risks

- Callers may still misread multi-page or multi-layer coverage as
  complete-document coverage unless they inspect `coverage` and `limitations`.
- HTTPS/Caddy real-environment coverage remains limited by the harness.
- Future mutation-capable milestones must preserve the M14 boundary unless a
  later ADR and contract explicitly change it.
- `effectiveLimits` reporting remains intentionally non-mandatory.

## References

- PR #22: `775ce7c` — `docs(m14): define public query and scope controls`.
- PR #23: `2beed6a` — `feat(m14): add pure public query and scope model`.
- PR #24: `1911a62` — `feat(m14): integrate public mcp contract`.
- PR #25: `dcfb59d` — `fix(m14): resolve explicit multi-page scopes in real
  runtime`.
- ADR 0007:
  [`../../adr/0007-public-scope-coverage-and-dto-versioning-for-m14.md`](../../adr/0007-public-scope-coverage-and-dto-versioning-for-m14.md).
- M14 contract:
  [`contract-m14-v1.md`](contract-m14-v1.md).
- M14 real-environment validation:
  [`real-environment-validation-m14.4.md`](real-environment-validation-m14.4.md).

## Closure Decision

M14 is COMPLETE / CLOSED with PASS WITH LIMITATIONS. No additional M14 code,
test, dependency or lockfile changes are required for formal closure. Future
work must treat HTTPS/Caddy harness correction, complete-document public
execution, mutation, semantic diff, approval, persistence and rollback as
separate milestones.

## Formal Closure Declaration

M14 is complete, integrated in `main`, validated by CI and recorded
real-environment evidence, and formally closed by M14.5. The public contract is
bounded, deterministic, sanitized and read-only; M13 compatibility remains
preserved.
