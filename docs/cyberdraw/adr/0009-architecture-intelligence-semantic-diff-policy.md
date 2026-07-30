# ADR 0009: Architecture Intelligence Semantic Diff Policy

## Status

Accepted.

## Context

ADR 0008 accepted Architecture Intelligence scoped identity. Its central rule is:

```text
EXACT identity continuity != semantic equality
```

M18 built on that decision:

- M18.0 defined the internal semantic diff discovery contract.
- M18.1 implemented `diffSemanticSnapshots()` as a pure internal graph-model
  function with deterministic fixtures.
- M18.2 validated the model against REAL LOCAL HTTP runtime snapshots from
  draw.io through the existing server/plugin runtime path.

The evidence supports an internal semantic diff policy over normalized,
scoped CyberDraw snapshots. It does not support public semantic diff APIs,
global identity, persistence, fuzzy reconciliation, mutation targeting or a
semantic equality engine.

## Decision

CyberDraw accepts Architecture Intelligence semantic diff as an internal, pure
and scoped capability.

The accepted policy is:

- semantic diff operates over normalized `DiagramSnapshot` values;
- the implementation remains internal to `cyberdraw-graph-model`;
- the core entry point is `diffSemanticSnapshots()`;
- comparison is scoped and coverage-aware;
- identity correlation follows ADR 0008;
- `EXACT` identity continuity is required before deriving authoritative
  same-entity changes such as `UNCHANGED`, `MODIFIED`, `MOVED` or `REWIRED`;
- `EXACT` identity continuity does not mean semantic equality;
- entities without defensible exact continuity must not be paired by silent
  heuristics;
- uncertainty is represented explicitly through change classifications, reason
  codes and comparison outcomes;
- dimensions are authoritative and classifications are deterministic summaries;
- semantic diff remains separate from M11/M12 change planning and validation.

## Identity And Matching Semantics

Semantic diff consumes identity correlation between snapshot A and snapshot B.
Match identity is not a property that exists independently inside one snapshot.

### EXACT

`EXACT` means scoped identity continuity under ADR 0008. It is sufficient to
compare observed dimensions for the same entity when coverage permits it.

`EXACT` does not mean:

- semantic equality;
- content equality;
- persistent identity;
- global identity;
- mutation target safety;
- public graph identity;
- unchanged graph structure.

### PROBABLE

`PROBABLE` remains review-required heuristic evidence. It can be recorded as
candidate continuity, but it must not authoritatively derive `MOVED`, must not
act as a persistence key and must not be used as a mutation target.

### AMBIGUOUS

`AMBIGUOUS` means multiple candidates, duplicate anchors, duplicate signatures,
conflicting context or insufficient coverage prevents a safe stronger claim.
The diff must not select the first candidate silently.

### NO_MATCH

`NO_MATCH` means no defensible continuity under ADR 0008. It does not
automatically become `ADDED` or `REMOVED`; entity-scoped coverage and absence
proof are still required.

## Change Classifications

The accepted internal classifications are:

- `UNCHANGED`;
- `ADDED`;
- `REMOVED`;
- `MODIFIED`;
- `MOVED`;
- `REWIRED`;
- `AMBIGUOUS`.

`INCOMPARABLE` is not a change classification. It is represented at comparison
outcome level.

### UNCHANGED

`UNCHANGED` requires:

- `EXACT` identity continuity;
- observed comparable coverage for the relevant dimensions;
- all compared in-scope dimensions unchanged.

### ADDED And REMOVED

`ADDED` and `REMOVED` require entity-scoped absence proof.

`ADDED` requires:

- target entity observed;
- no defensible corresponding base entity;
- base comparison domain observed for that entity;
- entity inside comparable scope;
- no unresolved `PROBABLE` candidate;
- no unresolved `AMBIGUOUS` candidate.

`REMOVED` is symmetric.

`NO_MATCH` alone is never enough to assert addition or removal.

### MODIFIED

`MODIFIED` requires `EXACT` identity continuity and observed comparable changes
in content, metadata or other non-movement, non-rewire dimensions.

### MOVED

`MOVED` requires:

- `EXACT` identity continuity;
- observed comparable geometry and/or container change.

`PROBABLE` may expose candidate movement evidence, but it must not
authoritatively derive `MOVED`.

### REWIRED

`REWIRED` requires defensible edge identity continuity and observed comparable
connectivity or endpoint change.

The normative M17/M18 example is:

```text
same edge raw anchor + changed endpoints
= EXACT identity continuity + REWIRED semantic structure
```

