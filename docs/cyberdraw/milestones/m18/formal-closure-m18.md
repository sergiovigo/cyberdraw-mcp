# M18 - Formal Closure

## Status

COMPLETE / CLOSED.

## Verdict

PASS WITH LIMITATIONS.

M18 closes with ADR 0009 accepted as an internal semantic diff policy. The
milestone does not create a public semantic diff API, public graph identity,
persistence, mutation execution, rollback, transactions or incremental
analysis.

## Objective

M18 defined, implemented and evidenced a bounded internal semantic diff
foundation for comparing two normalized CyberDraw diagram states without
confusing identity continuity with semantic equality.

The controlling rule inherited from ADR 0008 remains:

```text
EXACT identity continuity != semantic equality
```

## Scope Delivered

M18 delivered:

- discovery and contract design for semantic diff;
- a pure internal graph-model function, `diffSemanticSnapshots()`;
- deterministic fixtures for semantic diff outcomes, dimensions,
  classifications, coverage and revision behavior;
- REAL LOCAL HTTP runtime snapshot evidence through the existing draw.io,
  plugin, server and normalization path;
- ADR 0009, "Architecture Intelligence Semantic Diff Policy";
- this formal closure record.

## M18.0 Result

M18.0 recorded semantic diff discovery and contract design in:

```text
docs/cyberdraw/milestones/m18/semantic-diff-discovery.md
```

It defined the internal model shape, identity interaction, change dimensions,
classification semantics, scope/completeness rules and ADR readiness criteria.

M18.0 did not implement the engine and did not create ADR 0009.

## M18.1 Result

M18.1 implemented the pure internal model:

- `packages/cyberdraw-graph-model/src/semantic-diff.ts`;
- `packages/cyberdraw-graph-model/src/semantic-diff.test.ts`;
- `packages/cyberdraw-graph-model/src/index.ts`;
- `docs/cyberdraw/milestones/m18/pure-semantic-diff-model-and-fixtures.md`.

The model remains pure and internal. It does not depend on runtime snapshots,
MCP, WebSocket, filesystem, clocks, random values or global mutable state.

## M18.2 Result

M18.2 added runtime evidence:

- test file:
  `packages/drawio-mcp-server/src/real-environment/m18-runtime-semantic-diff-evidence.test.ts`;
- evidence doc:
  `docs/cyberdraw/milestones/m18/runtime-snapshot-semantic-diff-evidence.md`.

The real evidence uses Chromium, draw.io served by the repository over local
HTTP, the real browser plugin, the real server runtime WebSocket path, real
runtime snapshot capture, `fromRuntimeSnapshot()` normalization and
`diffSemanticSnapshots()`.

This is REAL LOCAL HTTP evidence. It is not HTTPS/Caddy evidence.

## M18.3 Result

M18.3 accepts ADR 0009:

```text
docs/cyberdraw/adr/0009-architecture-intelligence-semantic-diff-policy.md
```

The ADR accepts only an internal scoped semantic diff policy. It does not
authorize public API exposure, persistence, mutation execution or incremental
analysis implementation.

## Acceptance Criteria Matrix

