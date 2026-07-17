# M8: Hierarchical Snapshot Planner

## Status

PARTIAL internal milestone evidence.

M8 remains private and does not add a public MCP tool, public schema,
persistence, chunking, streaming, semantic diff, mutation planning or
cybersecurity-specific rules.

The planner, executor, partial/stale separation, bounded expansion logic and
unit coverage are implemented. M8 is PARTIAL because real draw.io evidence does
not yet demonstrate a multi-step expansion with a resolvable external reference:
the current runtime metadata records omitted element references, but there is no
cheap element inventory that can safely map those references to a narrower page
or layer scope.

## Objective

M8 implements ADR 0004's hierarchical scoped snapshot strategy as reusable
internal code. The planner starts from compact inventory, estimates cost, picks
the narrowest sufficient private runtime scope and returns an explainable,
deterministic plan. The executor runs that plan server-side, adapts scoped
snapshots into the internal graph model and stops safely on stale, invalid or
over-limit results.

## Architecture

M8 is split into two layers:

- Pure planner in `packages/cyberdraw-graph-model`, with JSON-compatible types,
  deterministic rules and no browser, WebSocket, MCP SDK or filesystem access.
- Internal executor in `packages/drawio-mcp-server`, responsible for requesting
  snapshots, checking compatibility/freshness, merging scoped results, adapting
  to the graph model and returning bounded internal metrics.

The plugin remains limited to existing runtime snapshot extraction.

## Planner

The public-to-package internal entrypoint is `planHierarchicalSnapshot(input)`.
It consumes `DiagramInventory`, `HierarchicalSnapshotIntent`,
`SnapshotPlanLimits` and supported scope kinds, then produces a `SnapshotPlan`
with deterministic step IDs, estimates, limit risks, coverage and structured
diagnostics.

The planner has no closures or runtime objects. Plans are reproducible JSON data.

## Executor

The internal server entrypoint is `executeHierarchicalSnapshotPlan(context,
intent, options)`. It requests inventory, plans, executes scoped snapshot steps,
checks document compatibility, merges partial results with
`mergeScopedSnapshotResults()`, adapts through `fromRuntimeSnapshot()` and
returns `SnapshotPlanExecutionResult`.

The executor is not registered as an MCP tool.

## Inventory

`DiagramInventory` is compact and intentionally lossy. It can include document
ID, content revision, active page, page/layer IDs, already-available page/layer
names, order, layer visibility/locked state, approximate counts, approximate
payload estimates, selection count, external-reference count, diagnostics and
limit proximity.

M8 does not add a plugin inventory endpoint. When no narrower prior inventory is
available, the executor may derive inventory from an existing runtime snapshot
and marks partial/estimated data accordingly. This is the main limitation that
M9 should consider before broader analysis workflows.

## Intents

Initial private intents:

- `inspect-document`;
- `inspect-visible-page`;
- `inspect-pages`;
- `inspect-layers`;
- `inspect-selection`;
- `analyze-structure`.

These are internal planner intents, not MCP tools.

## Scope Policy

Scope selection is deterministic:

1. Use `selection` when the intent depends on selection and it is non-empty.
2. Use `layers` for explicit known layer targets.
3. Use `pages` for explicit known page targets.
4. Use visible page for local analysis without a target.
5. Use `document` only when the estimate is bounded or complete document
   coverage is explicitly required.

Document scope is not used as a convenience fallback for large or unknown
diagrams when a narrower target is known.

## Estimation

Estimates distinguish `exact`, `observed`, `estimated` and `unknown` bases. M8
uses observed counts/bytes when inventory provides them, otherwise a conservative
element-count estimate with a default safety margin of `1.35`. M6/M7 evidence
motivates the margin and scope preference, but M8 does not encode timing SLAs.

## Limits

Planner and executor respect existing snapshot byte limits and add internal
planning limits:

- soft snapshot bytes;
- hard snapshot bytes;
- max pages;
- max layers per page;
- max elements per page;
- max metadata string length;
- execution timeout;
- max plan steps;
- max expansion depth.

M8 does not change the runtime snapshot default limits.

## Stopping Conditions

Supported stop reasons:

- `complete`;
- `intent-satisfied`;
- `soft-limit-advisory`;
- `hard-limit-reached`;
- `missing-target`;
- `stale-snapshot`;
- `incomplete-inventory`;
- `unsupported-scope`;
- `execution-error`;
- `max-steps-reached`;
- `timeout`;
- `validation-failed`.

## Explainability

Plans and diagnostics use structured codes, including:

- `selection-preferred`;
- `explicit-layer-target`;
- `explicit-page-target`;
- `visible-page-default`;
- `document-bounded`;
- `document-too-large`;
- `layer-reduces-payload`;
- `background-page-required`;
- `external-context-required`;
- `hard-limit-avoidance`;
- `incomplete-inventory`;
- `missing-target`.

Human-readable messages are derived from codes. Diagnostics do not include full
labels, XML, raw snapshots or full metadata.

## Expansion

M8 records when scoped snapshots require context expansion through existing scope
metadata such as `requiresScopeExpansion` and external references. Expansion is
bounded by max steps and max depth. It may widen to existing scope families, but
does not implement arbitrary chunking or element-level fragmentation.

