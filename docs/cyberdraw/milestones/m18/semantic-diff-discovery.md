# M18.0 - Semantic Diff Discovery And Contract Design

## Status

COMPLETE / DISCOVERY EVIDENCE.

This document prepares M18.1. It does not implement a semantic diff engine, does
not change public MCP APIs, does not add persistence and does not create ADR
0009.

## Purpose

M18.0 defines the first defensible internal contract shape for comparing two
normalized CyberDraw diagram states.

The discovery question is:

```text
What does a semantic difference mean between two bounded, normalized
CyberDraw snapshots?
```

## Authoritative Sources

- `docs/cyberdraw/adr/0008-architecture-intelligence-scoped-identity-policy.md`
- `docs/cyberdraw/milestones/m17/formal-closure-m17.md`
- `docs/cyberdraw/milestones/M17-architecture-intelligence-stable-identity-foundation.md`
- `docs/cyberdraw/milestones/m17/identity-discovery.md`
- `docs/cyberdraw/milestones/m17/pure-identity-model-and-fixtures.md`
- `docs/cyberdraw/milestones/m17/runtime-snapshot-identity-evidence.md`
- `docs/cyberdraw/M0-BACKLOG.md`
- `docs/cyberdraw/rfc/0001-internal-graph-model.md`
- `docs/cyberdraw/adr/0003-internal-graph-model-architecture.md`
- `docs/cyberdraw/adr/0004-runtime-snapshot-scaling-strategy.md`
- `docs/cyberdraw/milestones/M9-internal-structural-analysis.md`
- `docs/cyberdraw/milestones/M10-internal-structural-queries.md`
- `docs/cyberdraw/milestones/M11-internal-structural-change-planning.md`
- `docs/cyberdraw/milestones/M12-internal-change-plan-validation.md`
- `packages/cyberdraw-graph-model/src/types.ts`
- `packages/cyberdraw-graph-model/src/identity.ts`
- `packages/cyberdraw-graph-model/src/structural-analysis.ts`
- `packages/cyberdraw-graph-model/src/structural-change-plan.ts`
- `packages/cyberdraw-graph-model/src/structural-change-plan-validation.ts`

## Current Semantic-Diff-Relevant Architecture

CyberDraw currently has:

- normalized internal graph snapshots: `DiagramSnapshot`, `PageSnapshot`,
  `LayerSnapshot`, `GraphElement`, `NodeElement`, `EdgeElement`,
  `GroupElement` and `UnknownElement`;
- labels, styles, geometry, metadata, parent/source/target references and
  external source references;
- structural analysis coverage, completeness and revision evidence;
- structural findings for broken references, cross-layer edges and orphans;
- deterministic query, planning and validation layers over one current analysis;
- scoped internal identity evidence from M17.

CyberDraw does not currently have:

- semantic diff result types;
- public semantic diff APIs;
- persisted diffs;
- stable global identity;
- semantic revision;
- incremental analysis;
- mutation application.

## Unit Of Comparison

| Entity | M18 participation | Rationale |
| --- | --- | --- |
| Document | Context only in M18.1 | Document identity, revisions, title and coverage are comparison metadata. Complete document equality is not yet defensible for partial scopes. |
| Page | In scope | Page name, order/index, existence and contained entity coverage are observable in `DiagramSnapshot`. |
| Layer | In scope | Layer name, visibility, lock state and owning page context are observable. |
| Node / group / unknown element | In scope | Element identity, label, style, geometry, metadata, parent, page and layer are observable. |
| Edge | In scope | Edge identity, endpoints, style, label, geometry and container context are observable. |
| External reference | In scope as scoped evidence | Expansion/reference evidence affects whether absence and connectivity changes are defensible. |
| Structural finding | Deferred | Findings are derived analysis over a state, not primary graph entities. Future work may diff findings separately. |
| Plan/proposal | Deferred | M11/M12 plans are proposals, not observed state. |

## Identity And Diff Interaction

