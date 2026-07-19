# M11: Internal Structural Change Planning

## Status

COMPLETE internal milestone evidence.

M11 remains private. It does not add a public MCP tool, public schema, HTTP
endpoint, persistence, database, semantic diff, rollback executor, approval
workflow, XML editing, draw.io command execution, mutation application or stable
identity guarantees.

## Objective

M11 adds a pure deterministic planning layer after M9 structural analysis and
optional M10 structural query selection:

```text
runtime snapshot
-> hierarchical planner
-> scoped executor
-> expansion
-> merge
-> graph model
-> structural analysis
-> structural query
-> internal change plan
```

A change plan is a proposal only. It is not a mutation, an execution command or
a guarantee that a future change is safe or applicable.

## Scope

Implemented:

- pure `planStructuralChanges(input)` in `packages/cyberdraw-graph-model`;
- closed outcome, policy, proposal, operation, precondition, postcondition,
  diagnostic and conflict types;
- deterministic `m11-plan-*`, `m11-proposal-*` and `m11-conflict-*` IDs;
- exact finding selection by IDs or by an already produced M10 query result;
- conservative planning for broken references, orphans, cross-layer edges,
  ambiguous references and unresolved external context;
- conflict detection over abstract targets;
- private server integration on `executeHierarchicalSnapshotPlan()` that
  reuses the same M9/M10 results and adds no public tool surface.

## Non-Scope

M11 intentionally does not implement:

- graph, XML, draw.io runtime, editor, filesystem or database mutation;
- public JSON Patch or RFC 6902 contract;
- public MCP tool, registry entry, schema or endpoint;
- automatic candidate selection for ambiguous references;
- semantic diff, approval workflow, undo/redo, rollback or history;
- rule DSL, scripting, SQL, JSONPath, regex search, embeddings, streaming,
  chunking or revision-to-revision identity matching.

## Architecture

`structural-change-plan.ts` lives in `cyberdraw-graph-model` because the
planning semantics depend only on M9/M10 structural data. The server only wires
the optional private call after `structuralAnalysis` and optional
`structuralQueryResult` already exist.

The planner has no dependency on WebSocket, MCP SDK, Chromium, draw.io runtime,
filesystem, network, clocks, random values, environment variables or mutable
singletons.

## API Pure

`planStructuralChanges(input)` accepts:

- `analysis: StructuralAnalysisResult`;
- `selectedFindingIds?: readonly string[]`;
- `queryResult?: StructuralAnalysisQueryResult`;
- `policy?: StructuralChangePlanPolicy`;
- explicit `limits`;
- optional review context with expected revision evidence.

It returns a JSON-compatible `StructuralChangePlan` with plan identity,
document/revision evidence, selected finding IDs, proposals, conflicts,
preconditions, diagnostics, limitations and summary counts.

## Plan Model

The plan includes:

- `planVersion`, deterministic `planId`, `documentId`, optional
  `documentRevision`, `analysisVersion` and optional `queryVersion`;
- `selectedFindingIds`, `selectedFindingCount`, `proposalCount`,
  `conflictCount`, `skippedCount` and `manualReviewCount`;
- `outcome`, `coverage`, `completeness`, `revisionCompatible`, diagnostics,
  limitations and summary;
- canonical ordering for selected IDs, proposals, conflicts, preconditions and
  diagnostics.

## Proposal Model

Each proposal includes:

- deterministic `proposalId`;
- `sourceFindingIds`;
- closed `proposalType`;
- structural target identity only;
- declarative abstract operation;
- declarative preconditions;
- expected postconditions;
- closed risk flags;
- evidence class, rationale code, coverage context, minimal provenance and
  status.

Labels, XML, diagram content and host/filesystem data are not included.

## Outcomes

Closed outcomes:

- `planned`;
- `planned-with-review`;
- `no-op`;
- `manual-review`;
- `conflict`;
- `insufficient-coverage`;
- `stale-analysis`;
- `unsupported-finding`;
- `invalid-input`;
- `validation-failed`;
- `blocked-by-policy`.

Priority is validation first, then stale/coverage, then conflicts, then planned,
review and no-op outcomes.

## Policies

Policies are closed typed fields:

- `conservative`;
- `review-only`;
- `allowDeleteConfirmedOrphans`;
- `allowDetachBrokenTerminals`;
- `allowRemoveDanglingEdges`;
- `allowCrossLayerReview`;
- `allowCrossLayerReconnect`;
- `requireCompleteDocument`;
- `requireCompleteTargetScopes`;
- `orphanDefaultAction`;
- `crossLayerDefaultAction`.

There is no policy language or arbitrary rule engine.

## Conservative Defaults

Default policy is conservative:

- broken references require review unless detach/remove is explicitly allowed;
- ambiguous references require review;
- unresolved external context loads context or requires review;
- cross-layer edges are review findings, not errors;
- orphans are manual review by default;
- delete requires explicit policy and sufficient coverage.

## Broken Reference Planning

For terminal references with status `broken`, M11 may propose
`detach-broken-terminal` or `remove-dangling-edge` only under explicit policy
and sufficient non-stale target-scope or document coverage.

M11 never invents a replacement target and never picks an alternate candidate.

## Orphan Planning

Confirmed orphans default to `manual-review`. `retain-orphan-element` requires
explicit retain policy. `delete-orphan-element` requires
`allowDeleteConfirmedOrphans` and sufficient coverage.

Possible orphans never produce delete.

## Cross-Layer Planning

