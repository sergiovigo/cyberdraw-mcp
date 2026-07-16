# Spike 0001: Internal Graph Read-Only Model

## Status

Read-only M2 prototype.

This spike is evidence for ADR 0003. It is not stable product behavior, does
not change runtime integration and does not define a public API, public schema
or definitive identity strategy.

## Objective

Validate whether CyberDraw can build a normalized, reconstructable, internal
graph snapshot from inherited draw.io read surfaces without changing public MCP
tools, the WebSocket protocol, persistence, sidecars or plugin behavior.

The spike focuses on three RFC 0001 hypotheses:

- a normalized snapshot can be built from legacy page, layer and cell data;
- internal identity can preserve draw.io correlation while handling duplicates
  and missing IDs;
- a first integrity class, broken references, can be detected reliably.

## Scope

Implemented in `packages/cyberdraw-graph-model` as a private package. The
package contains only pure TypeScript types, normalization, indexes, reference
validation and JSON debug serialization.

It does not depend on browser APIs, draw.io runtime objects, WebSocket, MCP SDK,
HTTP or filesystem access. It adds no MCP tools and changes no existing public
tool responses.

## Architecture

```text
legacy plain data
  pages from list-pages shape
  layers from list-layers shape
  cells from list-paged-model shape
        |
        v
internal adapter fromLegacyPagedModel()
        |
        v
CanonicalDiagramInput
        |
        v
normalizeDiagram()
        |
        +--> DiagramSnapshot
        +--> indexes
        +--> BrokenReferenceFinding[]
        +--> deterministic JSON serialization for tests/debug
```

The adapter is intentionally internal. It accepts data compatible with the
current inherited surfaces but does not make `list-paged-model` itself the graph
model contract.

The core normalization boundary is `CanonicalDiagramInput`. It is an internal,
experimental API for this spike, not a public package contract. The core does
not consume mxCell-shaped `{ id }` references, `value.attributes`, `edge`,
`vertex`, `parent`, `source`, `target`, `layer` or `tags` directly; the legacy
adapter classifies those into neutral external IDs, labels, style, geometry,
metadata, raw data and provenance before calling `normalizeDiagram()`.

Formal subpath entrypoints such as a separate core export and a separate
`adapters/legacy-paged-model` export are intentionally deferred until the
package is accepted for stabilization.

## Input Data

Minimum input for the spike:

- adapter input: document identity, page `id`, page `index`, page `name`,
  layer `id`/`name`/visibility/lock state and legacy cell fields compatible with
  `list-paged-model`;
- canonical core input: `pageExternalId`, `layerExternalId`,
  `parentExternalId`, `sourceExternalId`, `targetExternalId`, external element
  identity, provisional element kind, label, style, geometry, metadata, bounded
  raw data and neutral `SourceRef` provenance.

The normalizer accepts malformed or partial plain data, applies basic limits and
represents unresolved references as findings instead of throwing. The legacy
adapter is responsible for converting mxCell-like references such as `{ id }`
into simple canonical external IDs.

## Minimum Model

Implemented:

- `DiagramSnapshot`;
- `PageSnapshot`;
- `LayerSnapshot`;
- `GraphElement`;
- `NodeElement`;
- `EdgeElement`;
- `GroupElement`;
- `UnknownElement`;
- `Geometry`;
- `Style`;
- `Label`;
- `SourceRef`;
- `BrokenReferenceFinding`.

Deferred from RFC 0001:

- mandatory `Port` entities;
- shape references;
- generic findings, severities and lifecycle;
- change plans;
- persisted analysis state;
- semantic diff;
- path or component algorithms;
- public schema compatibility guarantees.

## Provisional Identity

The spike preserves `drawioId` and generates deterministic `internalId` values:

- pages: `page:<index>:drawio:<pageDrawioId>` or `page:<index>:synthetic`;
- layers: `layer:<pageInternalId>:drawio:<layerDrawioId>:<index>` or synthetic;
- elements with draw.io IDs:
  `element:<pageInternalId>:drawio:<drawioId>:<appearanceIndex>`;
- elements without draw.io IDs:
  `element:<pageInternalId>:synthetic:<appearanceIndex>`.

Tests compare the three candidate strategies requested by the RFC review:

- `pageId + drawioId` is deterministic and keeps page scoping explicit;
- appearance index disambiguates duplicate draw.io IDs on the same page;
- synthetic IDs cover elements with no draw.io ID.

Limitations:

- IDs are stable only for the same normalized input order;
- they do not claim stability across page moves, document clones or import
  rewrites;
- duplicate draw.io IDs preserve `drawioId -> internalId[]` and emit findings;
- ambiguous references are not resolved heuristically.

The provisional identity format is now encapsulated in `identity.ts`. It remains
experimental and may be replaced by an injected or versioned policy before the
package is stabilized.

## Broken References

Supported diagnostic and finding codes:

- `duplicate_drawio_id`;
- `ambiguous_drawio_reference`;
- `input_truncated`;
- `missing_edge_source`;
- `missing_edge_target`;
- `missing_parent`;
- `missing_layer`;
- `missing_page`;
- `missing_child`;
- `parent_cycle`.

The spike keeps these in one result array for simplicity, but records a
`category`:

