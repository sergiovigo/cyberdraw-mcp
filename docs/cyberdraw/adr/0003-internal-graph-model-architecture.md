# ADR 0003: Internal Graph Model Architecture

## Status

Accepted.

## Context

CyberDraw MCP inherits the Draw.io MCP Server runtime architecture: MCP clients
call a Node server, the server validates tool inputs and forwards live diagram
operations over the WebSocket bridge, and the browser plugin executes those
operations against the draw.io runtime. This is effective for direct editing and
export, but the inherited read model is a tool-specific view of draw.io cells.

The closest inherited read surface, `list-paged-model`, exposes sanitized page
cell data such as IDs, labels, geometry, styles, parent/source/target references,
layers and tags. It is useful inspection data, but it is not a durable semantic
model. Consumers still need to understand mxGraph cell conventions, style
strings, layer-as-parent behavior, custom XML object attributes and ambiguous or
broken references. Server-side semantic tests also remain coupled to browser
runtime extraction unless a plain-data model boundary exists.

RFC 0001 proposed an internal graph model to support architecture intelligence:
queryable graph snapshots, normalization, validation, provenance, future
analysis and eventual change planning while keeping draw.io as the editor and
operational file format. It considered three architectural alternatives:

- Alternative A: build the model inside the server only.
- Alternative B: share the full model implementation between server and plugin.
- Alternative C: create an independent internal package in the monorepo,
  consumed server-first, with the plugin limited initially to snapshot
  extraction.

The M2 Read-Only Spike implemented Alternative C as
`packages/cyberdraw-graph-model`, a private TypeScript workspace package. The
package builds a reconstructable read-only `DiagramSnapshot` from plain data,
normalizes pages, layers and elements, creates indexes, detects broken
references and preserves draw.io correlation through provisional internal IDs.
Its tests cover canonical input without the legacy adapter, a simulated second
source, deterministic output, non-mutation, multi-page and multi-layer fixtures,
duplicate IDs, broken source/target/parent/layer/page/child references, parent
cycles, malformed and oversized input, safe metadata handling, background-page
derived snapshots, adapter layer/parent classification and a structural
architecture check that core modules do not import the legacy adapter.

The spike also includes a non-blocking performance smoke test for 100, 2,000 and
20,000 generated elements. A local run recorded normalization plus validation at
approximately 9.26 ms, 60.12 ms and 401.52 ms respectively, with approximate
heap deltas of 0.42 MiB, 6.11 MiB and 61.05 MiB. These values are feasibility
evidence, not service-level guarantees.

After the initial spike, the legacy `list-paged-model` compatible adapter was
separated from the core `CanonicalDiagramInput` boundary. This means the core no
longer needs to know mxCell-shaped `{ id }` references, `value.attributes`,
`edge`, `vertex`, `parent`, `source`, `target`, `layer`, `tags` or the inherited
tool name. That separation is the key architectural evidence for choosing
Alternative C over embedding the inherited tool response as the semantic
contract.

Limitations remain:

- runtime snapshot extraction has not been validated against real draw.io
  versions;
- full WebSocket payload size and paging behavior are not proven;
- the provisional identity format is deterministic only for the same normalized
  input order and is not stable across page moves, clones or imports;
- snapshot revision, invalidation and stale-edit detection are not designed;
- `CanonicalDiagramInput` is internal and experimental;
- the package does not provide a public JSON Schema or stable API;
- findings are limited to broken-reference diagnostics and are not persisted;
- semantic profiles, rule engines, semantic diff and change plans are deferred.

This evidence is sufficient to decide the package location and high-level
ownership boundaries. It is not sufficient to accept runtime integration,
identity stability, public schemas or future analysis behavior.

## Decision

CyberDraw MCP accepts RFC 0001 Alternative C as the internal graph model
architecture.

The graph model lives in `packages/cyberdraw-graph-model` as an independent
workspace package. It remains private, internal and experimental. Its package API
is not a public compatibility surface, and no stable external contract is
created by this ADR.

The core graph model is source-neutral. It operates on plain data and owns
generic types, normalization, safe data preservation, indexing, read-only graph
queries that are added later, snapshot serialization for tests/debugging and
validation that is generic to graph integrity. The core must not depend on
draw.io runtime objects, MCP SDK types, WebSocket messages, browser APIs,
filesystem access or a specific inherited tool response.

Adapters are separate from the core and are responsible for translating source
specific data into the canonical internal input shape. The current legacy adapter
may consume data compatible with inherited `list-pages`, `list-layers` and
`list-paged-model` outputs, but that adapter is not the semantic model contract.
Future adapters, such as XML or runtime snapshot adapters, must emit the same
kind of neutral canonical input rather than adding source semantics to the core.

Adoption is server-first. The server is the first runtime consumer of the
package and is responsible for requesting bounded snapshots, normalizing them,
holding or discarding snapshot-scoped state, running server-side analysis when
introduced, enforcing response limits and applying any future change plan only
through approved MCP operations. This ADR does not add or change MCP tools,
responses, transports or WebSocket protocol messages.

The plugin is limited initially to producing bounded plain-data snapshots from
the draw.io runtime. It should not host the full graph model, cache a competing
semantic model or run generic analysis unless a later ADR accepts that cost. The
browser remains responsible for observing the open diagram through draw.io APIs,
not for becoming the semantic intelligence layer.

The draw.io runtime is the authoritative source for the open editable diagram.
For offline files, exported draw.io XML remains the authoritative operational
format. The internal model is authoritative only for a specific immutable
snapshot and derived analysis tied to that snapshot. It is reconstructable and
discardable; it is not a second source of truth.

The snapshot cycle is:

```text
draw.io runtime
-> plugin plain-data snapshot
-> source adapter
-> CanonicalDiagramInput
-> normalized DiagramSnapshot
-> indexes, validation and future analysis
```