Cross-layer edges are not errors by default. The default proposal is
`review-cross-layer-edge`; `crossLayerDefaultAction: "no-op"` produces a no-op.
`allowCrossLayerReconnect` alone does not produce a reconnect operation because
M11 has no closed reconnect strategy field. It degrades to `manual-review`
unless a future internal policy supplies an unequivocal target strategy.

## Ambiguous And Unresolved

Ambiguous references produce `manual-review`. M9 does not expose safe candidate
sets, so M11 does not produce `resolve-ambiguous-reference` candidates yet.

Unresolved external context can produce `load-external-context`; it cannot
produce a definitive structural mutation.

## Preconditions

Proposal preconditions include document identity, optional document revision,
finding existence, unchanged classification, unchanged target identity,
page/layer context, coverage satisfaction, absent or ambiguous reference state
and no accepted conflicting proposal.

Preconditions are declarative and not executed by M11.

## Postconditions

Postconditions are expectations only, such as terminal reference absent,
dangling edge removed, external context available or finding expected to require
reevaluation after reanalysis. M11 does not guarantee that a finding disappears.

## Deterministic IDs

Plan, proposal and conflict IDs use canonical JSON serialization with sorted
object keys and FNV-1a 64-bit hashing. Namespaces are distinct:

- `m11-plan-*`;
- `m11-proposal-*`;
- `m11-conflict-*`.

IDs include structural fields, policy, selected findings and revision evidence
where available. They do not include timestamps, UUIDs, labels or diagram
content and do not promise stability across document revisions.

## Conflicts

M11 detects conflicting abstract proposals, including same-terminal operations,
delete versus retain for the same element, delete versus reconnect target,
multiple target layers for the same move, remove versus reconnect for the same
edge and ambiguous proposal targets.

Conflicts have deterministic IDs, reference proposal IDs and set
`resolution: "manual-review"`. M11 does not resolve conflicts automatically.

## Coverage

M11 preserves M9 coverage and completeness. It does not improve coverage.

`stale` always blocks. `partial`, `truncated` and `unknown` block destructive
operations. `complete-target-scopes` can allow operations limited to covered
targets. `complete-document` can satisfy stricter policies.

`intent-satisfied` is not treated as complete-document coverage.

## Freshness

Document revisions are copied into the plan when available, included in
preconditions and included in deterministic plan IDs. Missing revision evidence
is recorded as a limitation and diagnostic. Known mismatches produce
`stale-analysis` or `validation-failed`.

M11 does not requery the runtime.

## Diagnostics

M11 separates:

- M9 `analysisDiagnostics`;
- M10 `queryDiagnostics`;
- M11 `planningDiagnostics`.

M11 diagnostic codes are closed and include invalid input, duplicate IDs,
finding-not-found, unsupported finding type, insufficient coverage, stale
analysis, blocked policy, destructive action not allowed, ambiguous target,
unresolved external context, conflicting proposals, proposal dedupe, no safe
action, missing revision evidence, limits and validation failure.

## Limits

Limits are explicit:

- `maxSelectedFindings`;
- `maxProposals`;
- `maxConflicts`;
- `maxIdentifierLength`;
- `maxPreconditionsPerProposal`;
- `maxPostconditionsPerProposal`;
- `maxDiagnostics`.

Limit failures are explicit and do not silently truncate applicable plans.

## Real Fixture And Evidence

The existing real fixture in
`packages/drawio-mcp-server/src/real-environment/hierarchical-snapshot.test.ts`
now also runs M11. It creates two layers, starts from layer A, expands to layer
B from real external reference evidence, avoids document scope, analyzes a
broken target, a same-page cross-layer edge and a confirmed orphan, queries
broken references and plans a detach proposal from the query result.

The same test derives conservative and explicit-delete plans from the already
materialized M9 result without additional snapshots or analysis.

Focused evidence:

```sh
pnpm --filter cyberdraw-graph-model build
pnpm --filter cyberdraw-graph-model test -- --runInBand structural-change-plan
pnpm --filter drawio-mcp-server build
NODE_OPTIONS=--experimental-vm-modules ./node_modules/.bin/jest packages/drawio-mcp-server/build/cyberdraw-hierarchical-snapshot.test.js --runInBand
NODE_OPTIONS=--experimental-vm-modules ./node_modules/.bin/jest packages/drawio-mcp-server/build/real-environment/hierarchical-snapshot.test.js --runInBand
```

## Security

The planner includes no labels, XML, graph dump, paths, hostnames, environment
data, eval, dynamic functions, commands, callbacks, filesystem writes,
persistence or mutation hooks. IDs and arrays are bounded. Prototype-pollution
shaped inputs and unsafe numbers are rejected by tests.

## Complexity

Selection is O(F), proposal generation is O(S), conflict indexing is O(P) plus
canonical ordering O(P log P). There is no deep recursion or global state.

## Compatibility

M11 extends private package and server types only. Existing MCP tools, public
schemas, plugin behavior and WebSocket public surface are unchanged. RFC 0001
remains Draft. ADR 0004 is unchanged.

## Rollback

Rollback removes:

1. `structural-change-plan.ts` and tests;
2. graph-model exports and optional execution-result field;
3. optional server executor planning call;
4. M11 test additions and documentation references.

No migration is needed because there is no persistence or public API.

## Exit Criteria

M11 is COMPLETE because the pure planner exists, IDs are deterministic,
policies are closed and conservative by default, ambiguous and external
references are not auto-resolved, cross-layer is not an error by default,
orphan delete requires explicit policy, preconditions/postconditions are
declarative, conflicts are detected without auto-resolution, coverage and
freshness are preserved, M9/M10 are reused, the real fixture proves no document
scope and UI preservation, mutation invocations remain zero and no public MCP
surface is added.