ADR 0008 is mandatory input. `EXACT` identity continuity does not mean semantic
equality.

| Identity evidence | Semantic-diff interpretation |
| --- | --- |
| `EXACT` + same compared dimensions | `UNCHANGED` can be derived for the compared dimensions only. |
| `EXACT` + label changed | Same entity continuity; `content.changed`. Derived class `MODIFIED`. |
| `EXACT` + geometry changed | Same entity continuity; `geometry.changed`. Derived class `MOVED` only if movement semantics include geometry. |
| `EXACT` + layer changed | Same element continuity; `container.layer.changed`. Derived class `MOVED` with layer-context movement. |
| `EXACT` + page changed | Not expected under ADR 0008 exact page-compatible policy for elements/edges. If observed, treat as conflict or `AMBIGUOUS` until a future policy changes this. |
| `EXACT` edge + endpoints changed | Same edge continuity; `connectivity.changed`. Derived class `REWIRED`. This is the normative M17 example. |
| `PROBABLE` | Diff may report possible continuity and candidate movement evidence, but changes must be review-required. `PROBABLE` must not authoritatively derive `MOVED` and must not be used for definitive ADDED/REMOVED resolution. |
| `AMBIGUOUS` | Diff classification must be `AMBIGUOUS`; do not pick a candidate. |
| `NO_MATCH` | May support ADDED/REMOVED only when scope and coverage prove one side observes the relevant domain fully enough and no unresolved `PROBABLE` or `AMBIGUOUS` candidate blocks absence. Otherwise leave the entity unclassified under an `incomparable`/limited outcome or classify the entity as `AMBIGUOUS`. |

## Proposed Internal Model

M18.1 should prefer a dimensional result shape. Names are candidate internal
vocabulary, not public contract:

```ts
type SemanticDiffOutcome =
  | "ok"
  | "ok-with-limitations"
  | "partial"
  | "incomparable"
  | "stale"
  | "invalid-input";

type SemanticDiffClassification =
  | "UNCHANGED"
  | "ADDED"
  | "REMOVED"
  | "MODIFIED"
  | "MOVED"
  | "REWIRED"
  | "AMBIGUOUS";

type SemanticDiffDimensionStatus =
  | "unchanged"
  | "changed"
  | "unknown"
  | "not-applicable"
  | "not-compared";
```

Candidate entity result fields:

- `entityType`;
- `identityStatus`;
- `classification`;
- `dimensionChanges`;
- `baseEntityRef`;
- `targetEntityRef`;
- `reasonCodes`;
- `coverage`;
- optional sanitized internal detail for tests.

`baseEntityRef` and `targetEntityRef` are internal snapshot/scoped references.
They are not stable/global IDs, persistence keys, public identifiers or
mutation targets.

The dimension matrix should be authoritative; `classification` is a summary.

## Proposed Change Dimensions

| Dimension | Compared fields | Notes |
| --- | --- | --- |
| `existence` | observed on base, target or both | ADDED/REMOVED require comparable coverage, not only `NO_MATCH`. |
| `content` | page/layer names, labels, selected semantic metadata | Label text may be sensitive; public exposure remains out of scope. |
| `geometry` | x, y, width, height, relative, points/waypoints | Geometry is visual/layout evidence, not semantic equality by itself. |
| `container` | page, layer, parent/group context | Page moves remain mostly unproven; layer changes are proven for elements. |
| `connectivity` | edge source/target, parent/child references, external refs | Edge endpoint change should be a first-class dimension. |
| `metadata` | style properties, uninterpreted style, tags/custom attributes, visibility/lock | Style changes can be semantically relevant for some domains but should start as metadata. |
| `coverage` | whether the dimension is observed and comparable | Prevents overclaiming in partial scopes. |

These dimensions are sufficient for M18.1 fixtures. Domain-specific semantic
equality should be deferred.

## Classification Semantics

`UNCHANGED`:

- identity is `EXACT`;
- all compared in-scope dimensions are unchanged;
- coverage is sufficient for the compared dimensions.