This example demonstrates that identity continuity is not semantic equality.

## Comparison Outcomes

Semantic diff comparison outcomes remain distinct from entity classifications.
Accepted outcomes include:

- `ok`;
- `ok-with-limitations`;
- `partial`;
- `incomparable`;
- `stale`.

Stale, document-mismatched or incomparable comparisons must not emit fake
entity classifications.

## Scope, Coverage And Revision

Semantic diff must preserve:

- base scope;
- target scope;
- comparable scope;
- base completeness;
- target completeness;
- diff completeness;
- revision compatibility;
- result-level reason codes.

Partial scope remains partial. A complete-document diff can be claimed only
when both inputs provide compatible complete-document coverage.

Entity-level coverage gates every authoritative classification. Entities
outside observed comparable scope must remain unclassified or explicitly
not-compared; they must not be classified as unchanged, modified, moved,
rewired, added or removed.

## Runtime Evidence

M18.2 provided REAL LOCAL HTTP evidence using:

- real Chromium;
- draw.io served by the repository harness over local HTTP;
- the real browser plugin;
- the real server runtime WebSocket path;
- real runtime snapshot capture;
- `fromRuntimeSnapshot()` normalization;
- `diffSemanticSnapshots()` over normalized graph-model data;
- `InMemoryTransport` only for the MCP client harness.

REAL-PROVEN behavior includes:

- identical real snapshots derive `UNCHANGED`;
- node geometry changes derive `MOVED`;
- node label changes derive `MODIFIED`;
- node style/metadata changes derive `MODIFIED`;
- same-page node layer moves derive `MOVED`;
- unchanged edges derive `UNCHANGED`;
- edge endpoint changes derive `REWIRED`;
- edge label/style changes derive `MODIFIED` without `REWIRED` when endpoints
  are unchanged;
- controlled add/delete derive `ADDED`/`REMOVED` with absence proof;
- partial coverage blocks authoritative classifications outside observed
  comparable scope;
- scoped absence remains scoped to the covered layer/page.

PARTIALLY-PROVEN behavior includes:

- copy-page evidence;
- stale and revision mismatch behavior through synthetic revision flags over
  real snapshots;
- ordering semantics where classifications and dimensions are stable but
  internal snapshot-scoped references are not byte-identical after artificial
  runtime payload reorder.

UNPROVEN behavior includes:

- cross-page move;
- import/reimport with rewritten IDs;
- runtime reload/reopen;
- true node copy/paste;
- arbitrary clone behavior;
- semantic equivalence between distinct entities;
- stable global identity;
- persistent continuity across sessions or documents.

No material contradiction with M18.1 was observed.

## Security And Privacy

Semantic diff remains internal. It must not expose:

- raw XML;
- raw runtime snapshots;
- raw graph dumps;
- private identity signatures;
- private fingerprint material;
- public semantic diff DTOs;
- public graph identity;
- filesystem paths, hostnames or stack traces.

Labels, styles and metadata can be sensitive. Internal callers must avoid
promoting raw compared values to public outputs unless a future public contract
explicitly accepts and sanitizes that behavior.

## Compatibility

This decision is backward compatible.

It does not change:

- M13 `m13-v1`;
- M14 `m14-v1`;
- M15 `m15-v1`;
- MCP tool names or schemas;
- server routes;
- plugin interfaces;
- runtime snapshot DTOs;
- public documentation of available MCP tools.

## Consequences

Positive:

- CyberDraw has a durable internal semantic diff policy;
- downstream internal work can rely on deterministic scoped change evidence;
- uncertainty is explicit and reviewable;
- incremental analysis design can now reference a bounded diff foundation;
- cache invalidation, changed-region analysis and selective recomputation can
  be designed against evidence-aware scoped diffs.

Negative:

- semantic diff remains internal only;
- broad semantic equality is intentionally not solved;
- fuzzy reconciliation is not accepted;
- copy/paste, import/reload and cross-page continuity remain unproven;
- future public exposure still requires a separate contract and evidence.

## Explicit Non-Guarantees

This ADR does not accept or implement:

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

## Deferred Work

This ADR enables future design or implementation milestones for:

- internal incremental analysis;
- scoped snapshot comparison;
- changed-region analysis;
- selective recomputation;
- internal cache invalidation;
- evidence-aware Architecture Intelligence reporting;
- additional runtime experiments for unproven cases.

Each future capability must define its own scope, contracts, fixtures, real
evidence and ADR when appropriate. ADR 0009 does not automatically authorize
implementation of those capabilities.
