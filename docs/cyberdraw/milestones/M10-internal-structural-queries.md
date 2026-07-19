# M10: Internal Structural Queries

## Status

COMPLETE internal milestone evidence.

M10 remains private. It does not add a public MCP tool, public schema, public
MCP response, HTTP endpoint, persistence, database, semantic search, full-text
search, embeddings, semantic diff, change plans, mutation plans, streaming,
chunking, incremental analysis, stable identity, SQL, JSONPath, user regular
expressions, global scoring or a generic rule engine.

## Objective

M10 adds deterministic internal queries over an already materialized M9
`StructuralAnalysisResult`:

```text
runtime snapshot
-> hierarchical planner
-> scoped executor
-> expansion
-> merge
-> graph model
-> structural analysis
-> internal structural query
```

The query layer lists, filters, looks up, groups, orders, paginates and
summarizes M9 findings and counts without reinterpreting XML and without
walking the live draw.io runtime.

## Scope

Implemented:

- pure query API in `packages/cyberdraw-graph-model`;
- closed query kinds and closed ordering/grouping options;
- exact filters for finding type, classification, reason, page, layer,
  element, source, target, referenced ID, confidence and coverage/completeness;
- deterministic ordering and pagination;
- explicit limits and validation diagnostics;
- exact finding lookup with duplicate-ID validation failure;
- deterministic summaries;
- counts query that reuses M9 counts and bases;
- coverage requirement checks that preserve M9 coverage and completeness;
- private server executor integration that reuses the M9 result in the same
  execution;
- real draw.io evidence over the existing M9 fixture.

## Non-Scope

M10 intentionally does not implement:

- public MCP tool or schema;
- new public response shape;
- endpoint, persistence, cache, database or index;
- label search, full-text search, semantic search or embeddings;
- arbitrary query language, SQL, JSONPath or user-provided regex;
- severity scoring or global quality score;
- semantic diff, change plans, mutation plans or automatic fixes;
- graph recalculation for query answers;
- stable finding identity across document revisions.

## Architecture

The pure API is `queryStructuralAnalysis(input)` in
`packages/cyberdraw-graph-model/src/structural-query.ts`.

The function depends only on `StructuralAnalysisResult`, an internal typed query
and explicit query limits. It has no dependency on filesystem, network,
WebSocket, Chromium, draw.io runtime, server code, plugin code, clocks,
environment variables or global mutable state.

The server integration is private. `executeHierarchicalSnapshotPlan()` accepts
an optional `structuralQuery` and, only after it has produced
`structuralAnalysis`, calls `queryStructuralAnalysis()` and attaches
`structuralQueryResult` to the private execution result. If no graph or no M9
analysis exists, no query result is produced.

## API Pure

Input:

- `analysis`: a M9 `StructuralAnalysisResult`;
- `query`: a closed `StructuralAnalysisQuery`;
- optional `limits`.

Output:

- `results` and optional `finding`;
- `totalMatched`, `returned`, `offset`, `limit`, `hasMore`;
- `ordering`;
- optional `groups` or `summary`;
- preserved `coverage`, `completeness`, analysis diagnostics, limitations and
  stop reason;
- query diagnostics;
- internal outcome: `ok`, `invalid-query`, `insufficient-coverage` or
  `validation-failed`.

The output is JSON-compatible and deterministic.
Returned findings, counts, coverage, diagnostics and limitations are defensive
JSON-compatible copies; callers cannot mutate the original M9 analysis through a
query response.

## Query Kinds

- `list-findings`: filters, orders and paginates findings.
- `get-finding`: exact `findingId` lookup.
- `summarize`: deterministic buckets by a closed grouping key.
- `counts`: returns the existing M9 counts and bases.

There is no free-form query language.

## Filters

`list-findings` and `summarize` support:

- `findingTypes`;
- `classifications`;
- `reasonCodes`;
- `pageIds`;
- `layerIds`;
- `elementIds`;
- `sourceIds`;
- `targetIds`;
- `referencedIds`;
- `confidences`;
- `completenesses`;
- `coverageClasses`;
- `includeContextOnly`.

All filters are exact. ID filters are case-sensitive. Empty filter arrays are
treated as absent filters. Labels, XML, provenance text, diagnostics text and
metadata text are not searched.

## AND/OR Semantics

Filters combine with AND across categories and OR inside a category.

Example:

```json
{
  "findingTypes": ["broken-reference", "cross-layer-edge"],
  "pageIds": ["page-a"],
  "layerIds": ["layer-b"]
}
```

means:

```text
(broken-reference OR cross-layer-edge)
AND page-a
AND layer-b
```

This is covered by unit tests.

## Element Matching

`elementIds` matches when the requested ID appears in structural identifier
fields:

- broken references: `sourceElementId` or `referencedElementId`;
- cross-layer findings: `edgeId`, `sourceElementId` or `targetElementId`;
- orphan findings: `elementId`.

M9 currently does not expose `parentId` as a finding field; M10 cannot match it
without returning to graph data, so it does not invent parent matches. M10 does
not search labels, provenance text or diagnostics.

## Ordering

Supported orders:

- `canonical`;
- `finding-type`;
- `page-layer`;
- `finding-id`.

Default `canonical` reconstructs M9's canonical structural order and is stable
even if a caller supplies the finding array in a different order. Arbitrary
fields are rejected.

## Pagination

Pagination applies after filtering and ordering.

`offset` is zero-based. Offset beyond the result set returns an empty page.
`limit: 0` is valid: `returned` is `0`, `results` is empty, `totalMatched`
preserves the filtered total and `hasMore` is `offset < totalMatched`.

## Limits

Default limits:

- `defaultLimit`: 100;
- `maxLimit`: 500;
- `maxFilterValues`: 50;
- `maxGroupBuckets`: 100;
- `maxIdentifierLength`: 512.