`ADDED`:

- target-only entity;
- target scope observes it;
- base scope is comparable and complete enough to assert absence;
- no unresolved `PROBABLE` or `AMBIGUOUS` base candidate blocks the absence
  claim.

`REMOVED`:

- base-only entity;
- base scope observes it;
- target scope is comparable and complete enough to assert absence;
- no unresolved `PROBABLE` or `AMBIGUOUS` target candidate blocks the absence
  claim.

`MODIFIED`:

- same `EXACT` identity;
- content, metadata or non-connectivity structural facts changed;
- no stronger movement/rewire summary is the only useful summary.

`MOVED`:

- identity is `EXACT`;
- geometry, layer, parent or page context changed;
- result must include which movement dimension changed.

When identity is only `PROBABLE`, the result may expose candidate movement
evidence as review-required detail, but must not classify the entity as
`MOVED`.

`REWIRED`:

- edge identity continuity exists;
- endpoint/connectivity changed;
- same edge can also be `MODIFIED` if style/label changed.

`AMBIGUOUS`:

- identity matching is ambiguous;
- duplicate raw IDs, duplicate signatures or multiple compatible candidates
  prevent a stronger claim.

Incomparability is represented at `SemanticDiffOutcome` level. If scopes,
revisions, stale status or coverage cannot support the requested comparison,
the entity should have no derived change classification.

## ADDED And REMOVED Guardrails

`NO_MATCH` is not automatically `ADDED` or `REMOVED`.

Definitive `REMOVED` requires:

- the base entity is observed;
- no defensible corresponding target entity exists;
- target coverage is sufficient and comparable for the entity's domain;
- no unresolved `PROBABLE` or `AMBIGUOUS` candidate blocks the absence claim.

Definitive `ADDED` requires the symmetric target-observed, base-absent
conditions.

Cases that must avoid definitive ADDED/REMOVED unless coverage proves absence
and candidate ambiguity is resolved:

- rewritten IDs after import;
- copy/paste;
- cloned nodes;
- missing IDs;
- duplicate raw IDs;
- incomplete base or target scope;
- entity outside observed scope;
- stale source or target.

When absence cannot be proven, the diff outcome should be `incomparable` or
limited, or the entity classification should be `AMBIGUOUS`, with explicit
reason codes such as `outside-observed-scope`,
`identity-no-match-with-incomplete-coverage`,
`unresolved-probable-candidate` or `rewritten-id-suspected`.

## Scope And Completeness Semantics

M18.1 should define a pairwise coverage model:

- `baseScope`;
- `targetScope`;
- `baseCompleteness`;
- `targetCompleteness`;
- `comparableScope`;
- `incomparableScopeReasonCodes`;
- `diffCompleteness`.

Suggested `diffCompleteness` values:

- `complete-document`;
- `complete-target-scopes`;
- `partial`;
- `truncated`;
- `stale`;
- `incomparable`;
- `unknown`.

Rules:

- complete-document diff requires complete-document coverage on both sides;
- complete-target-scopes diff requires equivalent target scopes and non-stale
  coverage on both sides;
- layer-scope A vs different layer-scope B is not a layer diff of the same
  target; it is incomparable or target-only evidence;
- document scope B cannot prove removals from layer scope A outside the layer
  unless the comparable scope is explicit;
- external-reference expansion can provide context but must not be upgraded to
  full document coverage.

## Revision And Stale Semantics

M18 should reuse existing revision evidence:

- document ID;
- content revisions;
- document revisions;
- revision compatibility;
- coverage stale flag;
- completeness `stale`.

Proposed behavior:

- stale base: `outcome: "stale"` or `outcome: "incomparable"`;
- stale target: `outcome: "stale"` or `outcome: "incomparable"`;
- document mismatch: `outcome: "incomparable"`;
- unknown revision on either side: allow only `ok-with-limitations` or
  `partial`;
- compatible revisions: allow comparison within coverage;
- mismatched document revisions: reject as stale/incomparable rather than
  comparing silently.