| Criterion                                                              | Status               | Evidence                                                                     | Limitation                                                                 |
| ---------------------------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Closed internal semantic diff model documented and tested              | PASS                 | M18.1 pure model and fixtures                                                | Internal only.                                                             |
| Identity interaction with ADR 0008 is explicit                         | PASS                 | M18.0, M18.1, ADR 0009                                                       | Exact identity remains scoped.                                             |
| `EXACT` identity is never treated as semantic equality                 | PASS                 | M18.1 fixtures, M18.2 edge endpoint case, ADR 0009                           | Future consumers must preserve this distinction.                           |
| Partial scope behavior is explicit                                     | PASS                 | M18.1 entity-level coverage tests; M18.2 partial coverage evidence           | Complete-document claims remain bounded by coverage.                       |
| Stale/revision behavior is explicit                                    | PASS WITH LIMITATION | M18.1 pure fixtures; M18.2 synthetic revision flags over real snapshots      | Natural live stale/revision race not reproduced in M18.2.                  |
| ADDED/REMOVED require coverage and absence proof                       | PASS                 | M18.1 entity-scoped absence tests; M18.2 scoped absence                      | Proof is scoped, not whole-document by default.                            |
| Unresolved `PROBABLE`/`AMBIGUOUS` candidates block absence             | PASS                 | M18.1 reverse correlation fixtures                                           | Runtime clone/copy/import ambiguity remains limited.                       |
| Deterministic ordering is tested                                       | PASS WITH LIMITATION | M18.1 pure determinism; M18.2 runtime ordering shape comparison              | Runtime artificial reorder does not preserve byte-identical internal refs. |
| No raw XML, raw snapshots, raw graph or private signatures are exposed | PASS                 | M18.1 privacy tests; M18.2 privacy notes                                     | Internal callers must keep public outputs sanitized in future work.        |
| M13/M14/M15 public contracts remain unchanged                          | PASS                 | No public tool/schema/code changes in M18.3; M18.1/M18.2 compatibility notes | Semantic diff remains private/internal.                                    |
| Runtime evidence classified honestly                                   | PASS                 | M18.2 evidence matrix                                                        | Several cases remain PARTIALLY-PROVEN or UNPROVEN.                         |
| ADR 0009 readiness recorded and decided                                | PASS                 | ADR 0009 accepted in M18.3                                                   | Accepted with limitations only.                                            |

## REAL-PROVEN Evidence

M18 consolidates these REAL-PROVEN behaviors:

- identical real snapshots derive `UNCHANGED`;
- node geometry changes derive `MOVED`;
- node label changes derive `MODIFIED`;
- node style/metadata changes derive `MODIFIED`;
- same-page node layer moves derive `MOVED`;
- unchanged edges derive `UNCHANGED`;
- edge endpoint changes derive `REWIRED`;
- edge label/style changes derive `MODIFIED` with unchanged connectivity when
  endpoints are unchanged;
- controlled add/delete derive `ADDED`/`REMOVED` with absence proof;
- partial coverage blocks authoritative classifications outside observed
  comparable scope;
- complete target scope absence remains scoped to the covered layer/page;
- isolated comparisons avoid contamination from earlier accumulated changes.

## PARTIALLY-PROVEN Evidence

M18 records these PARTIALLY-PROVEN behaviors:

- copy-page evidence shows copied entities are not silently treated as exact
  unchanged entities;
- delete/recreate visually identical is not `UNCHANGED`, while arbitrary
  import/copy rewrite behavior remains unproven;
- stale and revision mismatch behavior are proven at the pure model boundary
  over real snapshots using synthetic revision flags;
- ordering semantics preserve classifications, dimensions and reason codes,
  but not every internal snapshot-scoped reference byte after artificial
  runtime payload reorder.

## UNPROVEN Evidence

M18 does not prove:

- cross-page move;
- import/reimport with rewritten IDs;
- runtime reload/reopen continuity;
- true node copy/paste;
- arbitrary clone behavior;
- semantic equivalence between distinct entities;
- stable global identity;
- persistent continuity between sessions or documents.

## CONTRADICTED Evidence

None.

No material contradiction with the M18.1 pure model was found during M18.2.

## Guarantees

M18 guarantees only an internal scoped semantic diff policy:

- semantic diff is pure and deterministic for the same inputs and options;
- dimensions are authoritative;
- classifications are deterministic summaries;
- `EXACT` identity continuity is required for authoritative same-entity
  movement, modification, unchanged and rewired classifications;
- `EXACT` identity continuity is not semantic equality;
- `PROBABLE` never authoritatively derives `MOVED`;
- `ADDED` and `REMOVED` require entity-scoped absence proof;
- stale or incomparable inputs do not emit fake entity classifications;
- public M13/M14/M15 contracts remain unchanged.

