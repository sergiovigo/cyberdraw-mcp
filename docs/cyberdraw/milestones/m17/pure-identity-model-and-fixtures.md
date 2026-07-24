# M17.1 - Pure Identity Model And Fixtures

## Status

COMPLETE for pure package evidence.

This slice adds an internal pure identity-correlation model and deterministic
fixtures in `cyberdraw-graph-model`. It does not integrate with runtime
snapshots, does not expose identity through MCP and does not accept ADR 0008.

## Implementation Scope

Implemented in:

- `packages/cyberdraw-graph-model/src/identity.ts`
- `packages/cyberdraw-graph-model/src/identity.test.ts`
- `packages/cyberdraw-graph-model/src/index.ts`

The implementation is pure TypeScript:

- no server imports;
- no runtime-contract imports;
- no MCP imports;
- no filesystem or network I/O;
- no mutable global state;
- no random IDs;
- no persistence;
- no mutation behavior.

The existing provisional ID helpers remain unchanged.

## Internal API

M17.1 adds these internal graph-model exports:

- `StableIdentityEntityType`
- `StableIdentityEvidence`
- `PrivateIdentitySignature`
- `IdentityMatchOutcome`
- `IdentityConflictCode`
- `IdentityMatchReasonCode`
- `IdentityCandidateMatch`
- `IdentityMatchResult`
- `createPrivateIdentitySignature()`
- `matchStableIdentity()`

The API is internal to the private graph-model package. It is not a public MCP
contract and must not be treated as stable public graph identity.

## Evidence Shape

`StableIdentityEvidence` represents one observed entity:

- `identityId`: current internal identity handle for reporting a match result;
- `entityType`: document, page, layer, element, edge or external-reference;
- `documentId`: required for exact/probable correlation;
- `pageId`: required for exact element/edge/layer/external-reference page
  context;
- `layerId`: optional context evidence for element/edge correlation;
- `rawAnchor`: observed draw.io-style anchor when available;
- `privateSignature`: optional bounded private signature evidence;
- `conflictCodes`: explicit internal evidence that prevents exact matching.

## Semantics

### EXACT

`EXACT` is produced only when:

- entity types match;
- both sides provide the same document context;
- raw anchors match;
- page context is compatible for layer, element, edge and external-reference
  entities;
- there is exactly one compatible candidate;
- neither side declares an explicit conflict.

For elements and edges, layer changes do not automatically break exact identity.
They are returned as `layer-context-changed` reason evidence because M17.0
defined layer as context evidence for movable elements, not always identity
material.

### PROBABLE

`PROBABLE` is produced only from a unique private signature match and never from
signature evidence alone as exact identity.

Signature matching is allowed when:

- the reference lacks a raw anchor;
- the candidate has the same raw anchor but context changed; or
- the reference explicitly marks the raw anchor as missing or rewritten.

This prevents two distinct raw IDs with the same content from being treated as
continuity.

### AMBIGUOUS

`AMBIGUOUS` is produced when:

- multiple candidates share the same compatible raw anchor;
- multiple candidates share the same allowed private signature;
- explicit conflict evidence prevents an otherwise exact raw-anchor match.

The implementation never selects the first candidate silently.

### NO_MATCH

`NO_MATCH` is produced when no candidate satisfies an exact or probable tier.
The result carries deterministic reason codes such as `raw-anchor-missing`,
`raw-anchor-changed`, `private-signature-changed` or
`no-compatible-candidate`.

## Fixture Matrix