## Determinism Rules

M18.1 must prove:

- same inputs and options produce byte-equivalent JSON-compatible results;
- base/target entity ordering does not affect output;
- object property order does not affect output;
- reason codes and classifications are sorted canonically;
- derived IDs, if any, are deterministic and namespace-prefixed;
- no timestamps, random IDs, clocks or runtime state;
- input snapshots are not mutated.

## Semantic Equality

M18.0 recommends deferring a broad semantic equality definition.

M18.1 should define only dimension equality for selected fields:

- label/name equality is content equality for that field, not domain semantic
  equality;
- style equality is metadata equality, not proof of meaning;
- geometry equality is visual/layout equality, not proof of meaning;
- connectivity equality means same observed references, not proof of domain
  architecture equivalence.

Domain semantic equality should wait for future profiles or rule systems.

## Security And Privacy

M18 must keep the first model internal:

- no raw XML;
- no raw runtime snapshots;
- no raw graph dumps;
- no private signatures or signature material in public responses;
- no arbitrary content hashes in public DTOs;
- no labels in public outputs;
- no filesystem paths, hostnames, stack traces or plugin internals.

Pure tests may use controlled fixture labels. Runtime evidence docs should
summarize observed behavior without recording sensitive live labels.

## Public / Private Boundary

Recommendation: pure/internal first.

Rationale:

- RFC 0001 and ADR 0003 keep graph-model schemas private;
- M9-M12 started internal before M13/M14 exposed a bounded read-only wrapper;
- semantic diff has unresolved coverage, scope and privacy questions;
- public consumers could easily overread `EXACT` as semantic equality;
- there is no accepted public DTO or reason-code registry for diff.

M18 should not add a public MCP tool. Public exposure, if ever needed, should be
a later milestone after pure and runtime evidence.

## Relationship With M11 / M12

Semantic diff must remain independent from change planning.

Shared concepts allowed:

- document/revision evidence;
- coverage/completeness;
- structural target identity vocabulary;
- deterministic ID/reason-code practices.

Concepts not to reuse as the diff contract:

- M11 proposal types;
- M11 abstract operations;
- M11 policy flags;
- M12 validation outcomes.

Observed diff answers "what changed". M11/M12 answer "what could be proposed"
and "whether a proposal is still internally valid".

## Relationship With Incremental Analysis

M18 may support future incremental analysis by producing:

- changed entity sets;
- unchanged proof for exact identities;
- affected pages/layers;
- stale/incomparable classifications;
- coverage-aware partial results.

M18 must not implement:

- cached analysis state;
- watcher loops;
- chunking or streaming;
- incremental recomputation;
- persisted diff history.

## Discovery Case Matrix

