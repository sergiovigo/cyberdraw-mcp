# M17 - Architecture Intelligence Stable Identity Foundation

## Status

IN PROGRESS.

M17.0 discovery is complete. Current evidence is recorded in
`docs/cyberdraw/milestones/m17/identity-discovery.md`. That evidence proposes a
candidate policy for M17.1, but it does not accept a durable identity policy and
does not create ADR 0008.

M17.1 pure model and fixture evidence is complete. Current evidence is recorded
in `docs/cyberdraw/milestones/m17/pure-identity-model-and-fixtures.md`.

M17 remains open. It does not add public MCP tools, public schemas,
persistence, semantic diff, mutation execution, approval, rollback or stable
global identity.

## Objective

Define, test and evidence an internal identity policy that is stable enough to
correlate Architecture Intelligence entities between snapshots within explicit
limits.

M17 must not turn identity into:

- public graph identity;
- stable global identity;
- a persistence key;
- a mutation identifier;
- a semantic diff contract.

The output of M17 is an internal foundation decision and evidence package. Any
future public identity, persistence, semantic diff or mutation behavior requires
a separate milestone and, where durable, an ADR.

## Context

M16 closed Architecture Intelligence runtime integration hardening with PASS
WITH LIMITATIONS. It consolidated runtime evidence, proved the current REAL
LOCAL HTTP path and preserved M13/M14/M15 public contracts.

M16 explicitly deferred stable identity across page moves, clones or imports.
ADR 0003 also states that stable identity across snapshots needs a separate
decision. ADR 0004 says incremental analysis should wait for a stable identity
decision.

The current `packages/cyberdraw-graph-model/src/identity.ts` policy is
provisional. It is deterministic for the same normalized input but is not
accepted as stable across moves, clones, imports, reordered input or rewritten
draw.io IDs.

## Problem

Architecture Intelligence already has scoped runtime snapshots, structural
analysis, deterministic queries, non-executable plans and validation. Those
features can compare a plan or analysis with a current snapshot only inside
conservative revision and target-identity limits.

Future semantic diff, incremental analysis, review lifecycle, persistence and
controlled execution all need a clearer identity foundation. Starting those
features before identity semantics are explicit would either overclaim
stability or force every downstream feature to invent its own matching policy.

## Scope

M17 is in scope for:

1. Auditing the current provisional identity policy.
2. Designing candidate identity policies:
   - draw.io ID anchored;
   - page-qualified;
   - layer-qualified;
   - structural/content-signature assisted;
   - hybrid identity with confidence.
3. Defining explicit match semantics:
   - exact match;
   - probable match;
   - ambiguous match;
   - no match;
   - duplicate ID;
   - missing ID;
   - rewritten or imported ID.
4. Defining fixtures for:
   - node moved within the same layer;
   - node moved between layers;
   - node moved between pages;
   - cloned node;
   - imported diagram with rewritten IDs;
   - duplicate IDs;
   - missing IDs;
   - reordered snapshot input;
   - equivalent snapshot with stable IDs;
   - structurally similar but distinct nodes.
5. Defining a confidence model if exact identity is insufficient.
6. Recording security and privacy considerations.
7. Recording compatibility impact on M13, M14, M15 and the private graph-model
   package.
8. Requiring real-snapshot evidence before closure.

M17 may include pure package tests and runtime evidence only in later
implementation slices. This planning document does not add those tests.

## Non-Goals

M17 does not include:

- persistence;
- semantic diff;
- mutation or execution;
- approval workflows;
- rollback;
- transactions;
- new public MCP tools;
- public graph schema;
- public stable identity;
- server-side or plugin-side LLM/provider integration;
- incremental or chunked analysis implementation;
- complete-document public execution;
- changes to `m13-v1`, `m14-v1` or `m15-v1`;
- publication of `cyberdraw-graph-model` as a stable external API.

## Candidate Identity Policies

| Candidate | Description | Strength | Risk |
| --- | --- | --- | --- |
| draw.io ID anchored | Treat draw.io element/page/layer IDs as the primary anchor when present and unique in scope. | Strong for ordinary edits where IDs are preserved. | Fails or becomes ambiguous under duplicate IDs, imports and ID rewrites. |
| page-qualified | Include page identity in element matching. | Prevents accidental cross-page matches and preserves current scoped semantics. | Treats page moves as identity changes unless supplemented. |
| layer-qualified | Include layer identity in element matching. | Useful for layer-scoped analysis and cross-layer finding precision. | Treats layer moves as identity changes unless supplemented. |
| structural/content-signature assisted | Use stable structural facts, labels, geometry bands, edge neighborhood or metadata as secondary evidence. | Can recover some moved or rewritten-ID cases. | Can confuse similar nodes; must not silently guess. |
| hybrid identity with confidence | Combine anchors and signatures, returning exact/probable/ambiguous/no-match status. | Explicitly represents uncertainty and supports conservative downstream use. | More complex; confidence must be closed and deterministic. |

M17 should decide whether one candidate is sufficient or whether a hybrid
policy is required. It must document rejected candidates and tradeoffs.

## Match Semantics

M17 must define closed match statuses before implementation:

- `exact`: evidence is sufficient to correlate the same entity within the
  accepted identity domain.
- `probable`: evidence suggests the same entity, but downstream consumers must
  treat the result as review-required.
