# M6: Runtime Snapshot Benchmarks And Scaling Strategy

## Status

Complete for synthetic benchmark evidence. Real-environment benchmark expansion
remains pending and is explicitly separated from the synthetic harness.

## Objective

M6 builds reproducible evidence for the private runtime snapshots introduced in
M3, hardened in M4 and scoped in M5. It measures document, pages, layers and
selection scopes; separates extraction, serialization, contract validation,
graph-model adaptation, normalization and freshness comparison; and recommends a
scaling strategy for M7.

M6 does not add public MCP tools, public schemas, chunking, streaming,
persistence, compression, semantic diff, mutation planning, sidecars or external
telemetry.

## Harness

The benchmark harness lives in the private package
`packages/cyberdraw-runtime-benchmarks`.

Commands:

```sh
pnpm run benchmark:cyberdraw
pnpm run benchmark:cyberdraw:smoke
pnpm --filter cyberdraw-runtime-benchmarks run benchmark -- --fixture small --scenario document --json
```

The harness is manual. It is not part of the normal `pnpm run test` path beyond
its short structural unit tests. It uses Node built-ins (`node:perf_hooks`,
`process.memoryUsage`, `Buffer.byteLength`) and workspace packages only.

Versioned aggregate artifacts:

- `docs/cyberdraw/benchmarks/m6-small-summary.json`
- `docs/cyberdraw/benchmarks/m6-medium-summary.json`
- `docs/cyberdraw/benchmarks/m6-large-summary.json`
- `docs/cyberdraw/benchmarks/m6-hard-limit-summary.json`

The artifacts contain aggregate metrics only. They do not contain labels beyond
synthetic fixture names, full snapshots, XML, customer data, heap dumps, traces
or environment variables.

## Environment

The versioned M6 synthetic summaries were produced with:

| Field | Value |
| --- | --- |
| Node | v24.18.0 |
| pnpm | 10.8.1 |
| OS | Linux |
| Architecture | x64 |
| Commit | `b5700560cdb1` |
| Runtime draw.io | `synthetic-drawio-runtime-m6` |
| Seed | `424242` |

The real draw.io runtime evidence remains the M3-M5 real-environment test path,
with M3 observing draw.io `30.3.12` in the local asset cache. M6 did not add a
new browser benchmark run, so real-environment benchmark results are marked
pending rather than invented.

## Methodology

Synthetic fixtures are generated deterministically from a seed and then measured
over warmup plus repeated iterations. The harness records median, p95, minimum,
maximum, mean and standard deviation for each measured metric.

Configured M6 runs:

| Fixture | Iterations | Warmup | Scope coverage |
| --- | ---: | ---: | --- |
| small | 5 | 2 | Full scenario matrix |
| medium | 5 | 2 | Full scenario matrix |
| large | 5 | 2 | Representative document/pages/layers/selection/freshness/graph scenarios |
| hard-limit | 3 | 1 | Document plus narrow scopes |

Outliers are not discarded. The p95 and spread are retained so repeated local
runs can compare variability without hiding slow iterations.

Measured exact values:

- elapsed time by stage using `performance.now()`;
- UTF-8 JSON byte length using `Buffer.byteLength`;
- page/layer/element/context/external-reference counts;
- diagnostics count;
- contract validation outcome;
- graph-model finding count;
- hard-limit outcome.

Measured estimates:

- heap before/after and heap delta around each iteration.

Not measured as exact values:

- browser main-thread blocking for synthetic runs;
- real transport latency;
- peak heap;
- WebSocket throughput.

## Fixtures

| Fixture | Pages | Layers | Elements | Edges | Groups | Metadata |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| small | 2 | 8 | 360 | 48 | 10 | light |
| medium | 5 | 30 | 2,000 | 386 | 65 | moderate |
| large | 10 | 80 | 20,000 | 4,757 | 480 | moderate |
| hard-limit | 12 | 96 | 31,000 | 7,541 | 815 | wider labels/metadata |

All IDs, labels and metadata are synthetic. No real diagrams, customer names,
paths, XML or screenshots are used.

## Pipeline Separation

Synthetic M6 separates these costs:

1. Scope resolution and synthetic extraction.
2. Stable canonicalization.
3. Revision-related stable stringify.
4. JSON serialization and UTF-8 bytes.
5. Server-style contract validation.
6. Runtime snapshot adapter.
7. Graph-model normalization.
8. Freshness comparison.

The harness reports bytes as an estimated transport pressure signal only. It
does not treat serialization time as network or WebSocket transport time.

## Results

Median values from the versioned synthetic summaries:

| Fixture | Document bytes | Document total ms | Page bytes | Page reduction | Page total ms | Layer bytes | Layer reduction | Layer total ms | Selection bytes | Selection reduction | Selection total ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| small | 176,098 | 79.0 | 88,927 | 49.5% | 46.3 | 26,645 | 84.9% | 10.6 | 3,930 | 97.8% | 1.4 |
| medium | 1,152,783 | 545.4 | 231,902 | 79.9% | 123.1 | 42,066 | 96.4% | 20.6 | 4,599 | 99.6% | 1.6 |
| large | 12,383,405 | 8,180.5 | 1,239,838 | 90.0% | 789.9 | 252,152 | 98.0% | 146.8 | 4,927 | ~100.0% | 3.7 |
| hard-limit | 26,187,173 | 11,239.3 | 2,182,630 | 91.7% | 1,271.1 | 427,047 | 98.4% | 222.5 | 5,799 | ~100.0% | 5.3 |

