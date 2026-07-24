# M17.0 - Identity Discovery And Candidate Policy

## Status

COMPLETE / DISCOVERY EVIDENCE.

This document records M17.0 discovery evidence. It does not implement identity
code, does not add tests, does not create a public schema and does not accept
ADR 0008.

## Purpose

M17.0 audits the current provisional Architecture Intelligence identity policy
and recommends a candidate policy for M17.1. The goal is an internal policy
stable enough to correlate entities between snapshots within explicit limits,
without turning identity into a public graph identity, persistence key, mutation
identifier or semantic diff contract.

## Authoritative Sources

- `docs/cyberdraw/milestones/M17-architecture-intelligence-stable-identity-foundation.md`
- `docs/cyberdraw/adr/0003-internal-graph-model-architecture.md`
- `docs/cyberdraw/adr/0004-runtime-snapshot-scaling-strategy.md`
- `docs/cyberdraw/spikes/0001-internal-graph-readonly.md`
- `packages/cyberdraw-graph-model/src/identity.ts`
- `packages/cyberdraw-graph-model/src/normalize.ts`
- `packages/cyberdraw-graph-model/src/scoped-snapshot-merge.ts`
- `packages/cyberdraw-graph-model/src/runtime-snapshot-adapter.ts`
- `packages/cyberdraw-graph-model/src/structural-analysis.ts`
- `packages/cyberdraw-graph-model/src/structural-change-plan.ts`
- `packages/cyberdraw-graph-model/src/structural-change-plan-validation.ts`
- `packages/drawio-mcp-server/src/cyberdraw-hierarchical-snapshot.ts`

## Current State Summary

The current policy is intentionally provisional. It preserves observed draw.io
IDs where available and derives deterministic internal IDs from document, page,
layer, element and appearance-index context. ADR 0003 explicitly says this
policy is deterministic only for the same normalized input order and is not
stable across page moves, clones or imports. ADR 0004 keeps incremental analysis
deferred until a stable identity decision exists.

The current implementation is good enough for:

- deterministic normalization of one snapshot;
- page-scoped duplicate detection;
- graph indexes and local reference resolution;
- scoped snapshot merge/dedupe inside compatible revision and scope evidence;
- structural findings, query results, non-executable plans and validations tied
  to current snapshot evidence.

It is not sufficient for:

- durable cross-snapshot identity;
- stable global identity;
- persistence;
- semantic diff;
- mutation targets;
- silent recovery from duplicates, missing IDs or rewritten imports.

## Current Identity Inventory

| Entity type | Current identifier source | Namespace / scope | Deterministic? | Stable across same snapshot? | Stable across equivalent snapshot? | Stable across reorder? | Stable across layer move? | Stable across page move? | Stable across clone/import? | Collision / missing-ID behavior | Downstream consumers |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Document | `provisionalDiagramId(documentId)` -> `diagram:drawio:<documentId>` or synthetic fallback | Snapshot document source | Yes for same input | Yes | Only if same document ID is present | Mostly yes | N/A | N/A | No guarantee | Missing document ID becomes `diagram:synthetic:readonly-spike`; not globally unique | normalization, analysis revision evidence, merge compatibility, plan validation |
| Page | `page:<index>:drawio:<pageExternalId>` or `page:<index>:synthetic` | Page index plus observed page ID | Yes | Yes | Only if index and page ID match | No if page order/index changes | N/A | No | No guarantee | Missing ID uses synthetic index; duplicate page IDs are not a stable global key | page indexes, scope mapping, merge, coverage, findings, public summaries |
| Layer | `layer:<pageInternalId>:drawio:<layerExternalId>:<appearanceIndex>` or synthetic | Owning page plus layer ID plus appearance index | Yes | Yes | Only if page identity, layer ID and layer order match | No if appearance index changes | A renamed layer can remain stable if ID/order remain; a moved layer changes through page context | No | No guarantee | Missing ID uses synthetic appearance index; duplicate IDs are disambiguated only by order | layer lookup, layer scopes, cross-layer analysis, coverage |
| Vertex/node | `element:<pageInternalId>:drawio:<drawioId>:<appearanceIndex>` or synthetic | Owning page plus draw.io element ID plus appearance index | Yes | Yes | Only if page identity, element ID and duplicate order match | No for duplicate/missing-ID reorder | Often yes if page and duplicate appearance index stay stable; layer is not part of current element internal ID | No | No guarantee | Duplicate IDs emit diagnostics; missing IDs use synthetic appearance index; ambiguous refs are not guessed | graph indexes, findings, queries, plan targets, validation |
| Edge | Same provisional element identity as nodes; endpoint refs resolve to element internal IDs | Owning page plus edge draw.io ID plus appearance index; endpoints are separate refs | Yes | Yes | Only if edge ID/page/order match | No for duplicate/missing-ID reorder | Edge identity may stay while endpoint/layer relation changes | No | No guarantee | Duplicate/missing behavior same as element; missing source/target preserved or diagnosed | broken-reference analysis, cross-layer analysis, plan targets |
| External reference | Runtime snapshot `scope.externalReferences` with page, element, referenced ID and optional referenced page/layer | Snapshot scope evidence, not a normalized entity ID | Yes as data | Yes | Only if runtime emits same reference evidence | No guarantee | Depends on referenced page/layer evidence | Depends on referenced page evidence | No guarantee | Missing target becomes unresolved expansion evidence; duplicate expansion scopes deduped by scope key | hierarchical expansion, merge diagnostics, structural analysis external context |