## Merge

`mergeScopedSnapshotResults(results)` is pure and deterministic. It:

- rejects incompatible documents;
- rejects incompatible content revisions;
- can reject stale partial snapshots;
- deduplicates pages, layers and elements by provisional draw.io ID plus scope
  context;
- preserves `contextOnly` raw flags;
- preserves external references;
- applies canonical ordering;
- does not claim stable identity across snapshots.

## Freshness

The executor uses strict M4/M5 freshness comparison when requested/resolved
scopes match. For cross-scope inventory-to-step checks, it validates document
identity and completeness without comparing scoped content revisions as if they
were equivalent. M8 does not implement rebase or automatic replanning.

## Analyze-Structure

The first vertical demonstration is `analyze-structure`. It plans scoped
snapshots, merges them and builds the internal graph model. This is sufficient
for graph-model counts, existing broken-reference detection, scoped external
reference preservation and future bounded structural analysis. It does not add
a full rule engine.

## Observability

Internal result metrics include inventory duration, planning duration, execution
duration, planned/executed steps, scopes used, estimated/measured bytes,
included/context/external-reference counts, replan count, stop reason and
diagnostic count. These metrics are returned internally and are not published as
MCP responses.

## Security And Privacy

M8 keeps the M4/M5 envelope:

- no public MCP tool;
- no persistence or sidecars;
- no raw XML or full snapshot logs;
- no labels in planner diagnostics;
- no environment, hostname, username or path dumps;
- no dependency on untrusted prototypes for merge decisions;
- bounded steps and depth to avoid reference loops.

## Tests

Added coverage:

- planner selection/layers/pages/visible-page/document decisions;
- hard-limit avoidance and soft-limit advisory;
- incomplete inventory and missing targets;
- deterministic plans and step IDs;
- deduplication of equivalent scopes;
- maximum steps and unsupported scopes;
- structured diagnostics without sensitive labels;
- merge of pages/layers/selection;
- contextOnly and external-reference preservation;
- duplicate elements;
- incompatible revisions/documents;
- partial versus stale separation;
- executor graph-model adaptation;
- executor stale stop;
- public MCP exposure check;
- real-environment visible-page, background-page, explicit-page, explicit-layer,
  selection, empty-selection, hard-limit avoidance and stale-plan behavior with
  UI preservation.

## Real-Environment Evidence

The M8 focused real-environment tests execute the internal planner/executor over
draw.io using HTTP/WebSocket and cover visible page, background page, explicit
page target, explicit layer, selection, empty selection, hard-limit avoidance
from real snapshot inventory, stale plan handling and UI preservation. They
verify graph construction, positive measured payloads, active-page preservation,
browser error checks and server error checks.

The remaining real-environment gap is multi-step expansion. Unit tests cover
selection/layer expansion, resolvable and unresolvable references, duplicate
scopes, cycles, maximum depth, maximum steps and hard-limit avoidance, but real
draw.io snapshots do not yet expose enough compact inventory to resolve omitted
element references into page/layer scopes safely.

This does not replace M7 benchmarks and does not make the full benchmark matrix
mandatory in CI.

## Limitations

- No dedicated cheap plugin inventory endpoint exists yet.
- Exact all-page/layer counts may require snapshot traversal.
- Cross-scope revisions are not semantic-equivalent revisions.
- Background page execution relies on existing snapshot extraction behavior.
- Expansion is conservative, does not add chunking and can only add page/layer
  scopes when external references are resolvable from compact inventory.
- Real multi-step expansion remains pending until M9 or a follow-up inventory
  milestone adds safe element-to-scope inventory.
- Stable identity remains unresolved.

## Rollback

Rollback removes:

1. `hierarchical-snapshot-planner.ts` and related tests/exports.
2. `scoped-snapshot-merge.ts` and tests/exports.
3. `cyberdraw-hierarchical-snapshot.ts` and server tests.
4. The server workspace dependency on `cyberdraw-graph-model`.
5. This document and M8 doc references.

No public API migration is required.

## Risks

- Inventory derived from snapshots can still be too expensive for very large
  diagrams until a narrower inventory extractor exists.
- Conservative byte estimates may recommend narrow scopes more often than
  strictly necessary.
- A single page or layer can still exceed hard limits.
- Real-environment evidence is intentionally small and functional, not a
  benchmark.

## Exit Criteria

M8 remains PARTIAL until planner, executor, inventory, estimation, stopping,
deterministic merge, graph-model integration, stale handling, private-only
surface, documentation and validation pass and real draw.io evidence includes a
multi-step expansion with resolvable context. The current implementation meets
the code-level criteria but not that final real-environment evidence criterion.

## Recommendation For M9

M9 should be the first internal structural analysis vertical over M8 output:

- broken reference detection with scoped evidence;
- orphan detection;
- cross-layer edge analysis;
- bounded connected-component summary.

M9 should first evaluate a cheap dedicated inventory extractor before expanding
analysis breadth. That inventory should be able to map omitted element
references to page/layer membership without full document traversal so that
hierarchical expansion can be proven in real draw.io diagrams.
