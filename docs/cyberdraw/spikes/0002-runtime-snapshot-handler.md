# Spike 0002: Runtime Snapshot Handler

## Status

M3 internal read-only prototype.

This spike adds an internal runtime snapshot path for CyberDraw graph-model
validation. It does not add a public MCP tool, does not change existing MCP
tool responses, does not persist snapshots and does not define a stable public
schema.

## Objective

Validate ADR 0003 runtime-integration exit criteria by extracting bounded
plain-data snapshots from the live draw.io runtime and adapting them into
`packages/cyberdraw-graph-model`.

The validated boundary is:

```text
draw.io runtime
-> internal snapshot extraction
-> plain-data snapshot
-> runtime snapshot adapter
-> CanonicalDiagramInput
-> cyberdraw-graph-model
```

## Architecture

Implemented components:

- plugin extractor: `packages/drawio-mcp-plugin/src/runtime-snapshot.ts`;
- internal plugin dispatch only:
  `packages/drawio-mcp-plugin/src/bootstrap.ts`;
- server internal requester:
  `packages/drawio-mcp-server/src/cyberdraw-runtime-snapshot.ts`;
- graph-model adapter:
  `packages/cyberdraw-graph-model/src/runtime-snapshot-adapter.ts`;
- runtime fixture tests:
  `packages/cyberdraw-graph-model/src/fixtures/runtime-snapshot-fixtures.ts`;
- real environment coverage:
  `packages/drawio-mcp-server/src/real-environment/runtime-snapshot.test.ts`.

The extractor runs in the browser plugin because only the plugin may know
draw.io runtime objects. The snapshot result is JSON-compatible data only.
The graph-model package receives only the plain snapshot through a separate
adapter.

## Internal Message

The prototype uses one new internal WebSocket event:

```text
cyberdraw.runtimeSnapshot.v1
```

Request shape:

```ts
{
  target_document?: { id: string };
  limits?: Partial<RuntimeSnapshotLimits>;
  includeRaw?: boolean;
}
```

The server calls it through `build_channel()` with document routing, queueing
and a 90 second internal timeout. The event is not registered in
`packages/drawio-mcp-server/src/tools/index.ts`, so MCP clients cannot call it
as a public tool. Older plugin peers ignore the unknown event; the server-side
helper times out with the existing timeout behavior.

No existing WebSocket message shape was changed.

## Snapshot Format

Top-level shape:

```ts
{
  schemaVersion: "cyberdraw.runtime-snapshot.v1";
  document: {
    id?: string;
    title?: string;
    mode?: string;
    fileUrl?: string;
    fileHash?: string;
    pageCount: number;
    currentPageId?: string;
    runtimeVersion?: string;
    extractedAt: string;
    revisionSignals: {
      documentId?: string;
      fileHash?: string;
      pageIds: string[];
      contentRevision: string;
      semanticRevision?: string;
    };
  };
  pages: RuntimeSnapshotPage[];
  diagnostics: RuntimeSnapshotDiagnostic[];
  truncated: boolean;
  limits: RuntimeSnapshotLimits;
  performance: {
    extractionMs: number;
    serializationMs: number;
    approximateJsonBytes: number;
  };
}
```

Pages include `id`, `index`, `name`, `visible`, `background`, metadata,
deterministically ordered layers and deterministically ordered elements.

Layers include `id`, `name`, `visible`, `locked`, `pageId` and `index`.

Elements include draw.io `id`, `pageId`, `layerId`, containment `parentId`,
`sourceId`, `targetId`, provisional `type`, inert label data, raw style plus
parsed properties, geometry, waypoints, relative geometry, tags, custom
attributes and bounded raw flags.

The extractor does not force semantics unavailable from the runtime. Unknown
cells remain `type: "unknown"` and are adapted to graph-model `unknown`
elements.

## Limits

Internal defaults:

| Limit | Default |
| --- | ---: |
| Pages | 100 |
| Layers per page | 100 |
| Elements per page | 25,000 |
| Label length | 8,192 chars |
| Style length | 8,192 chars |
| Metadata keys | 64 |
| Metadata string length | 8,192 chars |
| Raw depth | 4 |
| Raw keys | 64 |
| Array items | 1,000 |
| Approximate snapshot JSON size | 16 MiB |

Limit hits set `truncated: true` and add explicit diagnostics such as
`page_limit_reached`, `layer_limit_reached`, `element_limit_reached`,
`string_truncated`, `metadata_limit_reached` or
`snapshot_size_limit_reached`.

These limits are internal prototype values, not a public API.

## Background Pages

The extractor reuses existing background-page execution helpers. For pages that
are not visible, it creates a temporary graph, reads the page, then destroys the
temporary graph in `finally`.

The real-environment test validates:

- visible and background pages are both included;
- layers and elements are present for both pages;
- the active page does not change after snapshot extraction;
- selection does not change after snapshot extraction;
- snapshot extraction is JSON-serializable;
- truncation diagnostics are emitted;
- cleanup runs through normal and error paths covered by the helper structure.

