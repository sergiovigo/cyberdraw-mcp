# M7: Real-Environment Snapshot Benchmarks

## Status

Complete for the M7 HTTP/WebSocket benchmark scope.

HTTPS/Caddy remains a residual validation gap and was not used as benchmark
evidence.

M7 remains internal. It does not add public MCP tools, public schemas,
chunking, streaming, persistence, incremental analysis, sidecars or public
response changes.

## Objective

M7 completes the missing M6 evidence by measuring the private runtime snapshot
path inside a real draw.io browser runtime for the internal scopes:

- `document`;
- `pages`;
- `layers`;
- `selection`.

The benchmark separates browser extraction, browser serialization, WebSocket
round trip, server validation, graph-model adapter, normalization and freshness
comparison.

## Environment

Versioned artifacts were generated on:

| Field | Value |
| --- | --- |
| Node | v24.18.0 |
| pnpm | 10.8.1 |
| OS | Linux x64 |
| Commit | `bbd4b81eeb14` |
| draw.io runtime | `30.3.12` |
| Transport | local HTTP plus WebSocket |
| HTTPS/Caddy | failed preflight in this environment |

The existing real-environment HTTP suite passed before implementation:
14 suites, 36 tests. The HTTPS/Caddy variant failed during proxy startup with
`caddy did not start listening` and `ERR_SSL_PROTOCOL_ERROR`; M7 records this
as a residual validation gap and does not use HTTPS for benchmark evidence.

## Harness

The manual harness lives in `packages/cyberdraw-runtime-benchmarks` and reuses
the existing `drawio-mcp-server` real-environment harness:

```sh
pnpm run benchmark:cyberdraw:real
pnpm run benchmark:cyberdraw:real:smoke
pnpm --filter cyberdraw-runtime-benchmarks run benchmark:real -- --fixture small --scenario document --iterations 1 --warmup 0
```

It starts the real server, dynamic HTTP and WebSocket ports, Chromium, draw.io,
the browser plugin and an in-memory MCP client. It disposes browser, MCP client,
app, HTTP server, WebSocket server and proxy handle on exit.

The harness is manual and is not part of `pnpm run test` or required CI.

## Fixtures

Fixtures are generated synthetically inside draw.io from deterministic XML:

| Fixture | Pages | Layers | Elements | Notes |
| --- | ---: | ---: | ---: | --- |
| small | 2 | 8 | 172 | complete scenario matrix |
| medium | 3 | 15 | 1,050 | representative document/pages/layers/selection/freshness |
| soft-limit | 2 | 10 | 1,198 | large labels, near hard-limit pressure |
| hard-limit | 2 | 10 | 1,548 | larger labels, hard-limit pressure |

Seed: `424242`.

The fixtures contain synthetic IDs, labels and metadata only. No customer XML,
screenshots, binary profiles, hostnames, usernames, secrets or environment
dumps are versioned.

## Methodology

Small and medium runs used warmup `1` and iterations `3`. Limit runs used
warmup `0` and iterations `1` to avoid long manual benchmark time while still
validating behavior near limits.

Measured in browser:

- scope resolution;
- traversal;
- snapshot assembly;
- content/selection revision work;
- stable serialization;
- total plugin time;
- UTF-8 JSON bytes;
- timer and RAF drift approximation.

Measured server-side:

- WebSocket request/reply round trip;
- server parse;
- contract validation;
- runtime adapter;
- graph-model normalization;
- freshness recapture/comparison;
- Node heap delta around iteration.

Not measured as exact values:

- browser peak heap;
- exact main-thread blocking;
- network throughput beyond local WebSocket round trip;
- Chrome DevTools trace timings.

## Main-Thread Approximation

The real benchmark explicitly enables an internal `measureMainThreadImpact`
snapshot option. Normal snapshots leave this option unset and do not create
timers, wait for `requestAnimationFrame`, create `PerformanceObserver`, or add
probe latency.

