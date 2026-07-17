# ADR 0004: Runtime Snapshot Scaling Strategy

## Status

Accepted.

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

M7 real-environment benchmark evidence confirms the same direction inside a
real draw.io browser runtime. On draw.io `30.3.12`, the medium real fixture
produced a document snapshot of 612,655 bytes with about 797 ms plugin time,
while a visible page was 205,400 bytes with about 52 ms plugin time, one layer
was 72,607 bytes with about 16 ms plugin time, and selection was about 5.7 KiB
with about 5 ms plugin time. Background page extraction was materially slower
than visible page extraction because it must prepare and clean up non-active
draw.io graph state. Limit fixtures showed document scope near the hard limit
failing clearly, while layer and selection scopes remained practical.

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

## Decision

Adopt the hybrid strategy with scopes as the primary scaling mechanism for M7.

M7 keeps complete snapshots bounded by scope, uses hierarchical internal
analysis planning, and fails with clear hard-limit guidance when a requested
scope is too broad. M7 does not implement productive chunking, streaming,
persistence or incremental analysis.

Chunking may be reconsidered only if real-environment evidence shows that a
single necessary page or layer commonly exceeds the hard limit and cannot be
handled by narrower analysis. Incremental analysis should wait for a stable
identity decision.

M8 should continue with hierarchical scoped analysis over the existing private
scope family: use document scope for bounded diagrams, prefer pages and layers
for larger diagrams, and use selection only for UI-bound focused analysis.

M8 implementation update: M8 adds a private pure planner in
`cyberdraw-graph-model` and a private server executor in `drawio-mcp-server`.
The implementation follows this ADR without adding public MCP tools, public
schemas, persistence, chunking, streaming or incremental analysis. The milestone
is PARTIAL until real draw.io evidence demonstrates multi-step expansion with a
resolvable external reference.

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
- HTTPS/Caddy real-environment benchmark execution was unstable in the local M7
  environment and should not be used as performance evidence until repaired.

## Reversibility

The decision is reversible because no public API or persisted state is added.
Chunking, streaming or incremental analysis can be introduced later behind the
same private event family or a new private event after a separate ADR.

## Open Questions

- What real-browser latency is acceptable for visible page and layer capture?
- Should internal callers first request a page/layer inventory before analysis?
- What identity strategy is sufficient for future incremental analysis?
- Should hard-limit diagnostics include a recommended narrower scope?

M8 resolves the implementation direction for the second question only partially:
internal callers now have planner/executor code, but a dedicated cheap inventory
extractor remains future work.

## M7 Evidence

Versioned M7 artifacts:

- `docs/cyberdraw/benchmarks/m7-real-small-summary.json`;
- `docs/cyberdraw/benchmarks/m7-real-medium-summary.json`;
- `docs/cyberdraw/benchmarks/m7-real-soft-limit-summary.json`;
- `docs/cyberdraw/benchmarks/m7-real-hard-limit-summary.json`;
- `docs/cyberdraw/benchmarks/m7-real-summary.md`;
- `docs/cyberdraw/milestones/M7-real-environment-snapshot-benchmarks.md`.

The evidence supports the accepted strategy:

- scopes reduce real browser payload and processing cost;
- visible and background pages both work, with background pages costlier;
- layers provide strong reductions and preserve context/external-reference
  semantics;
- selection remains small and preserves UI;
- hard-limit behavior is observed without introducing chunking;
- no public MCP tool, public schema or persisted state is introduced.

HTTPS/Caddy validation is not part of this ADR's acceptance criteria. M7
records it as a residual environment validation gap, not as benchmark evidence
for or against the scaling decision.

## Acceptance Criteria

This ADR can move from Proposed to Accepted when:

- M6 synthetic benchmark artifacts are reviewed;
- M6 documentation is merged;
- M7 scope agrees to hierarchical scoped analysis rather than chunking;
- no public MCP tool or public schema is introduced by the decision.