Important observed tension: normalized element identity is page-qualified but not
layer-qualified, while scoped snapshot merge currently deduplicates runtime
elements by page, layer and element ID. M17.1 must decide whether layer context
is identity material, correlation evidence or merge-only scope context.

## Consumer Analysis

| Consumer | Identity assumption | Failure mode | Severity | Stable identity actually required? |
| --- | --- | --- | --- | --- |
| `normalizeDiagram` page/layer/element construction | Provisional IDs are deterministic for bounded canonical input. | Reordered pages, layers or duplicate elements can change synthetic or appearance-index IDs. | Medium for cross-snapshot correlation; low for single-snapshot analysis. | No for one snapshot; yes for future correlation. |
| Reference resolution in `normalize.ts` | References are resolved by page-scoped external IDs and only accepted when exactly one match exists. | Duplicate IDs produce `ambiguous_drawio_reference`; missing IDs produce missing-reference findings. | Low for safety, because it fails closed; high for future matching if unresolved. | No for current analysis; yes for semantic diff/incremental analysis. |
| Graph indexes | `internalId` is unique inside one normalized snapshot; `drawioId` may map to many internal IDs. | Consumers using `byDrawioId` as unique can pick wrong candidate. | Medium. | Requires only snapshot-local uniqueness today. |
| Scoped snapshot merge | Pages dedupe by page ID; layers by layer ID; elements by page, layer and element ID. | Layer move can look like two distinct elements in merged scoped snapshots; duplicate/missing element IDs collapse only by merge key. | Medium. | Needs stronger evidence if merge is reused for cross-snapshot correlation. |
| Hierarchical external-reference expansion | Runtime external reference IDs can resolve to page/layer scopes through inventory. | Missing target remains unresolved; duplicate scope is deduped; no semantic matching. | Low for current bounded expansion. | No, but future correlation must not treat expansion as identity proof. |
| Structural analysis | Findings use internal IDs, page IDs and layer IDs for deterministic output. | Finding IDs and targets can change when provisional IDs change. | Medium for repeat comparisons; acceptable for current read-only output. | Not for one response; yes for diff/history. |
| Structural queries | Filtering and ordering operate on current analysis IDs and finding IDs. | Replayed queries against a changed snapshot may not select the same conceptual entity. | Medium. | Not beyond current analysis result. |
| Structural planning | Plan target identity includes element/edge IDs plus page/layer context and preconditions. | Plan can be invalidated when target identity or page/layer context changes; probable matches are not represented. | High if future execution uses it naively; current plans are non-executable. | Yes before any execution milestone. |
| Plan validation | Rechecks document/revision/finding/target identity and reports stale/not-verifiable/mismatch. | Cannot recover rewritten IDs; may reject valid conceptual moves. | Medium, conservative. | Yes for future execution, no for current validation-only behavior. |
| Public M13/M14 mapping | Public responses expose sanitized findings/results but do not promise public stable graph identity. | Users may infer IDs are stable across revisions if docs are unclear. | Medium documentation risk. | No public stable identity should be claimed. |

## Candidate Policies

### A. Raw draw.io ID Anchoring

Semantics: treat observed draw.io IDs as the primary identity key for pages,
layers, elements and edges when present.

Strengths:

- simple and close to the editor runtime;
- strong for ordinary edits that preserve IDs;
- cheap to compute and easy to debug internally.

