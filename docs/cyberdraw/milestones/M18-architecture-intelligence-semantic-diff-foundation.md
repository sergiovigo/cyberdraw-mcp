# M18 - Architecture Intelligence Semantic Diff Foundation

## Status

OPEN / IN PROGRESS.

M18 is proposed as a discovery-first Architecture Intelligence milestone after
M17. M17 closed with PASS WITH LIMITATIONS and accepted ADR 0008,
"Architecture Intelligence Scoped Identity Policy". That ADR unlocks design
work for semantic diff, but it does not authorize implementation of persistence,
mutation execution, public graph identity or incremental analysis.

## Objective

Define, test and evidence an internal semantic diff policy for comparing two
normalized CyberDraw diagram states without confusing identity continuity with
semantic equality.

The guiding M17 rule is:

```text
EXACT identity continuity != semantic equality
```

M18 should answer:

```text
What semantic change evidence can CyberDraw defend between two bounded,
normalized snapshots?
```

## Scope

M18 is in scope for:

1. Defining an internal semantic diff model over normalized graph-model
   snapshots.
2. Defining how ADR 0008 identity outcomes interact with observed changes.
3. Defining closed change dimensions such as existence, content, geometry,
   container, connectivity and metadata.
4. Defining scope, coverage, completeness and revision semantics for comparing
   two snapshots.
5. Building pure deterministic fixtures before runtime integration.
6. Recording REAL LOCAL HTTP runtime evidence only after the pure model is
   defensible.
7. Recording a durable ADR decision only after pure and runtime evidence.

The first implementation, if accepted in M18.1, should be pure/internal first in
`packages/cyberdraw-graph-model`.

## Non-Goals

M18 does not include:

- public MCP tools;
- public semantic diff DTOs;
- public graph schema;
- persistence;
- persisted findings;
- persisted diffs;
- mutation execution;
- applying M11 plans;
- approval workflows;
- rollback;
- transactions;
- stable/global IDs;
- identity as mutation target;
- arbitrary public graph schema;
- LLM/provider integration;
- prompt-to-diagram expansion;
- incremental analysis implementation;
- chunking or streaming implementation;
- document-wide completeness claims without coverage evidence.

## Proposed Architecture

The proposed architecture is:

```text
DiagramSnapshot A + anchor/context/coverage/revision evidence
        \
         identity correlation A <-> B
        /
DiagramSnapshot B + anchor/context/coverage/revision evidence
        |
        v
pure semantic diff model
```

The semantic diff model should consume normalized graph-model values and the
result of M17 identity correlation between A and B. Match identity is not a
property that exists independently inside one snapshot. The model should not
consume draw.io XML, runtime snapshot payloads or MCP DTOs directly.

M18 must keep these concepts separate:

- observed semantic diff: what changed between two observed states;
- structural analysis: findings about one observed state;
- structural change plan: a non-executable proposal for a possible future
  change;
- change-plan validation: a validation of a proposed plan against current
  analysis.

## Proposed Entity Participation

Initial M18 design should include:

- pages;
- layers;
- elements/nodes/groups/unknown elements;
- edges;
- scoped external references.

Document-level comparison should be limited to context, revision and coverage
metadata in M18. A complete document semantic diff must not be claimed unless
both inputs have complete-document coverage.

## Proposed Change Dimensions

M18.0 recommends modeling changes as dimensions, not as a single exclusive
label:

| Dimension | Meaning |
| --- | --- |
| `identityStatus` | M17 match outcome: `EXACT`, `PROBABLE`, `AMBIGUOUS` or `NO_MATCH`. |
| `existence` | observed in both, only base, only target or not comparable. |
| `content` | label/name/custom semantic payload changed, unchanged, unknown or not compared. |
| `geometry` | position, size or waypoints changed, unchanged, unknown or not applicable. |
| `container` | page, layer or parent context changed, unchanged, unknown or not applicable. |
| `connectivity` | edge endpoints or structural references changed, unchanged, unknown or not applicable. |
| `metadata` | style, tags, custom attributes, visibility/lock state or other metadata changed, unchanged or unknown. |
| `coverage` | whether the dimension is supported by comparable observed scopes. |

