# ADR 0004: Runtime Snapshot Scaling Strategy

## Status

Proposed.

## Context

M3 introduced a private runtime snapshot event. M4 added private contract
validation, capability negotiation, revision helpers and soft/hard payload
limits. M5 added private document, pages, layers and selection scopes.

M6 benchmark evidence shows that scoped snapshots materially reduce payload and
processing cost. The synthetic large fixture produced a document snapshot of
about 12.4 MiB with high processing cost, while a visible page was about
1.24 MiB and one layer was about 252 KiB. The hard-limit fixture produced a
document attempt of about 26.2 MiB, exceeding the current 16 MiB hard limit,
while a visible page was about 2.18 MiB and one layer about 427 KiB.

The current architecture remains private and discardable. Snapshots are not
persisted, public MCP responses are unchanged, and identity remains provisional.

## Alternatives

### A: Keep Full Snapshots With Scopes

Continue to use document, pages, layers and selection scopes. Fail clearly when
the requested scope exceeds hard limits.

### B: Add Internal Chunking

Split oversized payloads into ordered chunks and reassemble server-side.
Requires chunk ordering, integrity, timeout, cancellation, cleanup, backpressure
and partial failure semantics.

### C: Add Internal Streaming

Stream snapshot data progressively. This only pays off if consumers can process
incrementally and apply backpressure; the current adapter and graph model expect
a complete snapshot.

### D: Add Incremental Analysis

Track changes after an initial snapshot. Requires stable identity, invalidation,
change observation, semantic diff policy and likely state management.

### E: Add Hierarchical/Paged Internal Requests

Use discovery metadata and existing scopes to request pages, layers and focused
selection snapshots on demand.

### F: Hybrid

Use scopes and hierarchical requests first; reserve chunking for exceptional
single-scope overflow; defer incremental analysis until identity is stronger.

## Proposed Decision

Adopt the hybrid strategy with scopes as the primary scaling mechanism for M7.

M7 should keep complete snapshots bounded by scope, use hierarchical internal
analysis planning, and fail with clear hard-limit guidance when a requested
scope is too broad. M7 should not implement productive chunking, streaming,
persistence or incremental analysis.

Chunking may be reconsidered only if real-environment evidence shows that a
single necessary page or layer commonly exceeds the hard limit and cannot be
handled by narrower analysis. Incremental analysis should wait for a stable
identity decision.

## Consequences

Positive:

- preserves the private M3-M5 contract shape;
- avoids chunk reassembly and partial failure complexity;
- keeps plugin changes narrow;
- keeps graph-model normalization testable with complete scoped snapshots;
- aligns with M6 evidence that scopes reduce payload by roughly 50-100%
  depending on fixture and scope.

Negative:

- full document snapshots remain unsuitable for very large or metadata-heavy
  diagrams;
- callers must choose scope deliberately;
- a single very large page or layer can still exceed limits;
- real-browser timing evidence still needs expansion before limit changes.

## Risks

- Synthetic benchmark timing does not equal browser main-thread blocking.
- Heap deltas are approximate, not peak memory.
- Current provisional identity is not enough for incremental analysis.
- Hard-limit failures may require better internal caller UX.

## Reversibility

The decision is reversible because no public API or persisted state is added.
Chunking, streaming or incremental analysis can be introduced later behind the
same private event family or a new private event after a separate ADR.

## Open Questions

- What real-browser latency is acceptable for visible page and layer capture?
- Should internal callers first request a page/layer inventory before analysis?
- What identity strategy is sufficient for future incremental analysis?
- Should hard-limit diagnostics include a recommended narrower scope?

## Acceptance Criteria

This ADR can move from Proposed to Accepted when:

- M6 synthetic benchmark artifacts are reviewed;
- M6 documentation is merged;
- M7 scope agrees to hierarchical scoped analysis rather than chunking;
- no public MCP tool or public schema is introduced by the decision.