Weaknesses:

- duplicate IDs exist and are already diagnosed;
- missing IDs exist and are already represented synthetically;
- imports, copy/paste and clones can rewrite IDs;
- raw element IDs alone can collide across pages or documents;
- does not provide honest behavior for page/layer moves.

Collision model: exact only when ID is unique inside the accepted entity scope.
Duplicate IDs must degrade to `AMBIGUOUS`, not first-match.

Missing-ID behavior: `NO_MATCH` unless a separate signature policy produces a
unique `PROBABLE` candidate.

Suitability: useful as an anchor, insufficient as the whole policy.

### B. Page-Qualified Raw ID

Semantics: match elements and edges by compatible document lineage plus page
identity plus raw draw.io ID uniqueness.

Strengths:

- matches the current graph-model element identity shape;
- prevents accidental cross-page matches;
- aligns with M13/M14 scoped analysis behavior;
- avoids treating page moves as silent continuity.

Weaknesses:

- page moves become identity breaks unless another signal links them;
- page index in the current provisional page ID makes reorder sensitive;
- duplicate page IDs or rewritten page IDs remain unresolved.

Collision model: exact only when page identity is exact and the element ID is
unique on that page.

Missing-ID behavior: no exact match.

Suitability: strong baseline for M17.1 exact matching in bounded scopes.

### C. Page + Layer Qualified Raw ID

Semantics: match elements by compatible document lineage, page identity, layer
identity and raw draw.io ID.

Strengths:

- precise for layer-scoped analysis;
- aligns with scoped snapshot merge's current element dedupe key;
- prevents confusing same-ID nodes on different layers.

Weaknesses:

- moving an element between layers becomes a new identity;
- layer rename/reorder/move can invalidate element identity;
- too strict for future semantic diff if "moved layer" is a meaningful change.

Collision model: exact only when page, layer and raw ID are unique.

Missing-ID behavior: no exact match.

Suitability: good as context evidence and merge key; too strict as the only
element identity policy.

### D. Structural / Content Signature

Semantics: compute a deterministic private signature from selected structural
facts such as entity type, approximate geometry, normalized style features,
bounded label digest and neighborhood hints.

Strengths:

- can correlate some missing-ID or rewritten-ID cases;
- useful for imports and equivalent snapshots where raw IDs changed;
- can support future semantic diff if kept probabilistic.

Weaknesses:

- similar nodes can collide;
- labels and metadata may contain sensitive data;
- geometry/layout changes can cause false negatives;
- a signature alone cannot prove entity continuity.

Collision model: exact never by signature alone; unique strong signatures may
support `PROBABLE`, while multiple candidates are `AMBIGUOUS`.

Missing-ID behavior: possible `PROBABLE` only if unique within a bounded scope.

Suitability: useful as an assist, unsafe as a primary exact identity.

### E. Hybrid Raw ID + Context + Signature + Confidence

Semantics: combine raw draw.io anchors, qualified page/layer context,
document/revision lineage and optional private signatures, returning closed match
statuses instead of forcing one identity string to answer every question.

Strengths:

- keeps exact matches conservative;
- explicitly represents uncertainty;
- supports imports/moves without silent guessing;
- gives future semantic diff and incremental analysis a defensible foundation.

Weaknesses:

- more complex than current provisional IDs;
- requires careful fixtures for ambiguity and false-positive cases;
- signatures must be bounded and private.

Collision model: exact requires compatible lineage and unique anchors; probable
requires unique secondary evidence; ambiguity is explicit.

Missing-ID behavior: exact is unavailable; probable may be available only under
strict bounded uniqueness.

Suitability: preferred candidate for M17.1.

## Match Semantics

M17.1 should use a closed internal result shape with at least these statuses:

- `EXACT`: evidence is sufficient to correlate the same entity inside the
  declared identity domain. Minimum evidence is compatible document lineage,
  same entity type, unique raw anchor and non-contradictory page/layer context.
- `PROBABLE`: evidence suggests continuity but does not prove it. This can use a
  unique private signature or move evidence, but downstream consumers must treat
  it as review-required.
- `AMBIGUOUS`: two or more candidates satisfy the same policy tier, or duplicate
  raw IDs/signatures prevent safe selection.
- `NO_MATCH`: no candidate satisfies any allowed policy tier.

Additional reason qualifiers should remain internal, for example:

- duplicate raw ID;
- missing raw ID;
- rewritten/imported ID suspected;
- page context changed;
- layer context changed;
- signature collision;
- insufficient coverage;
- stale or incompatible revision evidence.

Cases that must never auto-resolve:

- duplicate raw IDs with more than one candidate;
- cloned nodes with identical content;
- same label/geometry but distinct raw IDs;
- imported diagrams with wholesale ID rewrites unless a bounded unique signature
  only yields `PROBABLE`;
- stale snapshots;
- page/layer moves when the policy cannot distinguish move from delete/create.

## Edge-Case Matrix

| Case | Expected identity outcome | Confidence | Ambiguity risk | Recommended policy behavior |
| --- | --- | --- | --- | --- |
| Move within same layer | `EXACT` if raw element ID, page and entity type remain unique; otherwise `PROBABLE` or `NO_MATCH` | High with preserved ID | Low unless duplicate ID exists | Preserve exact raw-anchor match; record geometry/content change separately later |
| Move across layers | `EXACT` if element ID and page are unique and layer is context, not identity; `PROBABLE` if layer-qualified policy is required | Medium | Medium | Treat layer as context evidence for element correlation; flag layer-context change |
| Move across pages | `NO_MATCH` under page-qualified exact policy; possible `PROBABLE` only with explicit unique signature evidence | Low to medium | High | Do not silently preserve exact identity across page moves in M17.1 |
| Clone | `AMBIGUOUS` or separate exact identities if raw IDs are distinct | Low for content; high for lineage | High | Never use identical content as exact continuity |
| Copy/paste | Same as clone; exact only for unique preserved raw ID, otherwise `AMBIGUOUS`/`NO_MATCH` | Low | High | Treat as new entity unless anchors prove otherwise |
| Import with rewritten IDs | `NO_MATCH` by raw policy; `PROBABLE` only for unique bounded signature | Low to medium | High | Use signature only as review-required evidence |
| Duplicate IDs | `AMBIGUOUS` for affected scope | None for exact | High | Preserve diagnostics and never pick first candidate |
| Missing IDs | `NO_MATCH` for exact; maybe `PROBABLE` via unique signature | Low | Medium | Synthetic appearance IDs are snapshot-local only |
| Reordered snapshot input | `EXACT` for unique raw IDs if page IDs and indexes remain compatible; synthetic/duplicate appearance IDs may change | Medium | Medium | M17.1 fixtures must prove canonical ordering or document limitations |
| Equivalent snapshot with stable IDs | `EXACT` for unique raw anchors in compatible context | High | Low | Primary happy path for M17.1 |
| Structurally similar but distinct nodes | Separate exact IDs if raw IDs differ; otherwise `AMBIGUOUS` | Low by signature alone | High | Signature must not collapse similar nodes |
| Same IDs, different content | `EXACT` anchor with change evidence only if lineage/context are compatible and duplicate-free | Medium | Medium | Identity and content equality must remain separate concepts |
| Deleted/recreated node | `NO_MATCH` if raw ID changed; `PROBABLE` only if unique signature and policy allows review-required continuity | Low | High | Avoid exact continuity unless runtime preserves ID |
| Edge endpoint changes | Edge can remain `EXACT` if edge raw ID is unique; endpoint identities become changed context | Medium | Medium | Correlate edge separately from endpoint relation |
| Renamed layer | `EXACT` if layer raw ID and page are unchanged | High | Low | Name is content/context, not primary identity |
| Duplicated page | `AMBIGUOUS` if page IDs/content collide; separate exact page identities if runtime gives distinct IDs | Low to medium | High | Page identity must include lineage and unique page anchor |
| External-reference expansion | `EXACT` only for the referenced page/layer/element after normal policy resolution | Medium | Medium | Expansion evidence is scope/context, not standalone identity proof |

## Security And Privacy

Identity evidence can accidentally become sensitive. M17.1 must keep identity
material internal and avoid public or logging leakage.

Findings:

- Raw draw.io IDs are less sensitive than labels but still should not become
  public stable identifiers.
- Labels, HTML labels, URLs, hostnames, metadata and style strings may contain
  sensitive data. If used in signatures, use bounded private digests or feature
  buckets, not raw values.
- Signature construction must be deterministic and bounded to avoid denial of
  service from huge labels, metadata or many near-duplicate candidates.
- Identity values must not be persisted by default and must not become implicit
  authorization or mutation targets.