This avoids forcing one label when an entity changes in multiple dimensions,
for example an edge can remain `EXACT` while both `connectivity` and `metadata`
change.

## Proposed Classification Semantics

M18.0 recommends a small derived classification set:

- `UNCHANGED`: `EXACT` identity and all in-scope compared dimensions are
  unchanged.
- `ADDED`: target-only entity can be asserted within comparable coverage and no
  unresolved `PROBABLE` or `AMBIGUOUS` candidate blocks absence.
- `REMOVED`: base-only entity can be asserted within comparable coverage and no
  unresolved `PROBABLE` or `AMBIGUOUS` candidate blocks absence.
- `MODIFIED`: `EXACT` identity with content, style, metadata or non-container
  structural changes.
- `MOVED`: `EXACT` identity with geometry or container movement evidence. The
  result must also state which movement dimension changed. `PROBABLE` may carry
  candidate movement evidence, but must remain review-required and must not
  authoritatively derive `MOVED`.
- `REWIRED`: edge identity continuity with endpoint/connectivity change.
- `AMBIGUOUS`: identity or coverage is insufficient to make a stronger claim.

These are derived summaries. `INCOMPARABLE` is a comparison outcome, not a
change classification. When a comparison is not defensible, the diff outcome
should be `incomparable` or `stale` and entity classification should be absent.
The authoritative result should be the dimension matrix.

## Scope And Completeness

Semantic diff must carry separate scope evidence for both inputs:

- requested scope A;
- executed/observed scope A;
- requested scope B;
- executed/observed scope B;
- comparable scope intersection;
- missing or incomparable scope evidence;
- completeness per input;
- completeness for the diff result.

A partial diff is allowed only as a partial diff. It must never be presented as
a complete-document diff unless both inputs provide complete-document coverage
and compatible non-stale revision evidence.

## Revision And Stale Semantics

M18 should reuse the existing revision vocabulary where possible:

- document identity;
- content revisions;
- document revisions;
- revision compatibility;
- stale coverage;
- unknown revision evidence.

If either input is stale, the diff must produce a stale or incomparable outcome
rather than silently comparing old and current facts. Unknown revision evidence
can allow a limited diff only with an explicit limitation.

## Determinism Requirements

Any M18.1 pure function must satisfy:

```text
same A + same B + same options = same result
```

Required rules:

- canonical entity ordering;
- stable reason-code ordering;
- deterministic derived diff IDs if IDs are needed;
- no timestamps;
- no runtime randomness;
- no property-order dependence;
- no mutation of input snapshots;
- bounded private signature use only through M17 identity APIs.

## Security And Privacy

M18 must not expose:

- raw XML;
- raw runtime snapshots;
- raw graph dumps;
- private identity signatures;
- raw fingerprint material;
- labels or metadata in public responses;
- filesystem paths, hostnames or stack traces.

The first diff model should remain internal. If labels or metadata are compared,
the model should report change presence and bounded internal evidence, not raw
content unless a future private caller explicitly requests it for tests.

## Relationship With M11 And M12

Semantic diff is not a change plan.

M18 may reuse conceptual target identity and revision ideas from M11/M12, but it
must not reuse M11 proposals as the diff contract:

- M18 observes what changed;
- M11 proposes possible repairs for findings;
- M12 validates a proposed plan against current analysis.

The semantic diff model may later help a planner decide whether a finding or
plan is stale, but M18 must not execute or apply plans.

## Relationship With Incremental Analysis

M18 may produce design inputs for future incremental analysis:

- identity correlation boundaries;
- changed-entity sets;
- unchanged-entity proof;
- stale/incomparable outcomes;
- coverage-aware partial results.

M18 must not implement incremental analysis, caches, stateful watchers,
streaming, chunking or persisted diff history.

