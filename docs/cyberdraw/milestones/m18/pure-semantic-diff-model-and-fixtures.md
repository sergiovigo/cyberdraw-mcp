# M18.1 - Pure Semantic Diff Model And Fixtures

## Status

COMPLETE / PURE MODEL EVIDENCE.

M18.1 implements a pure internal semantic diff model in
`packages/cyberdraw-graph-model`. It does not integrate with the server,
runtime snapshots, MCP tools or public DTOs.

## Implementation Scope

Implemented files:

- `packages/cyberdraw-graph-model/src/semantic-diff.ts`
- `packages/cyberdraw-graph-model/src/semantic-diff.test.ts`
- `packages/cyberdraw-graph-model/src/index.ts`

The model accepts two normalized `DiagramSnapshot` values plus optional
coverage, completeness, revision, external-reference and identity evidence. It
returns a deterministic JSON-compatible internal result.

It does not perform I/O, does not use clocks, random values, runtime state or
global mutable state and does not mutate its inputs.

## Internal API

The internal entry point is:

```ts
diffSemanticSnapshots(input: SemanticDiffInput): SemanticDiffResult
```

The result includes:

- `diffVersion`;
- `outcome`;
- `baseScope`;
- `targetScope`;
- `comparableScope`;
- `baseCompleteness`;
- `targetCompleteness`;
- `diffCompleteness`;
- `revisionStatus`;
- result-level `reasonCodes`;
- `entityResults`;
- deterministic summary counts.

Entity results include:

- `entityType`;
- `identityStatus`;
- `classifications`;
- `dimensions`;
- `baseEntityRef`;
- `targetEntityRef`;
- `reasonCodes`.

`baseEntityRef` and `targetEntityRef` are internal snapshot-scoped references.
They are not stable/global IDs, persistence keys, public identifiers or
mutation targets.

## Outcome Semantics

`SemanticDiffOutcome` is a comparison-level outcome:

- `ok`;
- `ok-with-limitations`;
- `partial`;
- `incomparable`;
- `stale`.

`incomparable` is not an entity change classification. When the comparison is
not defensible, entity classifications are absent.

M18.1 intentionally does not expose `invalid-input`. `SemanticDiffInput` is an
internal typed graph-model input; runtime validation belongs at future
integration boundaries if M18.2/M18.3 decide to wire the model to runtime data.

## Classification Semantics

`SemanticDiffClassification` is a deterministic derived summary set:

- `UNCHANGED`;
- `ADDED`;
- `REMOVED`;
- `MODIFIED`;
- `MOVED`;
- `REWIRED`;
- `AMBIGUOUS`.

The dimension matrix is authoritative. Multiple summaries may appear on the
same result when multiple dimensions change.

`UNCHANGED` requires `EXACT` identity continuity, unchanged compared dimensions
and entity-level comparable coverage for those dimensions.

`MODIFIED` requires `EXACT` identity continuity with observed/comparable
content or metadata changes.

`MOVED` requires `EXACT` identity continuity with geometry or container
changes. `PROBABLE` identity can expose candidate movement evidence and
review-required reason codes, but cannot authoritatively derive `MOVED`. The
geometry/container dimensions must be observed and comparable.

`REWIRED` applies to edge or scoped external-reference connectivity changes
under defensible identity continuity and observed/comparable connectivity. The
normative M17 case is preserved:

```text
same edge raw anchor + changed endpoints
= EXACT identity continuity + REWIRED semantic structure
```

`AMBIGUOUS` is used when identity evidence cannot support a stronger claim.

## Dimensional Model

The implemented dimensions are:

- `existence`;
- `content`;
- `geometry`;
- `container`;
- `connectivity`;
- `metadata`;
- `coverage`.

Each dimension uses one of:

- `unchanged`;
- `changed`;
- `unknown`;
- `not-applicable`;
- `not-compared`.

No global semantic equality concept is implemented. Label equality, style
equality, geometry equality and connectivity equality are only field/dimension
comparisons.

## Identity Integration

The model reuses the M17 identity semantics:

- `EXACT`;
- `PROBABLE`;
- `AMBIGUOUS`;
- `NO_MATCH`.

Identity outcome is produced by correlating base and target evidence. It is not
a property that exists independently inside either snapshot.

`EXACT` means scoped identity continuity within the domain accepted by ADR
0008. It does not mean content equality, semantic equality, persistence
stability, mutation-target stability or global identity.

Private signatures are generated through M17 identity helpers and are not
included in semantic diff results.

## ADDED / REMOVED Rules

`ADDED` requires:

- target entity observed;
- no defensible corresponding base entity;
- base comparison domain observed for that entity;
- entity belongs to the comparable scope;
- no unresolved `PROBABLE` candidate;
- no unresolved `AMBIGUOUS` candidate.

`REMOVED` is symmetric:

- base entity observed;
- no defensible corresponding target entity;
- target comparison domain observed for that entity;
- entity belongs to the comparable scope;
- no unresolved `PROBABLE` candidate;
- no unresolved `AMBIGUOUS` candidate.

`NO_MATCH` alone is not enough.

Absence is decided after forward and reverse correlation checks. This prevents
an early base-to-target `NO_MATCH` from becoming `REMOVED` when the inverse
target-to-base correlation still contains unresolved `PROBABLE` or `AMBIGUOUS`
evidence.

## Entity-Level Coverage

Before classification, M18.1 determines whether each entity is:

- observed in base coverage;
- observed in target coverage;
- within the comparable coverage domain.

Entities outside relevant coverage are retained only as unclassified
`not-compared` evidence, or omitted when the whole comparison outcome is
`stale`/`incomparable`. They are never classified as `UNCHANGED`, `MODIFIED`,
`MOVED`, `REWIRED`, `ADDED` or `REMOVED`.

