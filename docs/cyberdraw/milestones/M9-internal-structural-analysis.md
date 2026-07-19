# M9: Internal Structural Analysis

## Status

COMPLETE internal milestone evidence.

M9 remains private. It does not add a public MCP tool, public schema, public MCP
response, persistence, database, semantic diff, change plans, mutation plans,
streaming, chunking, incremental analysis, stable identity or a generic rule
engine.

## Objective

M9 builds the first end-to-end internal structural analysis vertical on top of
M8:

```text
runtime snapshot
-> hierarchical planner
-> scoped execution
-> bounded expansion
-> contextual merge
-> internal graph model
-> structural analysis result
```

The result is deterministic, JSON-compatible and bounded. It reports broken
references, cross-layer edges, orphan elements, structural counts, coverage,
diagnostics, limitations, completeness and stop reason.

## Scope

Implemented:

- pure structural analysis in `packages/cyberdraw-graph-model`;
- private server integration for internal `analyze-structure` intent;
- scoped coverage and completeness propagation;
- deterministic finding IDs and canonical ordering;
- unit matrices for broken references, cross-layer edges, orphans,
  determinism, coverage and moderate graphs;
- real draw.io evidence for expansion plus all three finding categories.

## Non-Scope

M9 intentionally does not implement:

- public MCP tool or schema;
- persisted findings;
- user-configurable severity;
- semantic diff or mutation/change plans;
- rule engine;
- quality score;
- chunking, streaming or incremental analysis;
- stable identity across revisions.

## Architecture

The pure API is `analyzeGraphStructure(input)` in
`packages/cyberdraw-graph-model/src/structural-analysis.ts`.

The function has no dependency on WebSocket, Chromium, draw.io runtime, MCP SDK,
server code, plugin code, filesystem, clocks, environment variables or
transport. It accepts an already-built `DiagramSnapshot` plus optional
JSON-compatible analysis context: coverage, unresolved external references,
diagnostics, stop reason, revision evidence and byte limits.

The server calls it only after:

1. planning the internal intent;
2. executing scoped snapshots;
3. expanding resolvable external terminal references;
4. validating freshness;
5. merging scoped results;
6. adapting the merged runtime snapshot to the internal graph model.

The result is stored on the private `SnapshotPlanExecutionResult` as
`structuralAnalysis`. It is not registered in the tool registry.

## API Internal

`analyzeGraphStructure(input)` returns:

- `analysisVersion`;
- `documentId`;
- `revisionEvidence`;
- `coverage`;
- `counts`;
- `findings`;
- `diagnostics`;
- `limitations`;
- `completeness`;
- `stopReason`;
- optional byte `limits`.

Findings include only IDs and structural context. They do not include labels,
XML, full graph dumps, paths, hostnames or environment data.

## Definitions

### Broken References

A broken reference is a materialized or externally declared structural reference
that cannot resolve to exactly one compatible target under sufficient coverage.

M9 detects:

- edge `sourceId` pointing to a missing element;
- edge `targetId` pointing to a missing element;
- containment `parentId` pointing to a missing materialized element;
- external reference whose exact target is not materialized after sufficient
  page/layer coverage;
- ambiguous exact target matches.

Statuses:

- `broken`: coverage is sufficient and the target is absent;
- `unresolved`: reserved for unresolved evidence that is not classifiable as
  broken;
- `ambiguous`: more than one compatible target exists;
- `outside-coverage`: the current scope cannot prove the target absent;
- `external-context-not-loaded`: runtime supplied target location but that
  context was not loaded.

Auxiliary layer-parent references emitted by layer scopes are ignored as
context, not reported as broken parent references.

### Cross-Layer Edges

An edge is a same-page cross-layer edge when its source and target are both
materialized, both endpoints have known layer membership, both are in the same
document, both are not `contextOnly`, and the layers differ.

M9 also classifies:

- `cross-page-edge`;
- `unresolved-cross-layer-candidate`;
- `context-only-endpoint`.

Cross-layer findings are informational structural findings, not errors.

### Orphan Policy

An orphan is a materialized eligible node or group with no relevant structural
relations:

- no incoming edge;
- no outgoing edge;
- no containment parent;
- no materialized child;
- no pending source/target external reference that could connect it.