- `ambiguous`: multiple candidates satisfy the policy; consumers must not choose
  one automatically.
- `no-match`: no candidate satisfies the policy.
- `duplicate-id`: observed IDs are not unique enough to support exact matching.
- `missing-id`: required identity anchors are absent.
- `rewritten-id`: imported or rewritten IDs prevent ID-only continuity.

The exact string values are not public contract until implementation accepts
them. They are proposed here as design vocabulary.

## Identity Domain

M17 must explicitly define the identity domain for each entity type:

- document;
- page;
- layer;
- element;
- edge endpoint references;
- structural findings;
- non-executable plan targets.

The default posture is conservative: identity is scoped to a snapshot lineage
and is not a stable global identity across arbitrary files, imports or long-term
storage.

## Security And Privacy

Identity evidence can reveal sensitive diagram structure if it includes labels,
metadata, URLs or custom attributes. M17 must define which facts can be used for
matching and which facts may be exposed in diagnostics.

Required constraints:

- no raw XML;
- no raw graph dumps;
- no full labels in public output;
- no filesystem paths or hostnames in identity diagnostics;
- no persisted identity store by default;
- no use of identity as an implicit authorization or mutation target.

## Compatibility Impact

M17 must preserve:

- M13 `m13-v1`;
- M14 `m14-v1`;
- M15 `m15-v1`;
- the current public MCP tool set;
- read-only Architecture Intelligence behavior;
- the private source-neutral boundary of `cyberdraw-graph-model`;
- the server/plugin runtime snapshot contract unless a later implementation
  slice proves a narrowly scoped internal extension is required.

If an internal identity result shape is added later, it must remain private and
must not be exposed as a public stable graph schema.

## Sub-Milestones

### M17.0 - Identity Discovery And Candidate Policy

Status: COMPLETE.

Audit the current provisional policy, collect known identity failure modes and
document candidate policies with explicit tradeoffs.

Deliverables:

- candidate policy matrix;
- identity domain definition;
- initial fixture plan;
- decision on whether an ADR is likely needed.
- discovery evidence in
  `docs/cyberdraw/milestones/m17/identity-discovery.md`.

### M17.1 - Pure Identity Model And Fixtures

Status: COMPLETE for pure package evidence.

Implement only if M17.0 is accepted. Add pure deterministic identity correlation
model and fixtures in `cyberdraw-graph-model`.

Expected evidence:

- equivalent snapshot determinism;
- reordered input determinism;
- moved, cloned, duplicate, missing and rewritten-ID cases;
- explicit ambiguous/no-match behavior.
- evidence in
  `docs/cyberdraw/milestones/m17/pure-identity-model-and-fixtures.md`.

### M17.2 - Runtime Snapshot Identity Evidence

Use real runtime snapshots to test whether the selected policy behaves honestly
against draw.io-edited diagrams.

Expected evidence:

- REAL LOCAL HTTP classification unless another harness is actually run;
- real node move within layer;
- real layer/page movement where practical;
- import or clone behavior if reproducible;
- clear limitation record for cases the harness cannot prove.

### M17.3 - ADR Decision And Closure

Close M17 with a decision:

- accept a durable internal identity policy;
- reject stabilization and keep identity provisional; or
- accept a narrower policy with explicit limitations.

If evidence supports a durable decision, create:

```text
ADR 0008 - Architecture Intelligence Stable Identity Policy
```

ADR 0008 must not be marked Accepted before M17.1/M17.2 evidence supports the
policy.

## Acceptance Criteria

M17 can close only when:

- candidate policies are documented with explicit tradeoffs;
- identity domain and scope are defined;
- a selected policy or explicit rejection is recorded;
- deterministic behavior for equivalent inputs is proven;
- ambiguity is explicitly represented and never silently guessed;
- fixtures cover moves, clones, import rewrites, duplicate IDs, missing IDs and
  reordered input;
- public M13/M14/M15 contracts remain unchanged;
- no public stable global identity claim is made;
- no persistence or mutation coupling is introduced;
- real-snapshot evidence is recorded before closure;
- any durable identity decision is recorded in ADR 0008 only when supported by
  evidence.

## Risks

- Identity can be overclaimed as globally stable when it is only scoped and
  conditional.
- Structural signatures can create false positives for similar nodes.
- Page/layer qualification protects current scoped semantics but may make
  legitimate moves look like new entities.
- Import and clone behavior may vary by draw.io runtime version.
- Downstream semantic diff or mutation work may try to treat probable matches as
  exact; M17 must prevent that through closed status semantics.

## Dependencies

- M16 closed runtime integration hardening.
- ADR 0003 internal graph model architecture.
- ADR 0004 scope-first hierarchical snapshot strategy.
- Existing `cyberdraw-graph-model` provisional identity implementation.
- Existing real-environment runtime snapshot harness for M17.2.

## Explicit Deferrals

After M17, the following still require separate milestones:

- semantic diff;
- persistence or review sessions;
- mutation execution of M11 plans;
- approval workflows;
- rollback or transactions;
- incremental analysis, chunking or streaming;
- public graph identity or public graph schema;
- prompt-to-diagram expansion.

No numbering for those later milestones is assigned here.

## Recommended Branches

- Planning: `docs/m17-stable-identity-foundation`.
- Future implementation, if accepted:
  `feat/m17-stable-identity-foundation`.