- Public M13/M14/M15 responses must not claim stable identity or expose raw
  graph/snapshot internals.
- Logs should report only safe metadata: entity counts, status, reason
  qualifiers and bounded diagnostic codes.

## Preferred Candidate Policy

The recommended M17.1 candidate is:

Hybrid scoped identity with confidence:

1. Preserve raw draw.io anchors as the strongest internal evidence.
2. Qualify exact matches by compatible document lineage, entity type and page
   context.
3. Treat layer as context evidence for element identity, not always as identity
   material, so same-page layer moves can be represented without silently
   creating a different conceptual entity. For layer entities themselves, page
   context remains identity material.
4. Use private structural/content signatures only as secondary evidence for
   `PROBABLE` matches, never as `EXACT` by themselves.
5. Represent duplicate, missing, rewritten and stale cases explicitly.
6. Keep all identity correlation results internal.

## Stability Guarantees

The word "stable" should be qualified as follows:

- Stable within one normalized snapshot: current internal IDs are expected to be
  deterministic and unique for graph-model operations.
- Stable across equivalent snapshots: M17.1 should prove exact correlation for
  unique raw anchors under compatible document/page context and deterministic
  ordering.
- Stable within one document lifecycle: supported only when runtime IDs and
  revision/lineage evidence remain compatible.
- Stable across runtime reload: not guaranteed until M17.2 real-snapshot
  evidence proves it for selected cases.
- Stable across import: not guaranteed; rewritten IDs can at most produce
  review-required `PROBABLE` matches when signatures are unique.
- Stable globally: explicitly not supported.

## Explicit Non-Guarantees

M17.0 does not recommend:

- public stable graph identity;
- global identity across arbitrary files;
- persistence keys;
- mutation identifiers;
- semantic diff contract;
- exact continuity through imports with rewritten IDs;
- exact continuity through clone/copy-paste based on content;
- automatic resolution of duplicate IDs;
- using labels or signatures as public IDs;
- treating `PROBABLE` as executable or exact.

## Rejected Alternatives

- Raw draw.io ID only: rejected because duplicates, missing IDs and import
  rewrites are already known cases.
- Page + layer qualified element identity only: rejected as the sole element
  policy because it over-treats same-page layer moves as delete/create.
- Structural signature only: rejected because similar nodes and sensitive
  labels make exact matching unsafe.
- Current provisional ID strings as the durable policy: rejected because ADR
  0003 and the spike explicitly limit them to deterministic local correlation.
- Stable global identity: rejected for M17 because it implies persistence,
  cross-file semantics and public expectations outside the milestone.

## Open Questions

- Which exact label features, if any, can be included in private signatures
  without leaking sensitive content?
- What geometry tolerance is acceptable for moved nodes?
- Should page moves ever become `PROBABLE`, or remain `NO_MATCH` until semantic
  diff exists?
- How should imported diagrams with rewritten IDs expose "same shape, no
  lineage" evidence without encouraging false continuity?
- Should edge endpoint changes preserve edge exact identity when the edge raw ID
  is stable, or should endpoint context lower confidence?
- Can M17.2 reliably produce real draw.io clone/import fixtures in the current
  REAL LOCAL HTTP harness?

## ADR Readiness

ADR 0008 is not ready to be accepted from M17.0 alone. The current evidence is
enough to define a candidate policy and M17.1 entry criteria, but not enough to
lock a durable policy.

Recommended ADR strategy:

- do not create an Accepted ADR in M17.0;
- optionally draft ADR 0008 after M17.1 fixtures demonstrate deterministic
  behavior;
- accept ADR 0008 only after M17.2 records real-snapshot evidence or a deliberate
  decision to keep the policy narrower than originally planned.

## Entry Criteria For M17.1

M17.1 should start only when this discovery is accepted and should include:

- a pure internal correlation result type with `EXACT`, `PROBABLE`,
  `AMBIGUOUS` and `NO_MATCH`;
- reason qualifiers for duplicate IDs, missing IDs, rewritten IDs, context
  changes, stale evidence and signature collisions;
- deterministic fixture builders for moves, clones, imports, duplicates,
  missing IDs, reordered input and equivalent snapshots;
- a bounded private signature design, or an explicit decision to defer
  signatures;
- tests proving `PROBABLE` is never accepted as `EXACT`;
- no public MCP surface changes;
- no persistence, mutation, semantic diff, rollback or global identity behavior.