Confirmed orphans require conclusive complete-document or complete-target-scope
coverage.

Excluded from orphan analysis:

- pages;
- layers;
- edges;
- root cells and layer context;
- `contextOnly` elements;
- technical containers without stable materialized identity;
- elements whose relevant relations may be outside current coverage.

## Finding IDs

Finding IDs are `m9-` plus a local FNV-1a 64-bit hash of canonical structural
parts: finding type, reference or relation type, source/element ID,
target/referenced ID, page/layer context and reason code.

IDs are deterministic for the same graph input, independent of array order,
timestamps and labels. They do not promise stability across future document
revisions.

## Canonical Ordering

Findings are sorted by:

1. finding type;
2. page ID;
3. layer ID;
4. source or element ID;
5. referenced or target ID;
6. reason code;
7. finding ID.

Diagnostics and revision evidence are also sorted where order would otherwise
depend on input ordering.

## Coverage And Completeness

Completeness values:

- `complete-document`;
- `complete-target-scopes`;
- `partial`;
- `truncated`;
- `stale`;
- `unknown`.

Counts use bases:

- `exact` for complete document;
- `observed` for complete target scopes;
- `partial` for partial/truncated;
- `unknown` for stale/unknown.

M9 does not treat partial coverage as stale, and does not mark absent
out-of-scope targets as broken.

## Counts

Counts include:

- `pageCount`;
- `layerCount`;
- `elementCount`;
- `nodeCount`;
- `edgeCount`;
- `connectedNodeCount`;
- `orphanElementCount`;
- `brokenReferenceCount`;
- `crossLayerEdgeCount`;
- `unresolvedExternalReferenceCount`;
- `contextOnlyElementCount`.

## Real-Environment Fixture

The real test in
`packages/drawio-mcp-server/src/real-environment/hierarchical-snapshot.test.ts`
creates one synthetic draw.io page with two layers:

- Layer A: `source-a`, `orphan-a`, one cross-layer edge, one edge with a
  synthetic missing terminal;
- Layer B: `target-b`.

The test starts with a layer-A `analyze-structure` scope. The first real runtime
snapshot observes the cross-layer target as an external reference and derives a
second layer-B scope. No document scope is requested. The second snapshot is
executed by the real plugin, merged, adapted to graph model and analyzed.

Observed evidence:

- same-page cross-layer finding;
- broken target reference to `missing-terminal`;
- confirmed orphan finding;
- compatible revision evidence;
- UI state preserved;
- browser/server logs clean;
- harness cleanup completes.

## Limits And Security

The analysis is O(V + E + R) over elements, edges and external references using
maps and sets. It uses no recursion, no global accumulation and no persistence.

Security/privacy checks:

- finding IDs do not include labels;
- findings do not include labels or XML;
- no full graph dumps are logged;
- no filesystem paths, hostnames or environment dumps are included;
- raw metadata remains bounded by the graph-model sanitizer;
- dangerous prototype keys are already stripped by `safe-json`.

## Compatibility

M9 extends private package/server types only. Existing MCP tools, schemas,
plugin public behavior and WebSocket public surface are unchanged. RFC 0001
remains Draft.

## Rollback

Rollback removes:

1. `structural-analysis.ts` and tests;
2. private `structuralAnalysis` field on `SnapshotPlanExecutionResult`;
3. server call from `executeHierarchicalSnapshotPlan`;
4. M9 unit and real-environment tests;
5. M9 documentation references.

No migration is required because no public API or persistence was added.

## Exit Criteria

M9 is COMPLETE because:

- pure structural analysis exists;
- output is deterministic and JSON-compatible;
- broken/unresolved/ambiguous/outside-coverage are separated;
- cross-layer edges require exact materialized endpoint context;
- orphans use conservative coverage-aware policy;
- finding IDs and ordering are deterministic;
- coverage/completeness are explicit;
- private integration uses planner, executor, merge and graph model;
- real draw.io evidence demonstrates broken reference, cross-layer edge and
  confirmed orphan;
- document scope is not requested unnecessarily;
- freshness, UI preservation and cleanup are covered by tests;
- no public MCP tool or schema was added.