- normalization diagnostics: `duplicate_drawio_id`, `input_truncated`;
- broken-reference findings: missing source, target, parent, layer, page,
  child, parent cycle and ambiguous draw.io references.

Each result includes a stable code, message, `elementInternalId` when
applicable, `referenceType`, referenced draw.io/external/internal ID, page
evidence where available and minimal evidence.

Draw.io layer parents are treated as layer membership rather than graph
containment. This rule is based on draw.io/mxGraph evidence: layers are root
children, cells can have their layer as parent, and inherited helpers use
`graph.getLayerForCell(cell)`. The legacy adapter applies the two-phase rule:
explicit `cell.layer.id` wins; otherwise a parent that matches a known layer on
the page becomes `layerExternalId`; a parent that does not match a known layer is
preserved as `parentExternalId` and does not produce a layer finding.

## Indexes

Implemented indexes:

- lookup by `internalId`;
- lookup by `drawioId`;
- elements by page;
- elements by layer;
- incoming edges;
- outgoing edges.

No path traversal, connected components or rule engine is implemented.

## Security Controls

The normalizer:

- creates safe records for metadata;
- removes `__proto__`, `prototype` and `constructor` keys;
- caps string, array, page, layer, element and raw-data depth/keys;
- avoids unbounded recursion in raw preservation;
- preserves HTML labels as inert data and never evaluates HTML;
- does not persist findings;
- has no filesystem access.

## Fixtures And Tests

Fixtures cover:

1. valid simple diagram;
2. multiple pages;
3. multiple layers;
4. duplicate IDs;
5. edge with broken source;
6. edge with broken target;
7. broken parent;
8. broken layer;
9. element without ID;
10. unknown element;
11. parent cycle;
12. HTML label and dangerous metadata keys;
13. background-page derived page snapshot.

Tests cover determinism, non-mutation, JSON serialization, duplicate IDs,
broken references, malformed input, prototype pollution, limits, indexes,
canonical input without the legacy adapter, a second simulated source producing
the same canonical shape, adapter layer/parent classification, simple reference
conversion, inherited label/metadata conversion and a structural check that core
modules do not import the legacy adapter.

## Benchmark

`packages/cyberdraw-graph-model/src/performance.test.ts` is a non-blocking
performance smoke test for 100, 2,000 and 20,000 generated elements. It measures
normalization time, approximate heap delta and broken-reference detection time
inside the test process but does not enforce product thresholds.

Local evidence from the initial implementation:

- package build passed;
- package tests passed with 28 tests after the core/adapter boundary refactor;
- 100, 2,000 and 20,000 element performance cases completed in the package test
  run.

One local Node.js run after build measured:

| Elements | Normalize + validate | Approx heap delta | Findings |
| ---: | ---: | ---: | ---: |
| 100 | 9.26 ms | 0.42 MiB | 0 |
| 2,000 | 60.12 ms | 6.11 MiB | 0 |
| 20,000 | 401.52 ms | 61.05 MiB | 0 |

These values are evidence for feasibility, not service-level guarantees.

## Results

Confirmed:

- a reconstructable snapshot can be built from inherited plain read data;
- Alternative C is practical as a pure private workspace package;
- the core can normalize canonical input without depending on
  `list-paged-model` names or mxCell-shaped references;
- deterministic internal IDs can preserve draw.io correlation and handle missing
  or duplicate draw.io IDs in a bounded way;
- broken source, target, parent, layer, page, child and duplicate/ambiguous
  reference findings are detectable without browser or MCP dependencies.

Not proven:

- runtime extraction completeness across real draw.io versions;
- stable identity across page moves or imports;
- payload size across WebSocket for full large diagrams;
- persistence, lifecycle or user-facing review of findings;
- semantic domain extensions.

## Divergences From RFC 0001

- `Port` is omitted entirely.
- `ShapeReference` and namespaced semantic extensions are omitted.
- Findings are limited to `BrokenReferenceFinding` and have no severity,
  lifecycle, confidence or persistence.
- Snapshot revisions and content hashes are omitted.
- `childIds` are not canonical storage; they are accepted only when materialized
  by input so missing child references can be detected.
- The package starts with TypeScript contracts and debug JSON serialization, not
  a public JSON Schema.
- `CanonicalDiagramInput` is an internal experimental boundary, not a stable
  public schema.

## Risks

- The adapter still depends on inherited cell-shape conventions and may miss
  browser-only draw.io semantics.
- Full snapshots for very large diagrams may be too heavy without later payload
  limits or paging discipline.
- Appearance-index identity is deterministic but fragile across reorderings.
- Broken reference semantics may need refinement once real malformed XML
  fixtures are collected.
- The package still exposes the legacy adapter from the main entrypoint for
  convenience; formal separated entrypoints are deferred.
- Future experiments remain open: XML adapter, plugin snapshot handler, Zod,
  JSON Schema, generic `externalIds`, stable public API, snapshot revisions,
  identity across snapshots, 100,000 element stress tests, runtime integration
  and any new MCP tool wrapper.

## Recommended Decision

ADR 0003 accepts RFC 0001 Alternative C as the internal graph model architecture:
`packages/cyberdraw-graph-model` remains a private independent package,
server-first adoption is the initial path and the plugin is limited initially to
plain-data snapshot extraction. Runtime integration, snapshot extraction
contracts and public compatibility boundaries remain deferred until the ADR exit
criteria are met.