## Revision Strategy

Implemented:

- `contentRevision`: deterministic FNV-1a 32-bit hash of a stable stringified
  snapshot base excluding `extractedAt`, performance fields and visible-page UI
  state;
- document revision signals: document id, file hash when draw.io exposes it,
  page ids and runtime version when available.

Deferred:

- `semanticRevision`.

Reason: this spike cannot rigorously prove which visual, style, label, metadata
or container changes are semantically irrelevant. Emitting a semantic revision
now would hide relevant changes. The snapshot includes a
`semantic_revision_deferred` diagnostic.

The real-environment test modifies a cell directly in the draw.io runtime after
the first snapshot and verifies that a new snapshot produces a different
`contentRevision`.

## Fixtures

Covered by runtime fixture and tests:

1. simple page;
2. multiple pages;
3. background page;
4. multiple layers;
5. group and containment;
6. connected edge;
7. disconnected/broken edge reference;
8. relative geometry;
9. waypoints;
10. HTML label;
11. custom attributes;
12. unknown element;
13. broken references;
14. generated large snapshots through performance tests.

Fixtures contain synthetic labels and IDs only.

## Tests

Graph-model tests cover runtime snapshot adapter conversion, layer versus
parent handling, unknown elements, broken references, inert HTML, dangerous
metadata, non-mutation and determinism.

Server tests cover internal-channel timeout for peers without support and a
real draw.io environment snapshot over visible and background pages.

Existing public tool tests continue to exercise `list-pages`, `list-layers`,
`list-paged-model`, page routing, queues, timeouts and connected documents.

## Performance

Measured fields are separated in the snapshot performance object:

- browser extraction time;
- stable serialization time;
- approximate JSON bytes.

Graph-model performance smoke tests continue to measure generated 100, 2,000
and 20,000 element normalization/validation. Local validation for this spike
confirmed the graph-model performance suite passes.

One local real-browser benchmark generated plain rectangle vertices directly in
the draw.io runtime, requested the internal snapshot, adapted it, normalized it
and validated broken references:

| Elements | Extract | Serialize | Adapt | Normalize | Validate | JSON bytes | Truncated |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 100 | 4.50 ms | 1.60 ms | 4.86 ms | 5.77 ms | 0.41 ms | 40,386 | no |
| 2,000 | 21.30 ms | 26.40 ms | 25.87 ms | 26.97 ms | 1.34 ms | 797,018 | no |
| 20,000 | 169.00 ms | 239.50 ms | 201.66 ms | 306.59 ms | 11.74 ms | 8,039,673 | no |

The benchmark used simple generated vertices, so it is payload evidence, not a
representative product workload for labels, metadata-heavy cells or complex
edges.

No product SLA is claimed.

## Compatibility

The real-environment test uses the currently configured draw.io test asset. In
this local run, the cached asset root was
`/home/sergiovigo/.cache/drawio-mcp-server/webapp` and
`readCachedDrawioVersion()` reported draw.io `30.3.12`. The fixture records
`runtimeVersion` when exposed by the runtime. A second draw.io runtime version
was not available in this local infrastructure during the spike; compatibility
remains evidence-pending before product acceptance.

Peers without the new internal message are not broken: they ignore the event and
the server helper times out. Existing MCP tools and public responses are not
registered or modified by this spike.

## Security

Controls:

- snapshot objects created without inherited prototypes in the plugin;
- dangerous keys `__proto__`, `prototype` and `constructor` are removed;
- functions and runtime objects are not preserved;
- cycles are detected during bounded raw preservation;
- HTML labels are inert strings and are never executed;
- strings, arrays, raw depth, raw keys and metadata keys are limited;
- snapshots are `JSON.stringify` compatible;
- no persistence, sidecar, database or filesystem access is added;
- graph-model package remains filesystem-free.

Error messages are capped before being returned in diagnostics.

## Rollback

Rollback is straightforward:

1. remove `runtime-snapshot.ts` and the internal handler registration from the
   plugin bootstrap;
2. remove `cyberdraw-runtime-snapshot.ts` from the server;
3. remove `runtime-snapshot-adapter.ts` and its tests/fixtures from the graph
   model;
4. remove this spike documentation.

No public MCP tool or response contract needs migration.

## Limitations

- Snapshot schema is internal and experimental.
- Stable identity across snapshots remains unresolved.
- `semanticRevision` is deferred.
- Large WebSocket payload strategy is not accepted as product behavior.
- No incremental, page-only or delta snapshot protocol exists.
- No public graph-model API, JSON Schema or MCP tool is introduced.
- Cross-version draw.io compatibility needs more evidence.

## Recommendation

Proceed to the next phase with the internal event still private. Before
productizing any runtime graph-model feature, add broader draw.io-version
fixtures, repeat browser payload benchmarks for 2,000 and 20,000 elements,
define stale-read policy around `contentRevision`, and decide whether runtime
snapshots should remain full-document or gain internal page-scoped paging.