## Non-Guarantees

M18 does not guarantee:

- public semantic diff;
- public graph identity;
- global or persistent identity;
- semantic equality;
- fuzzy matching;
- heuristic reconciliation;
- copy/paste, clone, import/reload or cross-page continuity;
- complete-document diff without complete-document coverage;
- mutation target identity;
- rollback or transaction identity.

## Capabilities Enabled For Future Work

M18 enables future design or implementation milestones for:

- internal incremental analysis;
- scoped snapshot comparison;
- changed-region analysis;
- selective recomputation;
- internal cache invalidation;
- evidence-aware Architecture Intelligence reporting;
- additional runtime experiments for currently unproven cases.

These capabilities are not implemented by M18.

## Capabilities Not Enabled

M18 does not enable:

- public MCP semantic diff tools;
- public HTTP routes;
- public WebSocket commands;
- public plugin APIs;
- public DTOs;
- global stable IDs;
- persistent IDs;
- semantic equivalence engines;
- fuzzy matching;
- heuristic entity reconciliation;
- mutation executors;
- approval workflows;
- rollback;
- transactions;
- persistence;
- watchers;
- streaming;
- chunking;
- document-wide completeness claims without coverage proof;
- LLM/provider integration;
- prompt-to-diagram expansion;
- automatic remediation;
- cross-document identity continuity.

## Security And Privacy

M18 does not expose raw XML, raw runtime snapshots, raw graph dumps, private
identity signatures, private fingerprint material, public semantic diff DTOs or
public graph identity.

Future public work must define a separate sanitization contract before exposing
labels, metadata, compared values or semantic diff summaries.

## Public Compatibility Statement

M18 does not change:

- `m13-v1`;
- `m14-v1`;
- `m15-v1`;
- MCP tool names;
- MCP schemas;
- server routes;
- plugin interfaces;
- runtime snapshot DTOs.

Semantic diff remains internal to `cyberdraw-graph-model`.

## Validation Evidence

M18.1 validation recorded:

- `pnpm install --frozen-lockfile`;
- `pnpm --filter cyberdraw-graph-model run build`;
- `pnpm --filter cyberdraw-graph-model run lint`;
- `pnpm --filter cyberdraw-graph-model run test`;
- graph-model tests: 13 suites / 327 tests after hardening;
- server build/lint/unit consumer validation.

M18.2 validation recorded:

- graph-model build/lint/test;
- server build/lint/unit tests;
- server real-environment tests;
- M18.2 focal real-environment regression evidence;
- `git diff --check`.

M18.3 is documentation-only closure. It performs Markdown/diff validation and
does not modify production code or tests.

## Residual Risks

- Future consumers may overread `EXACT` as semantic equality.
- Future work may try to expose semantic diff publicly without a public DTO and
  sanitization contract.
- Future mutation work may try to use diff output as mutation target identity.
- Copy/paste, clone, import/reload and cross-page behavior may vary by draw.io
  version and remain unproven.
- Runtime artificial ordering still changes some internal snapshot-scoped
  references even when semantic classifications remain stable.

## Follow-Up Recommended

The next roadmap milestone should be a separate, explicitly scoped Architecture
Intelligence milestone for internal incremental analysis discovery/design or
another bounded capability that uses ADR 0009 as input.

That future milestone must define its own:

- scope;
- non-goals;
- public/private boundary;
- fixtures;
- real-environment evidence;
- compatibility contract;
- ADR readiness.

## Closure Decision

M18 is closed as PASS WITH LIMITATIONS on 2026-07-30.

ADR 0009 is accepted for an internal scoped semantic diff policy. The accepted
policy is sufficient to enable future controlled design of incremental analysis
and evidence-aware Architecture Intelligence, but it does not implement or
authorize those capabilities automatically.