| # | Case | Identity evidence | Observable semantic change | Defensible classification | Ambiguity | Evidence today | Need for M18.1/M18.2 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Snapshots identical | `EXACT` for all comparable entities | none | `UNCHANGED` | Low | Unit identity and graph fixtures exist | M18.1 fixture enough |
| 2 | Candidates reordered | `EXACT` if anchors/context match | none | `UNCHANGED` | Low | M17.1 reorder tests | M18.1 determinism fixture |
| 3 | Node geometry change | `EXACT` real-proven | geometry changed | `MOVED` with geometry dimension | Low | M17.2 REAL-PROVEN | M18.1 + M18.2 real regression |
| 4 | Node label change | `EXACT` real-proven | content changed | `MODIFIED` | Low | M17.2 REAL-PROVEN | M18.1 fixture; M18.2 optional |
| 5 | Node style/metadata change | likely `EXACT` if anchor preserved | metadata changed | `MODIFIED` | Medium for style semantics | Style fields exist; real proof not specific | M18.1 fixture; M18.2 if practical |
| 6 | Node layer move | `EXACT` with `layer-context-changed` | container layer changed | `MOVED` with container dimension | Low | M17.2 REAL-PROVEN | M18.1 + M18.2 real regression |
| 7 | Node page move | not exact under ADR 0008; maybe `PROBABLE` | candidate container page changed | review-required candidate movement evidence only; otherwise `AMBIGUOUS` | High | M17.2 PARTIALLY/UNPROVEN | M18.1 fixture; M18.2 only if harness can prove |
| 8 | Node deleted | base exact entity has no target match | existence changed | `REMOVED` only with comparable target coverage and no unresolved probable/ambiguous target candidate | Medium | M17.2 delete/recreate no-match | M18.1 fixture; M18.2 real delete if practical |
| 9 | Visually identical node recreated with new raw ID | `NO_MATCH` real-proven; possible visual candidate | existence old removed/new added only if coverage proves absence and candidate ambiguity is resolved | `REMOVED` + `ADDED` only if no unresolved probable/ambiguous candidate; otherwise `AMBIGUOUS` | High | M17.2 REAL-PROVEN no-match | M18.1 fixture; M18.2 real regression |
| 10 | Node cloned | distinct raw anchors or ambiguous signatures | target has extra visual peer | `ADDED` only if base coverage and candidate ambiguity prove it is new; otherwise `AMBIGUOUS` | High | M17.2 partial copy-page only | M18.1 fixture; M18.2 likely limitation |
| 11 | Copy/paste | distinct/new raw anchor likely | target-only visual peer | `ADDED` only if no unresolved probable/ambiguous source candidate; otherwise `AMBIGUOUS` | High | UNPROVEN real | M18.1 fixture; M18.2 if harness supports |
| 12 | Rewritten ID after import | `PROBABLE` at best via signature | unknown lineage; possibly same visual structure | review-required probable evidence or `AMBIGUOUS`; not `MOVED`, not definitive ADDED/REMOVED | High | M17.1 unit only | M18.1 fixture; M18.2 likely unproven |
| 13 | Duplicate raw IDs | `AMBIGUOUS` | unknown | `AMBIGUOUS` | High | M17.1 unit | M18.1 fixture enough |
| 14 | Ambiguous identity match | `AMBIGUOUS` | unknown | `AMBIGUOUS` | High | M17.1 unit | M18.1 fixture enough |
| 15 | Missing raw IDs | `NO_MATCH` or `PROBABLE` via unique signature | unknown or changed | `AMBIGUOUS` or review-required probable evidence; no definitive ADDED/REMOVED while probable/ambiguous candidates remain | Medium | M17.1 unit | M18.1 fixture enough |
| 16 | Layer rename | `EXACT` real-proven | content/name changed | `MODIFIED` | Low | M17.2 REAL-PROVEN | M18.1 + M18.2 real regression |
| 17 | Page rename | `EXACT` if page anchor preserved | content/name changed | `MODIFIED` | Low/medium | Page types support it; real proof not specific | M18.1 fixture; M18.2 if practical |
| 18 | Edge unchanged | `EXACT` real-proven | none | `UNCHANGED` | Low | M17.2 REAL-PROVEN | M18.1 + M18.2 real regression |
| 19 | Edge label/style changed | `EXACT` if anchor preserved | content/metadata changed | `MODIFIED` | Medium | Types support label/style | M18.1 fixture; M18.2 if practical |
| 20 | Edge endpoint changed | `EXACT` real-proven | connectivity changed | `REWIRED` | Low | M17.2 REAL-PROVEN | M18.1 + M18.2 real regression |
| 21 | Edge removed | base edge unmatched | existence changed | `REMOVED` only with comparable target coverage and no unresolved probable/ambiguous edge candidate | Medium | M17/M9 cover broken refs, not diff | M18.1 fixture; M18.2 if practical |
| 22 | Edge added | target edge unmatched | existence changed | `ADDED` only with comparable base coverage and no unresolved probable/ambiguous edge candidate | Medium | No diff engine yet | M18.1 fixture; M18.2 if practical |
| 23 | External reference target changed | scoped external-reference identity may be exact or changed | connectivity/context changed | `REWIRED`/`MODIFIED` or `AMBIGUOUS` | Medium/high | M17.2 repeated external ref only | M18.1 fixture; M18.2 targeted real if feasible |
| 24 | Equivalent snapshots with different ordering | `EXACT` | none | `UNCHANGED` | Low | M17.1 unit | M18.1 fixture |
| 25 | Partial scope A vs document scope B | identity may match subset | only scoped subset comparable | `partial` result; no complete-document claims | Medium | M14/M16 coverage evidence | M18.1 coverage fixture |
| 26 | Layer scope A vs different layer scope B | incomparable target scopes | none defensible for same target | no entity classification; comparison outcome `incomparable` or target-only limited evidence | High | M14 scope model evidence | M18.1 coverage fixture |
| 27 | Stale base revision | identity evidence stale | comparison invalid | no entity classification; comparison outcome `stale` | High | M16 stale evidence | M18.1 fixture; M18.2 if reproducible |
| 28 | Stale target revision | identity evidence stale | comparison invalid | no entity classification; comparison outcome `stale` | High | M16 stale evidence | M18.1 fixture; M18.2 if reproducible |
| 29 | Entity outside observed scope | no observation | absence not provable | no entity classification; comparison outcome `incomparable` or partial with limitation | High | M9/M14 coverage semantics | M18.1 coverage fixture |
| 30 | Identical content but different identity | `NO_MATCH` or distinct `EXACT` identities | content same, lineage differs | not `UNCHANGED`; ADDED/REMOVED only if coverage proves absence and no unresolved probable/ambiguous candidate remains | High | M17.1 and M17.2 delete/recreate | M18.1 fixture |