Coverage dimension status comes from real coverage. It is not set to
`unchanged` merely because identity is `EXACT`.

## Scope, Coverage And Completeness

The model records:

- `baseScope`;
- `targetScope`;
- `comparableScope`;
- `baseCompleteness`;
- `targetCompleteness`;
- `diffCompleteness`.

`complete-document` is only reported when both sides carry compatible
complete-document coverage. Partial coverage remains partial. Different layer
scopes can produce `incomparable` with no entity classifications.

`complete-target-scopes` applies only to entities inside the covered target
scope. It does not prove absence for arbitrary entities present in the full
graph value but outside the observed scope.

External-reference expansion can provide connectivity/context evidence, but it
does not become complete-document coverage.

## Revision And Stale Semantics

The model distinguishes:

- `compatible`;
- `unknown`;
- `stale-base`;
- `stale-target`;
- `document-mismatch`;
- `revision-mismatch`.

Stale or incompatible comparisons do not emit fake entity classifications.
Unknown revision evidence may permit `ok-with-limitations` or `partial` with a
reason code.

## Determinism Evidence

Unit tests cover:

- repeated input produces the same JSON-compatible result;
- reordered candidates and snapshots produce equivalent results;
- object property ordering is canonicalized;
- reason codes are sorted and deduplicated;
- result ordering is canonical;
- no timestamps, clocks, random IDs or runtime state are used;
- inputs are not mutated.
- entity-level coverage prevents authoritative classifications outside observed
  comparable scopes;
- reverse `PROBABLE`/`AMBIGUOUS` evidence blocks premature
  `ADDED`/`REMOVED`.

## Fixture Matrix

| # | Case | Result |
| --- | --- | --- |
| 1 | identical snapshots | `ok`, `UNCHANGED` |
| 2 | reordered candidates/snapshots | deterministic `UNCHANGED` |
| 3 | node geometry change | `MOVED`, `geometry-changed` |
| 4 | node label change | `MODIFIED`, `content-changed` |
| 5 | node style/metadata change | `MODIFIED`, `metadata-changed` |
| 6 | node layer move | `MOVED`, `container-changed` |
| 7 | node page move | `PROBABLE`, review-required, no `MOVED` |
| 8 | node deleted | `REMOVED` only with proven absence |
| 9 | visually identical node recreated with new raw ID | not `UNCHANGED`; absence rules apply |
| 10 | node cloned | `AMBIGUOUS` |
| 11 | copy/paste | `ADDED` only without unresolved candidate |
| 12 | rewritten ID after import | `PROBABLE`, review-required, no `MOVED` |
| 13 | duplicate raw IDs | `AMBIGUOUS` |
| 14 | ambiguous identity match | `AMBIGUOUS` |
| 15 | missing raw IDs | `PROBABLE`, review-required, no `ADDED` |
| 16 | layer rename | `MODIFIED` |
| 17 | page rename | `MODIFIED` |
| 18 | edge unchanged | `UNCHANGED` |
| 19 | edge label/style changed | `MODIFIED` |
| 20 | edge endpoint changed | `REWIRED` |
| 21 | edge removed | `REMOVED` |
| 22 | edge added | `ADDED` |
| 23 | external reference target changed | `REWIRED` connectivity evidence |
| 24 | equivalent snapshots different ordering | deterministic `UNCHANGED` |
| 25 | partial scope A vs document scope B | `partial` |
| 26 | layer scope A vs different layer scope B | `incomparable`, no classifications |
| 27 | stale base revision | `stale`, no classifications |
| 28 | stale target revision | `stale`, no classifications |
| 29 | entity outside observed scope | `partial`, no absence classification |
| 30 | identical content but different identity | not `UNCHANGED`; absence rules apply |

Additional hardened coverage fixtures cover:

- partial base scope plus complete target;
- partial target scope preventing `REMOVED`;
- partial base scope preventing `ADDED`;
- `EXACT` identity outside comparable scope;
- unresolved reverse `PROBABLE`/`AMBIGUOUS` candidates;
- `complete-target-scopes` absence restricted to covered entities.

## Security And Privacy

The model is internal and does not expose:

- raw XML;
- runtime snapshot dumps;
- raw graph dumps;
- private identity signatures;
- signature material;
- arbitrary content hashes;
- public identity fields.

Tests use synthetic labels only.

## Compatibility

M18.1 changes only the graph-model package and milestone documentation. It does
not change:

- M13 public output;
- M14 public output;
- M15 create-diagram output;
- runtime contract DTOs;
- MCP tool inventory;
- server/plugin behavior.

## Relationship With M11 / M12

Semantic diff observes changes between two states. It is not an M11 change
proposal and not an M12 validation result. The implementation reuses only
general discipline around deterministic outputs, coverage and revision reason
codes.

## Relationship With Incremental Analysis

The model could later inform incremental analysis through changed/unchanged
entity sets, affected pages/layers and coverage-aware partial results. M18.1
does not implement caches, watchers, streaming, chunking, persisted state or
incremental recomputation.

## Limitations

- Runtime snapshot behavior is not proven in M18.1.
- Clone, import/reimport, reload and cross-page behavior remain pure-model
  evidence until M18.2.
- No public semantic diff contract exists.
- No ADR 0009 decision has been made.

## Readiness For M18.2

M18.2 can now validate the pure model against REAL LOCAL HTTP runtime snapshots.
It should classify each behavior as REAL-PROVEN, PARTIALLY-PROVEN, UNIT-ONLY or
UNPROVEN and should not broaden the public API.

## ADR 0009 Readiness

Status after M18.1: READY FOR DRAFT.

The pure model is coherent enough to draft ADR 0009, but runtime evidence from
M18.2 is still required before an acceptance candidate.
