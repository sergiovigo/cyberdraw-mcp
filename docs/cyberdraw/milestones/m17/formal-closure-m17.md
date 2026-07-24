# M17 - Formal Closure

## Status

COMPLETE / CLOSED.

## Verdict

PASS WITH LIMITATIONS.

M17 closes with ADR 0008 accepted as a scoped internal identity policy. The
milestone does not create public graph identity, stable global identity,
persistence keys, mutation identifiers or a semantic diff contract.

## Scope Delivered

M17 delivered:

- discovery of current provisional identity assumptions and consumers;
- a pure internal identity model in `cyberdraw-graph-model`;
- deterministic fixtures for `EXACT`, `PROBABLE`, `AMBIGUOUS` and `NO_MATCH`;
- REAL LOCAL HTTP runtime snapshot evidence for the narrow supported identity
  domain;
- ADR 0008, "Architecture Intelligence Scoped Identity Policy";
- this formal closure record.

## M17.0 Result

M17.0 recorded current-state identity behavior, consumer assumptions, candidate
policies and edge cases in
`docs/cyberdraw/milestones/m17/identity-discovery.md`.

Preferred candidate: hybrid raw anchor plus context plus private signature plus
explicit match status.

M17.0 did not implement code and did not create ADR 0008.

## M17.1 Result

M17.1 added the pure internal model and fixtures:

- `packages/cyberdraw-graph-model/src/identity.ts`;
- `packages/cyberdraw-graph-model/src/identity.test.ts`;
- `docs/cyberdraw/milestones/m17/pure-identity-model-and-fixtures.md`.

The model remains pure and internal. It does not depend on runtime snapshots,
MCP, filesystem, network or global state.

## M17.2 Result

M17.2 added REAL LOCAL HTTP runtime evidence:

- test file:
  `packages/drawio-mcp-server/src/real-environment/m17-runtime-identity-evidence.test.ts`;
- evidence doc:
  `docs/cyberdraw/milestones/m17/runtime-snapshot-identity-evidence.md`.

The real evidence uses Chromium, draw.io served by the repository, the real
plugin, the real server runtime WebSocket and real runtime snapshot extraction.
It is not HTTPS/Caddy evidence.

## M17.3 Result

M17.3 accepts ADR 0008:

```text
docs/cyberdraw/adr/0008-architecture-intelligence-scoped-identity-policy.md
```

The ADR accepts only a scoped internal identity policy. It deliberately avoids
the phrase stable global identity.

## Acceptance Criteria Matrix

| Criterion | Status | Evidence | Limitation |
| --- | --- | --- | --- |
| Candidate policies documented with tradeoffs | PASS | M17.0 discovery | None. |
| Identity domain and scope defined | PASS | ADR 0008, M17.1, M17.2 | Domain is scoped, not global. |
| Selected policy or explicit rejection recorded | PASS | ADR 0008 accepted scoped policy | Broad/global identity rejected. |
| Deterministic equivalent input behavior proven | PASS | M17.1 identity fixtures | Pure evidence only for synthetic fixtures. |
| Ambiguity represented, never silently guessed | PASS | M17.1 fixtures and ADR 0008 | Future consumers must preserve this. |
| Fixtures cover moves, clones, import rewrites, duplicate IDs, missing IDs and reorder | PASS | M17.1 fixture matrix | Some scenarios remain unit-only. |
| Public M13/M14/M15 contracts unchanged | PASS | M17.1 and M17.2 compatibility notes | No public identity fields added. |
| No public stable global identity claim | PASS | ADR 0008 and closure non-guarantees | None. |
| No persistence or mutation coupling | PASS | No production mutation or persistence changes | Future milestones must decide separately. |
| Real-snapshot evidence recorded before closure | PASS WITH LIMITATION | M17.2 REAL LOCAL HTTP evidence | Not HTTPS/Caddy; not broad import/reload/clone evidence. |
| Durable identity decision recorded in ADR only when supported by evidence | PASS WITH LIMITATION | ADR 0008 accepted scoped policy | Unsupported domains remain non-guaranteed. |

## Guarantees

M17 guarantees only this:

Within the accepted scoped internal identity domain, `EXACT` means continuity of
a qualified anchor, not semantic equality, content equality, persistent
identity, global identity or mutation target safety.

The proven runtime subset includes:

- repeated snapshots in one runtime lifecycle;
- geometry changes;
- layer moves;
- label/content edits;
- layer renames;
- unchanged edges;
- edge endpoint changes;
- delete/recreate no-match behavior;
- repeated scoped external-reference metadata.

## Non-Guarantees

M17 does not guarantee:

- true node copy/paste continuity;
- arbitrary clone continuity;
- runtime reload/reopen continuity;
- true page move continuity;
- import/reimport continuity with rewritten IDs;
- cross-document continuity;
- global stability;
- public identity;
- persistence keys;
- mutation targets;
- semantic equality.

## Security And Privacy

Private identity signatures are bounded internal evidence. They are based on
FNV-1a 64-bit, are deterministic, are not cryptographic and are not security
primitives.

M17 does not expose signatures, identity evidence, raw XML, raw graph data or
runtime snapshots through public MCP responses.

## Public Compatibility Statement

M17 does not change:

- `m13-v1`;
- `m14-v1`;
- `m15-v1`;
- public MCP tool names;
- public MCP schemas;
- runtime snapshot contract shape;
- plugin/server transport contract.

Architecture Intelligence remains read-only.

## Validation Evidence

M17.1 validation recorded:

- `pnpm --filter cyberdraw-graph-model run build`;
- `pnpm --filter cyberdraw-graph-model run test`;
- graph-model tests: 12 suites / 286 tests.

M17.2 validation recorded:

- server build/lint/format;
- server unit tests: 34 suites / 446 tests;
- server real-environment tests: 18 suites / 45 tests;
- M17.2 focal real test: 1 suite / 1 test.

M17.3 performs documentation closure and reruns the required validation.

## Residual Risks

- Future semantic diff may overread `EXACT` as semantic equality.
- Future mutation work may try to use `PROBABLE` or signatures as target
  identity.
- Import/reload/copy/paste behavior may differ across draw.io versions and
  remains unproven.
- Private signature material may contain sensitive data unless future callers
  bucket, digest or omit sensitive fields before constructing it.

## Deferred Items

Separate future milestones are required for:

- semantic diff;
- incremental analysis;
- persistence or review sessions;
- public graph identity/schema;
- mutation execution;
- approval workflows;
- rollback or transactions;
- broader real import/reload/copy-paste identity evidence.

## Closure Decision

M17 is closed as PASS WITH LIMITATIONS.

ADR 0008 is accepted for a scoped internal identity policy only. The accepted
policy is sufficient to unblock design work for semantic diff and incremental
analysis, but it does not authorize implementation of those capabilities.