## Proposed M18.1 Entry Criteria

M18.1 should start only when this discovery is accepted and should implement:

- pure internal types for base/target snapshot inputs and diff result;
- closed dimension statuses and reason codes;
- identity integration through M17 `matchStableIdentity()`;
- coverage/completeness inputs for base and target;
- stale/revision checks;
- deterministic ordering and optional deterministic IDs;
- fixtures for all 30 discovery cases where pure evidence is enough;
- explicit UNPROVEN markers for cases requiring M18.2 runtime evidence.

M18.1 must not add server integration, public MCP tools, persistence, mutation,
incremental analysis or ADR acceptance.

## Proposed M18 Sub-Milestones

The proposed structure is accepted for planning:

- M18.0 - Semantic Diff Discovery And Contract Design;
- M18.1 - Pure Semantic Diff Model And Fixtures;
- M18.2 - Runtime Snapshot Semantic Diff Evidence;
- M18.3 - ADR Decision And Closure.

This keeps the MVP narrow: discovery first, pure model second, real evidence
third, ADR/closure last.

## ADR 0009 Readiness

Status: NOT READY.

Candidate future ADR:

```text
ADR 0009 - Architecture Intelligence Semantic Diff Policy
```

M18.0 produces a candidate contract design only. ADR 0009 should not be drafted
or accepted until M18.1 proves the pure model and M18.2 records runtime
evidence for the subset of cases that the draw.io harness can honestly prove.

## Residual Risks

- Future consumers may still overread `EXACT` identity as semantic equality.
- ADDED/REMOVED can be overclaimed if coverage is incomplete.
- Style and label differences may expose sensitive content if public output is
  designed prematurely.
- Page moves, import/reimport and copy/paste remain weak real-evidence areas.
- A single summary classification can hide multiple simultaneous dimensions.
- Public exposure before pure/runtime evidence would likely create a brittle
  contract.

## Recommendation

Proceed to M18.1 with a pure/internal semantic diff model and fixtures.

The recommended M18.1 model should:

- consume `DiagramSnapshot` plus explicit base/target coverage and revision
  evidence;
- use ADR 0008 identity matching;
- report dimensional changes as the authoritative result;
- derive classifications only as summaries;
- preserve partial/stale/incomparable states;
- keep all output internal and sanitized;
- defer public MCP exposure, persistence, execution and incremental analysis.