Future mutations must use existing MCP operations as the default live editing
boundary. A future model may produce change plans, but those plans must be
verified against a fresh or revision-compatible snapshot before applying
operations such as add, edit, parent/layer movement or data updates. Direct XML
generation is not the default mutation path and requires a separate decision for
import or offline conversion flows.

Runtime integration is deferred until a snapshot handler is designed and
validated. That integration must prove real draw.io snapshot extraction,
payload limits, invalidation, revision handling, rollback behavior and no
changes to existing MCP responses before it can become product behavior.

M3 spike update: `docs/cyberdraw/spikes/0002-runtime-snapshot-handler.md`
implements an internal read-only runtime snapshot handler behind the private
`cyberdraw.runtimeSnapshot.v1` message, plus a source-specific adapter into
`CanonicalDiagramInput`. It provides evidence for visible/background extraction,
state restoration, JSON-serializable plain data, provisional `contentRevision`
and truncation diagnostics. It does not change this ADR's non-goals: no public
MCP tool, public schema, stable identity, semantic revision, persistence or
accepted product runtime integration is introduced.

This ADR explicitly does not accept:

- the current provisional identity strategy as definitive;
- `CanonicalDiagramInput` as stable;
- publication of `cyberdraw-graph-model`;
- a public JSON Schema;
- persisted findings;
- sidecars;
- embedded metadata;
- a general rule engine;
- semantic diff;
- change plans;
- cybersecurity-specific extensions;
- WebSocket integration;
- new MCP tools;
- a definitive snapshot revision model;
- stable identity between snapshots.

## Consequences

Positive consequences:

- The model becomes unit-testable without a browser, WebSocket bridge or MCP
  client.
- Source-specific extraction is decoupled from generic graph normalization and
  validation.
- Upstream compatibility risk is lower because draw.io plugin changes can stay
  narrow and snapshot-oriented.
- The server gains a practical foundation for graph analysis, integrity checks
  and later semantic work.
- Browser CPU, memory and bundle-size pressure remain lower than with a full
  shared plugin/server model.
- The legacy adapter can evolve independently from the core model boundary.

Negative consequences:

- CyberDraw now carries a second representation of the diagram and must prevent
  users and code from treating it as the live source of truth.
- Snapshot invalidation, stale reads and manual browser edits become explicit
  design problems.
- Full snapshots have CPU, memory and payload costs, especially for larger
  diagrams.
- The monorepo has a new package with ownership, tests and documentation to
  maintain.
- Schemas and adapters need governance even while the package remains private.
- Identity remains unresolved beyond deterministic spike-local correlation.

## Alternatives Rejected

### Server-Only Embedded Model

Rejected because embedding the model directly in `drawio-mcp-server` would make
semantic code harder to test and reuse, blur package ownership and encourage the
server to depend directly on inherited tool response shapes. It has lower
deployment complexity, but the spike showed that a private pure package gives a
cleaner core/adapter boundary without changing runtime behavior.

### Full Shared Model Between Server and Plugin

Rejected for the next phase because it would increase browser bundle, CPU and
compatibility burden before there is evidence that the plugin needs full model
behavior. It would also raise upstream sync risk by making draw.io runtime code
participate in generic normalization and analysis. The plugin should first
produce bounded plain-data snapshots.

### XML as the Primary Model

Rejected because draw.io XML is the operational file format, not the desired
semantic intelligence boundary. XML remains important for import/export and
offline authority, but using it as the primary model would keep consumers tied
to mxGraph serialization details and would not by itself provide indexes,
provenance, graph integrity findings or source-neutral adapters.

### `list-paged-model` as the Semantic Contract

Rejected because `list-paged-model` is an inherited read surface, not a versioned
semantic model. It exposes useful cell facts but preserves draw.io/mxCell
conventions such as parent/source/target references, style strings and value
attributes. The accepted architecture keeps it behind a legacy adapter.

### Indefinitely Postpone the Model

Rejected because the M2 spike provides enough evidence that a private,
source-neutral package is feasible and useful without changing MCP behavior.
Postponing indefinitely would force future analysis, validation and comparison
work either into tool-specific ad hoc code or into the browser runtime.

## Guardrails

- The graph model core must not import adapters.
- Adapters must emit neutral canonical input; they must not make source-specific
  runtime shapes the core contract.
- The draw.io runtime remains authoritative for the open editable diagram.
- Findings must not be persisted by default.
- Generic core entities must not introduce cybersecurity-specific concepts.
- No public API, public schema or package publication is allowed without a later
  ADR.
- This ADR must not change MCP tools, MCP responses, WebSocket protocol or
  transport behavior.
- Any runtime integration needs tests using real draw.io snapshots.
- Stable identity across snapshots needs a separate decision.
- Future revisions must be able to distinguish visual-only changes from
  semantic changes when that distinction matters.

## Exit Criteria for the Next Phase

Before runtime integration is accepted, the next milestone must provide evidence
for:

1. A plugin snapshot handler that emits bounded plain data and avoids draw.io
   runtime objects in the payload.
2. Snapshot coverage for the visible page and background pages.
3. Payload limits, truncation behavior and response-size strategy.
4. Detection or invalidation for manual edits made outside MCP tool calls.
5. A provisional snapshot revision strategy with documented stale-read behavior.
6. Real draw.io fixtures collected from runtime snapshots, not only synthetic
   fixtures.
7. Compatibility evidence across the supported draw.io runtime versions.
8. No changes to existing MCP tool responses or transport contracts.
9. Rollback or disablement behavior if snapshot integration fails at runtime.
10. Performance evidence for medium diagrams, including normalization time,
    snapshot extraction time, payload size and memory impact.