| Fixture | Expected outcome | Evidence |
| --- | --- | --- |
| Same entity, equivalent snapshot | `EXACT` | Same document, page, entity type and raw anchor. |
| Reordered snapshot | `EXACT` | Candidate ordering does not affect result. |
| Moved within same layer | `EXACT` | Raw anchor wins over content/geometry change. |
| Moved across layers | `EXACT` | Element layer change is context evidence. |
| Moved across pages | `PROBABLE` | Same raw anchor plus private signature, page context changed. |
| Cloned node | `AMBIGUOUS` | Multiple candidates share missing-ID signature evidence. |
| Copied/pasted node | `NO_MATCH` | Different raw IDs with same content are not continuity. |
| Imported diagram with rewritten IDs | `PROBABLE` | Rewritten raw anchor allows unique signature evidence. |
| Duplicate IDs | `AMBIGUOUS` | Multiple same-page raw-anchor candidates. |
| Missing IDs | `NO_MATCH` | No raw anchor and no signature. |
| Same content, different entities | `NO_MATCH` | Distinct raw anchors block signature-only continuity. |
| Same ID, conflicting content/context | `AMBIGUOUS` | Explicit conflict prevents exact matching. |
| Deleted and recreated entity | `NO_MATCH` | Changed raw anchor without allowed signature evidence. |
| Renamed layer | `EXACT` | Layer raw anchor and page context are unchanged. |
| Duplicated page | `AMBIGUOUS` | Multiple matching page raw anchors. |
| Edge with same endpoints | `EXACT` | Edge raw anchor remains stable. |
| Edge endpoint change | `EXACT` | Edge identity and endpoint relation are separate. |
| External-reference evidence | `EXACT` | Scoped raw anchor matches exactly. |

## Determinism Evidence

Tests prove:

- same input produces the same result;
- candidate order does not change the result;
- object property order does not change the result;
- timestamps are not consumed by the matcher;
- private signatures are deterministic;
- result reason codes are stable and sorted.

## Collision And Ambiguity Behavior

M17.1 prefers explicit ambiguity over unsafe inference:

- duplicate raw anchors return `AMBIGUOUS`;
- duplicate private signatures return `AMBIGUOUS`;
- missing IDs without unique signature evidence return `NO_MATCH`;
- rewritten IDs can only return `PROBABLE`;
- content/signature equality cannot override distinct raw anchors;
- explicit conflict evidence prevents `EXACT`.

## Security And Privacy

`createPrivateIdentitySignature()` returns a bounded FNV-1a 64-bit digest over
caller-provided signature parts. It is deterministic and private evidence, not a
cryptographic public identifier.

Security constraints:

- raw signature material is not returned;
- material is capped by part count, per-part bytes and total bytes;
- signatures are not exported through MCP contracts;
- signatures are not persistence keys;
- labels or sensitive text should be pre-bucketed or pre-digested before being
  passed as signature parts;
- the matcher does not log or persist identity evidence.

## Compatibility

No public contracts changed:

- no M13 response fields changed;
- no M14 response fields changed;
- no M15 response fields changed;
- no new MCP tools;
- no runtime contract changes;
- no server behavior changes;
- no plugin behavior changes.

`cyberdraw-graph-model` remains private and internal.

## Evidence Produced

Local validation during M17.1:

- `pnpm --filter cyberdraw-graph-model run build`
- `pnpm --filter cyberdraw-graph-model run test`

The graph-model test run included 12 suites and 286 tests after adding the pure
identity fixtures.

## Limitations

- No runtime snapshot integration yet.
- No real draw.io evidence yet.
- No ADR 0008 decision yet.
- FNV-1a signatures are deterministic private evidence, not cryptographic public
  identifiers.
- Page moves are only probable when same raw/signature evidence exists; broader
  page-move semantics remain M17.2/M17.3 decision material.
- No semantic diff, persistence, incremental analysis or mutation execution is
  implemented.

## Remaining Work For M17.2

M17.2 should gather REAL LOCAL HTTP runtime evidence for selected cases:

- equivalent runtime snapshot;
- node move within same layer;
- node move across layers if reproducible;
- page move or documented limitation;
- clone/copy/import behavior if reproducible;
- duplicate/missing ID behavior if the harness can produce it safely;
- proof that no public M13/M14/M15 output claims stable identity.