Negative offsets and limits are rejected. Limits above `maxLimit` are clamped
with an explicit `limit-clamped` diagnostic. Excessive filter arrays and
overlong IDs are rejected. Unsafe objects containing `__proto__`, `constructor`
or `prototype` keys are rejected.

## Coverage Requirements

Supported requirements:

- `any`;
- `non-stale`;
- `complete-target-scopes`;
- `complete-document`.

`complete-document` satisfies all non-stale requirements.
`complete-target-scopes` satisfies itself and weaker non-stale requirements.
`partial`, `truncated` and `unknown` satisfy `any` and `non-stale` only. `stale`
does not count as partial and is rejected for every requirement, including
`any`, with a `stale-analysis` diagnostic.

## Insufficient Coverage

When the analysis does not satisfy a query coverage requirement, M10 returns:

- outcome `insufficient-coverage`;
- no findings;
- no summary/counts payload for `summarize` or `counts`;
- preserved M9 diagnostics and limitations;
- structured query diagnostics with `insufficient-coverage` or
  `stale-analysis`.

M10 does not execute a new snapshot, replan or rerun analysis automatically.

## Diagnostics

M10 preserves M9 diagnostics as `analysisDiagnostics` and adds separate
`queryDiagnostics`.

Query diagnostic codes are closed:

- `invalid-query`;
- `invalid-filter`;
- `excessive-filter-values`;
- `invalid-offset`;
- `invalid-limit`;
- `limit-clamped`;
- `insufficient-coverage`;
- `finding-not-found`;
- `unsupported-order`;
- `unsupported-group`;
- `stale-analysis`;
- `validation-failed`.

Diagnostics do not include labels, XML, paths, hostnames or environment data.

## Summaries

Supported groups:

- `finding-type`;
- `classification`;
- `reason-code`;
- `page`;
- `layer`;
- `completeness`;
- `coverage`.

Buckets are deterministic and include `key`, `count`, `countBasis` and coverage
context where relevant. Buckets are sorted by key. Labels and diagram content
are not included. M10 does not compute severities.

## Counts

`counts` returns a defensive copy of `analysis.counts` and preserves each count basis.
It does not recompute from findings and does not merge categories:

- broken references remain distinct from unresolved references;
- confirmed orphan counts remain distinct from possible orphan findings;
- same-page cross-layer counts remain distinct from cross-page findings;
- partial bases are not promoted to exact.

## Integration

The private server executor accepts `structuralQuery` and
`structuralQueryLimits` options. The query runs only after M9 analysis is
available and uses that in-memory result. It preserves plan, scopes, bytes,
coverage, diagnostics and stop reason on the surrounding execution result.

No MCP tool registry entry, public schema, public response or endpoint was
added.

## Real Fixture

The real draw.io fixture in
`packages/drawio-mcp-server/src/real-environment/hierarchical-snapshot.test.ts`
is the M9 fixture:

- initial narrow layer-A `analyze-structure` scope;
- layer-B expansion from a real external terminal reference;
- no document scope;
- one broken target reference to `missing-terminal`;
- one same-page cross-layer edge;
- one confirmed orphan;
- compatible revision evidence;
- UI state preserved.

The M10 test runs:

- integrated broken-reference query;
- layer query;
- cross-layer query;
- orphan query;
- exact lookup by `findingId`;
- summary by finding type;
- counts query;
- satisfied coverage requirement;
- insufficient coverage requirement.

Instrumentation records two scoped runtime snapshot requests plus the initial
inventory request for the M9 execution, one M9 analysis invocation and nine M10
query invocations. The test captures snapshot request count, executed step count
and analysis invocation count before and after the pure post-analysis queries;
only query invocations increase.

## Evidence

Focused evidence during implementation:

```sh
pnpm --filter cyberdraw-graph-model build
pnpm --filter cyberdraw-graph-model test -- --runInBand structural-query
pnpm --filter drawio-mcp-server build
NODE_OPTIONS=--experimental-vm-modules ./node_modules/.bin/jest packages/drawio-mcp-server/build/cyberdraw-hierarchical-snapshot.test.js --runInBand
```

Full validation evidence must be recorded in the final implementation report.

## Security

M10 does not expose labels, XML, graph dumps, paths, hostnames or environment
dumps. IDs and arrays are bounded. There is no regex, arbitrary language,
semantic search, persistence, singleton mutable state or filesystem access.

## Performance

Complexity:

- filtering: O(F);
- lookup: O(F), with duplicate-ID detection;
- summaries: O(F);
- ordering: O(F log F) over matched findings;
- counts: O(1) with respect to findings.

No recursive traversal or benchmark-specific milestone was introduced.

## Compatibility

M10 extends private package/server types only. Existing MCP tools, plugin
public behavior, WebSocket messages and public schemas are unchanged. RFC 0001
remains Draft. ADR 0004 is unchanged.

## Rollback

Rollback removes:

1. `structural-query.ts` and tests;
2. graph-model exports for query types/functions;
3. optional `structuralQueryResult` from private execution results;
4. optional query execution in `executeHierarchicalSnapshotPlan()`;
5. M10 test additions and docs references.

No migration is required because no public API or persistence was added.

## Exit Criteria

M10 is COMPLETE when the pure query layer, closed query model, exact filters,
AND/OR semantics, deterministic ordering, stable pagination, validated limits,
duplicate lookup validation, deterministic summaries, count-basis preservation,
coverage honesty, stale handling, diagnostic preservation, private M9 reuse,
real draw.io evidence, public-surface scan and documentation all pass.

## Final Status

COMPLETE. The implementation satisfies the private internal query objective
without adding a public MCP surface or returning to draw.io runtime data for
query answers.
