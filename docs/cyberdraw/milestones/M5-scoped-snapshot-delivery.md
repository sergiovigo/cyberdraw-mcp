# M5: Scoped Snapshot Delivery

## Status

Internal milestone evidence. Not a public API and not a public MCP tool.

## Objective

M5 narrows the private runtime snapshot path added in M3 and hardened in M4.
Callers can request only the diagram material needed for internal analysis,
reducing browser traversal, memory pressure, payload bytes and hard-limit risk.

## Scopes

The private `cyberdraw-runtime-contract` package defines a versioned
discriminated union:

- `document`: all pages permitted by limits.
- `pages`: a normalized, de-duplicated set of page IDs, returned in document
  order.
- `layers`: one page ID plus normalized layer IDs.
- `selection`: UI-bound capture of the current selection, optionally pinned to a
  page ID.

`page` is intentionally not separate from `pages`; a single-page request uses
`{ kind: "pages", pageIds: ["..."] }`. Element scope is deferred because M5 can
reduce payload through pages, layers and UI selection without accepting stable
element identity semantics.

## Inclusion Semantics

Pages scope visits only requested pages and preserves document order. Missing
page IDs are diagnostics and make the snapshot partial. Background pages use
the existing background-page helper and must not change the active page.

Layers scope uses referential context semantics. It includes elements whose
layer is requested, plus minimal ancestor groups needed to interpret
containment. Ancestors are marked `contextOnly` in internal raw metadata. It
does not automatically materialize external terminals or unrelated descendants.
Edges on requested layers are included even if source or target is outside the
scope; external references are recorded as omitted context, not broken
references. Edges outside the requested layers are not included just because
they connect two included elements.

Selection scope materializes selected cells on the visible page and minimal
ancestor context. It preserves selection and active page state, supports empty
selection, includes selected edges, and records non-selected terminals as
external references. Selection is UI-bound and not a semantic scope.

## Contract

Snapshots now carry effective scope metadata:

- `requestedScope` and `resolvedScope`;
- included pages and layers;
- included and context-only element counts;
- omitted external references;
- missing pages and layers;
- completeness, truncation, diagnostics and payload accounting;
- `contentRevision`, and `selectionRevision` for selection scope.

Server-side response validation rejects malformed contracts, incompatible scope
metadata and scoped requests answered with a document snapshot.

## Capabilities

Peers advertise supported scopes on `cyberdraw.runtimeSnapshot.v1`, for example:

```json
{
  "name": "cyberdraw.runtimeSnapshot.v1",
  "contractVersion": 1,
  "snapshotVersion": 1,
  "scopes": ["document", "pages", "layers", "selection"]
}
```

M4 peers without `scopes` are interpreted as document-only. Unsupported scoped
requests fail before the internal event is sent. There is no silent downgrade to
document scope.

## Revision And Freshness

`contentRevision` includes contract version, schema version, normalized
requested scope, resolved scope, included content, context, limits,
completeness, loss diagnostics and the scope algorithm. Equivalent ID order
normalizes to the same revision; different scopes over the same content produce
different revisions. Changes outside page/layer scope do not affect scoped
revision unless materialized context changes. Selection scope also emits
`selectionRevision`, so UI selection changes can invalidate selection snapshots
without invalidating document or page snapshots.

The stale-read helper compares document evidence, contract, requested and
resolved scope, limits, completeness and revision. Partial snapshots remain
non-conclusive for future mutations.

## Graph Model

The runtime adapter remains source-specific and the graph-model core still does
not import the runtime contract. The adapter preserves scope facts in internal
raw metadata and suppresses definitive broken-reference findings for references
explicitly omitted by scope. Truncated snapshots remain non-conclusive as in M4.

## Payload And Performance

Scoped extraction limits visited pages and retained layers/elements before final
serialization. Payload accounting remains aggregate only: scope kind, requested
and resolved counts, element counts, context counts, external-reference counts,
bytes, duration, completeness and error code. No labels, XML, metadata, full
IDs or full snapshots are logged.

No chunking, streaming or compression is added. If a scoped snapshot still
exceeds the hard limit, extraction fails with a bounded error and does not fall
back to a larger scope.

## Security

M5 keeps the M4 safety envelope: no public MCP tools, no persistence, no
filesystem access, no auth changes and no public schema. Scope IDs are validated
and capped before traversal. Dangerous object keys are removed, runtime objects
are excluded, HTML labels stay inert and response scopes are validated against
the requested document path.

## Compatibility

Existing public MCP tools and responses are unchanged. Old peers that omit
runtime snapshot scopes remain compatible for document snapshots only. Advanced
scopes can be removed without data migration because snapshots are discardable
and private.

## Tests

Coverage added or extended:

- contract scope validation, canonical ordering, duplicates, excessive arrays
  and response mismatch;
- partial capability negotiation and no-downgrade behavior;
- scoped server request validation;
- graph-model distinction between external references and broken references;
- context-only element preservation.

Real environment coverage remains through the server test suite because the
plugin still has no package-local test runner.

## Rollback

To return to document-only M4 behavior:

1. Advertise only `["document"]` or remove `scopes` from capability metadata.
2. Stop sending `scope` in internal runtime snapshot requests.
3. Remove `pages`, `layers` and `selection` branches from contract validation.
4. Remove scoped filtering from plugin extraction.
5. Keep document snapshots, public MCP tools, graph-model M2/M3 behavior and
   peers without scope metadata unchanged.

No migration is needed because scoped snapshots are not persisted.

## Residual Risks

- FNV-1a 64-bit remains non-cryptographic.
- Layer membership relies on draw.io runtime APIs and fallback behavior.
- Minimal context is intentionally conservative and may require callers to
  request a wider scope for conclusive analysis.
- Plugin-local unit tests remain absent.
- A second real draw.io runtime version was not executed in this environment.

## Exit Criteria

M5 is complete when document snapshots still work, pages/layers/selection scopes
are versioned and validated, background pages preserve UI state, scoped
revisions are deterministic, omitted external references are not treated as
broken, no public MCP tool is added, CI-equivalent build/lint/format/test/audit
commands pass, and rollback is documented.

## M6 Follow-Up

M6 benchmark evidence is documented in
`docs/cyberdraw/milestones/M6-runtime-snapshot-benchmarks.md`. The synthetic
results confirm that scoped snapshots materially reduce payload and processing
cost, including a hard-limit fixture where document scope exceeds the current
hard limit but pages, layers and selection remain practical. Draft ADR 0004
proposes scoped and hierarchical requests as the M7 strategy while deferring
chunking, streaming and incremental analysis.