Hard-limit evidence:

- the hard-limit document attempt is about 26.2 MiB and is rejected as
  `hard-limit-error` against the current 16 MiB hard limit;
- one visible page is about 2.18 MiB;
- one layer is about 427 KiB;
- selection is about 5.8 KiB.

This supports scope-first behavior: the same synthetic document that is unsafe
as a full snapshot is practical through narrower scopes.

## Scope Analysis

Document scope remains useful through large fixtures when the payload is under
the hard limit, but 20,000 elements already show degraded synthetic total time.
Document scope should remain supported for bounded diagrams, diagnostics and
baseline comparison, not as the only scaling path.

Pages scope gives strong reductions when diagrams have multiple pages. The
large single-page visible subset reduced payload by 90.0% and median total time
by about 90.3% versus document.

Layers scope gives the strongest semantic subset for large pages. It introduces
external references and context-only ancestors by design. In the large fixture,
one layer included 292 elements and 492 external references, reducing payload by
98.0%.

Selection scope is extremely small and fast, but it is UI-bound and not a
semantic discovery strategy. It is appropriate for user-focused analysis over
the currently selected cells.

Freshness comparison is cheap relative to extraction/adaptation. The important
behavior is semantic: changes inside scope alter scoped revision, while changes
outside a page/layer scope should not force stale reads unless materialized
context changes.

Graph-model adaptation and normalization scale with included elements. The
document path is the pressure point; scoped paths keep graph-model costs bounded.

## Thresholds

These are internal guidance categories, not public SLAs:

| Category | Guidance |
| --- | --- |
| normal | complete snapshot below about 2 MiB and low hundreds of ms in synthetic runs |
| degraded | complete snapshot in the 2-12 MiB range or multi-second document processing |
| scope recommended | document scope is valid but pages/layers can reduce payload by more than 75% |
| hard-limit risk | estimated document payload approaches the 12 MiB soft limit |
| unsupported without narrower scope | document payload would exceed the 16 MiB hard limit |

Do not raise limits by intuition. Any future limit change needs fresh evidence,
memory margin, UI blocking assessment and real-browser validation.

## Strategy Comparison

### A: Keep Full Snapshots With Scopes

Benefits: current design, simple private protocol, no reassembly, no partial
failure protocol, no new storage, no public API. M6 data shows pages/layers and
selection materially reduce payload and time.

Limit: full document snapshots can still fail at hard limit and large document
processing can be slow.

### B: Internal Chunking

Benefits: can move payloads larger than one message.

Costs: ordering, reassembly, timeout, cancellation, integrity, backpressure,
cleanup, compatibility and partial failure semantics. Chunking does not reduce
browser traversal or graph-model normalization work by itself.

### C: Internal Streaming

Streaming differs from chunking only if the architecture can consume partial
results progressively and apply backpressure. The current request/reply
WebSocket model and server-side adapter do not yet justify that complexity.

### D: Incremental Analysis

Potentially best long-term efficiency, but requires stable identity, change
observation, invalidation, semantic diff policy and likely state. M6 does not
provide enough identity evidence to accept this for M7.

### E: Paged Or Hierarchical Requests

Fits M5 scopes: discover pages/layers first, then request narrower page/layer
snapshots on demand. This avoids hard-limit failures without protocol chunking
and preserves discardable snapshots.

### F: Hybrid

Use scopes and hierarchical requests as the primary strategy. Keep document
snapshots for bounded diagrams. Consider chunking only later for exceptional
cases where a single page or layer still exceeds hard limit and there is a
clear consumer that can handle partial failures.

## M7 Recommendation

M7 should continue with scoped full snapshots plus hierarchical analysis
planning. Do not implement productive chunking, streaming or incremental
analysis yet.

Recommended next step:

1. Keep document/pages/layers/selection scopes private.
2. Add internal analysis workflows that request page/layer scopes deliberately.
3. Return clear internal hard-limit errors that recommend narrower scopes.
4. Add real-environment benchmark coverage for visible page, background page,
   layer and selection timing before raising any limits.
5. Defer chunking until evidence shows a single required scope regularly
   exceeds hard limit.
6. Defer incremental analysis until stable identity is designed.

## ADR

M6 creates draft ADR
`docs/cyberdraw/adr/0004-runtime-snapshot-scaling-strategy.md` because the
scaling strategy affects plugin extraction, server validation, graph-model
normalization and future milestones.

## Security And Privacy

The harness logs aggregate counts, bytes, timings and environment versions. It
does not log full snapshots, labels from real diagrams, XML, customer data,
hostnames, usernames, secrets, environment variables, heap dumps or traces.

## Rollback

Rollback is simple:

1. Remove `packages/cyberdraw-runtime-benchmarks`.
2. Remove root benchmark scripts.
3. Remove `docs/cyberdraw/benchmarks/m6-*-summary.json`.
4. Revert M6 documentation updates.

No runtime API, public MCP tool or persisted data requires migration.

## Exit Criteria

M6 meets the benchmark and decision criteria for synthetic evidence. It is
partial only with respect to real-environment benchmark breadth: M3-M5 retain
real runtime correctness coverage, but M6 did not produce a new browser timing
matrix.