When enabled, the plugin schedules a zero-delay timer and
`requestAnimationFrame` before snapshot extraction, then samples their delay
after extraction completes. If available, the Long Task API is observed during
the same window. The probe has explicit deterministic cleanup for timers,
animation frame callbacks and observers on success and error paths.

This is a low-overhead approximation. It detects event-loop/paint scheduling
delay around the synchronous extraction path, but it is noisy, depends on
browser scheduling, and is not a Chrome trace or a public SLA.

## Results

Compact artifacts:

- `docs/cyberdraw/benchmarks/m7-real-small-summary.json`;
- `docs/cyberdraw/benchmarks/m7-real-medium-summary.json`;
- `docs/cyberdraw/benchmarks/m7-real-soft-limit-summary.json`;
- `docs/cyberdraw/benchmarks/m7-real-hard-limit-summary.json`;
- `docs/cyberdraw/benchmarks/m7-real-summary.md`.

Representative medians:

| Fixture | Scenario | Bytes | Plugin ms | Round trip ms | Adapter ms | Normalize ms | Total ms | Outcome |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| small | document | 91,764 | 106.20 | 116.79 | 4.18 | 7.93 | 252.03 | within-limit |
| small | pages-visible | 46,807 | 13.10 | 19.07 | 1.38 | 2.48 | 51.88 | within-limit |
| small | pages-background | 46,807 | 81.00 | 88.18 | 1.77 | 3.26 | 194.80 | within-limit |
| small | layers-small | 22,411 | 4.40 | 8.49 | 0.43 | 0.75 | 26.24 | within-limit |
| small | selection-multiple | 5,405 | 5.00 | 17.88 | 0.13 | 0.18 | 58.06 | within-limit |
| medium | document | 612,655 | 797.40 | 857.28 | 22.46 | 46.71 | 1,805.70 | within-limit |
| medium | pages-visible | 205,400 | 52.40 | 74.08 | 7.32 | 13.97 | 185.83 | within-limit |
| medium | pages-background | 205,400 | 350.00 | 379.93 | 5.00 | 11.42 | 804.35 | within-limit |
| medium | layers-small | 72,607 | 15.80 | 23.91 | 1.27 | 2.53 | 60.41 | within-limit |
| soft-limit | document | 16,770,151 | 2,977.00 | 3,781.64 | 30.40 | 53.62 | 7,885.04 | hard-limit-error |
| soft-limit | pages-visible | 10,236,553 | 1,186.60 | 1,655.63 | 13.88 | 27.41 | 3,353.74 | within-limit |
| hard-limit | pages-visible | 14,539,296 | 1,501.10 | 2,217.69 | 20.10 | 43.33 | 4,325.95 | soft-limit |
| hard-limit | layers-small | 2,973,456 | 285.90 | 413.07 | 3.60 | 6.14 | 864.77 | within-limit |

## Scope Findings

Document scope works for small and medium real fixtures, but real browser
extraction cost grows sharply. Medium document extraction was about 797 ms in
plugin time and about 1.8 s total scenario time.

Pages scope substantially reduces payload and server work. Visible pages are
much faster than background pages in the real runtime because background page
capture must prepare and clean up non-active graph state.

Layers scope is the most useful bounded semantic scope for larger pages. It
keeps payload low and records context-only ancestors and omitted external
references without treating scoped omissions as definitive broken references.

Selection scope remains tiny and UI-bound. It supports empty, single, multiple,
group, edge and external-terminal selections while preserving the selection
after extraction.

## Freshness

Observed outcomes:

- recapture without changes: fresh;
- mutation inside scoped page: content-changed;
- mutation outside scoped page: fresh;
- selection change for selection scope: content-changed for that selection
  snapshot because selection is part of the selection-scope revision base.

Freshness comparison itself is small relative to extraction and recapture cost.

## UI Preservation

For every versioned result:

- active page was preserved;
- selection was preserved for the measured extraction;
- zoom was preserved;
- scroll was observed and preserved when available;
- no dialogs remained open;
- editing state was not left active.

Controlled freshness mutations restore UI after measurement.

## Synthetic Versus Real

M6 synthetic results showed stronger and more uniform scope reductions:
medium document was about 1.15 MiB and visible page about 232 KiB. M7 real
medium is smaller in bytes for this generated fixture, but browser extraction
is materially different: visible page is fast, background page is much slower,
and local WebSocket/JSON costs are visible.

Differences are expected because M7 includes draw.io runtime objects, page
activation helpers, browser scheduling, garbage collection, WebSocket transport,
server parse/validation and real adapter/normalization over browser-produced
payloads.

## Limits

Current limits were not changed.

Observed behavior:

- document scope near 16 MiB can fail with hard-limit diagnostics;
- one large page can enter soft-limit territory;
- layers remain below hard limit in the limit fixtures;
- selection remains tiny even in label-heavy fixtures.

Recommendation: keep the current soft and hard byte limits. Do not raise them
without additional browser-memory evidence and UI responsiveness evidence.

## Security And Privacy

The benchmark logs aggregate metrics only. It does not version complete
snapshots, labels as standalone logs, XML fixtures, screenshots, traces, heap
dumps, local paths, hostnames, usernames, secrets or environment variables.

Errors are bounded through the existing internal snapshot error formatting and
the benchmark output stores scenario-level metrics only.

## Observability

M7 adds internal optional performance fields to snapshot payloads:

- `scopeResolutionMs`;
- `traversalMs`;
- `snapshotAssemblyMs`;
- `revisionMs`;
- `totalPluginMs`;
- `mainThreadTimerDriftMs`;
- `mainThreadRafDelayMs`;
- `longTaskCount`.

Existing required fields remain unchanged.

## ADR Impact

M7 confirms ADR 0004's proposed scope-first strategy. The evidence does not
justify productive chunking, streaming, persistence or incremental analysis for
M8. It does justify hierarchical internal analysis: request inventory first,
then pages/layers/selection rather than document for large diagrams.

ADR 0004 can be accepted because its acceptance criteria are met: M6 artifacts
are reviewed, M6 documentation is merged, M7 scope uses hierarchical scoped
analysis rather than chunking, and no public MCP tool or public schema is
introduced.

## Recommendation For M8

M8 should implement internal hierarchical planning over existing scopes:

1. Start with page/layer inventory or a bounded page scope.
2. Prefer visible page or explicit layers for analysis.
3. Use document scope only for bounded diagrams.
4. Return clear hard-limit guidance recommending narrower scopes.
5. Defer chunking until a single required page or layer commonly exceeds hard
   limit.
6. Defer incremental analysis until stable identity is designed.

M8 follow-up: `M8-hierarchical-snapshot-planner.md` implements the private
planner/executor split over existing scopes and keeps the M7 recommendation to
avoid chunking, streaming, persistence and incremental analysis. M9 should use
M8 as the bounded context provider for the first structural analysis vertical.

## Rollback

Rollback removes:

1. M7 benchmark CLI and fixture/runner files from
   `cyberdraw-runtime-benchmarks`;
2. optional plugin/server timing fields;
3. `benchmark:cyberdraw:real*` scripts;
4. M7 benchmark artifacts and this milestone document.

No public MCP behavior or persisted data migration is required.

## Exit Criteria

M7 meets the practical exit criteria for HTTP/WebSocket real runtime evidence:
real draw.io was used, four scopes were measured, visible/background pages work,
selection preserves UI, medians and p95 are documented, payload UTF-8 bytes are
measured, plugin/round-trip/server/adapter are separated, main-thread impact is
approximated, M6 comparison is documented, hard-limit behavior is observed, no
public MCP tool is added, and ADR 0004 is updated.

Residual risk: HTTPS/Caddy real-environment stability remains pending in this
local environment.