## Proposed Sub-Milestones

### M18.0 - Semantic Diff Discovery And Contract Design

Status: COMPLETE in
`docs/cyberdraw/milestones/m18/semantic-diff-discovery.md`.

Deliver discovery evidence, a candidate internal contract and M18.1 entry
criteria. Do not implement the engine.

### M18.1 - Pure Semantic Diff Model And Fixtures

Status: COMPLETE in
`docs/cyberdraw/milestones/m18/pure-semantic-diff-model-and-fixtures.md`.

Implement a pure internal graph-model semantic diff model and deterministic
fixtures. No runtime integration and no public MCP surface.

Delivered in M18.1:

- internal `diffSemanticSnapshots()` API in `cyberdraw-graph-model`;
- comparison outcomes separate from entity classifications;
- deterministic classification summary sets over an authoritative dimension
  matrix;
- ADR 0008 identity integration where `EXACT` continuity is not semantic
  equality;
- `PROBABLE` review-required behavior with no authoritative `MOVED`;
- guarded entity-scoped `ADDED`/`REMOVED` absence rules;
- entity-level coverage and revision outcome handling;
- 30 pure fixture cases plus hardened entity-coverage, determinism and privacy
  checks.

### M18.2 - Runtime Snapshot Semantic Diff Evidence

Status: COMPLETE in
`docs/cyberdraw/milestones/m18/runtime-snapshot-semantic-diff-evidence.md`.

Validate the pure model against REAL LOCAL HTTP runtime snapshots where the
harness can prove behavior. Classify unproven clone, import, reload and
cross-page cases honestly.

Delivered in M18.2:

- REAL LOCAL HTTP evidence feeding runtime snapshots through existing
  normalization into `diffSemanticSnapshots()`;
- real geometry, label, style, layer movement, edge endpoint, add, delete and
  scoped absence evidence;
- confirmation that `EXACT` runtime identity continuity is not semantic
  equality, including same edge raw anchor plus changed endpoints deriving
  `REWIRED`;
- entity-level coverage evidence blocking authoritative classifications outside
  comparable observed scope;
- stale and revision mismatch evidence over real snapshots with synthetic
  revision flags;
- explicit PARTIALLY-PROVEN / UNPROVEN limitations for copy-page, true
  copy/paste, import/reimport, reload/reopen, cross-page movement and artificial
  snapshot ordering.

### M18.3 - ADR Decision And Closure

Status: PROPOSED / NOT STARTED.

Decide whether ADR 0009, "Architecture Intelligence Semantic Diff Policy", is
ready to draft or accept. Close M18 with explicit limitations.

## Acceptance Criteria

M18 can close only when:

- a closed internal semantic diff model is documented and tested;
- identity interaction with ADR 0008 is explicit;
- `EXACT` identity is never treated as semantic equality;
- partial scope and stale revision behavior are explicit;
- ADDED/REMOVED are not asserted outside comparable coverage or while
  unresolved `PROBABLE`/`AMBIGUOUS` candidates block absence;
- deterministic ordering is tested;
- no raw XML, raw snapshots, raw graph or private signatures are exposed;
- M13/M14/M15 public contracts remain unchanged;
- runtime evidence is classified as REAL-PROVEN, PARTIALLY-PROVEN, UNIT-ONLY or
  UNPROVEN;
- ADR 0009 readiness is recorded.

## ADR Strategy

Candidate future ADR:

```text
ADR 0009 - Architecture Intelligence Semantic Diff Policy
```

M18.0 does not create or accept ADR 0009. After M18.1, ADR 0009 was READY FOR
DRAFT only. After M18.2, ADR 0009 is READY FOR ACCEPTANCE CANDIDATE with the
runtime limitations recorded in
`docs/cyberdraw/milestones/m18/runtime-snapshot-semantic-diff-evidence.md`.
M18.3 must decide and document the final ADR state; M18.2 does not create or
accept the ADR.
