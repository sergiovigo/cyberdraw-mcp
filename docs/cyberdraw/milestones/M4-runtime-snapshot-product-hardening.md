# M4: Runtime Snapshot Product Hardening

## Status

Internal milestone evidence. Not a public API and not a public MCP tool.

## Objective

Harden the M3 runtime snapshot path so future CyberDraw product capabilities can
use it with explicit compatibility, bounded payload behavior, versioned
contracts, stale-read discipline and safe internal observability.

## Scope

M4 keeps runtime snapshots private. It does not add an MCP tool, persist
snapshots, introduce sidecars or databases, implement change plans, generate
draw.io XML or stabilize the graph model API.

## Decisions

- Runtime snapshot protocol constants, limits, capability shape, validators,
  canonical stringify and content revision helpers live in the private
  `cyberdraw-runtime-contract` workspace package.
- Capability negotiation uses optional `runtime` metadata on the existing
  `document-state` control message. This is backward compatible because older
  peers omit the field.
- Server snapshot requests perform a capability preflight before sending the
  internal event. Incompatible peers fail immediately.
- Payload control uses soft and hard byte limits plus count/string limits. The
  extractor estimates payload growth incrementally and refuses to add data that
  would exceed the hard limit.
- `contentRevision` is deterministic and versioned:
  `cyberdraw-content-v1:fnv1a64:<digest>`.
- Stale reads are modeled as snapshot capture, analysis, revalidation and future
  application. M4 implements comparison only; future mutation code must
  recapture or compare before applying changes.

## Capability Negotiation

The plugin advertises:

```text
cyberdraw.runtimeSnapshot.v1
contractVersion: 1
snapshotVersion: 1
features: contentRevision, backgroundPages, truncationDiagnostics
limits: RuntimeSnapshotLimits
```

The server records the metadata per WebSocket connection. Absence, malformed
metadata or unsupported versions mean snapshot is not supported for that peer.
Existing tools continue to route through the legacy WebSocket event path.

## Payload Strategy

M4 keeps the transport simple: no chunking and no product streaming. The
extractor uses:

- count limits for pages, layers, elements, strings, metadata and raw data;
- `softSnapshotBytes`, default 12 MiB;
- `hardSnapshotBytes`, default 16 MiB;
- incremental stable-JSON byte estimates before adding layers/elements;
- final measured JSON bytes after serialization;
- explicit diagnostics and `completeness.status: "partial"` for soft/count
  truncation.

If final serialization exceeds `hardSnapshotBytes`, the plugin rejects the
snapshot response with a bounded error instead of sending the oversized payload.

A partial snapshot cannot look complete: `truncated`, `completeness`,
`revisionSignals.complete`, diagnostics, limits and payload metadata all carry
the state.

## Stale-Read Policy

Snapshots include `contentRevision`, `capturedAt`, document identity, pages,
scope, limits, completeness and payload metadata. The server helper
`compareRuntimeSnapshotFreshness()` returns:

- `fresh`;
- `stale` for content, document, scope or partial-snapshot mismatch;
- `unknown` for disconnected document, incompatible peer, timeout or failed
  recapture.

M4 does not apply mutations. Future mutation paths must recapture or compare a
current snapshot before applying changes.

## Hash And Revision

Options considered:

- FNV-1a 32-bit from M3: synchronous and small, but too collision-prone.
- SHA-256 in browser: strong, but Web Crypto is asynchronous and would make the
  current synchronous extractor contract invasive.
- Server-side SHA-256: avoids browser async work but hashes after transport and
  does not help plugin-side truncation/revision diagnostics.
- Double hash: more complexity without clear need for an internal snapshot.
- FNV-1a 64-bit over canonical JSON: synchronous, deterministic, tiny, browser
  compatible and significantly better than M3 for accidental collisions.

M4 chooses FNV-1a 64-bit over stable canonical JSON. This is not a security
signature. The revision base includes contract version, schema version, scope,
limits, completeness/truncation diagnostics and content fields. It excludes
timestamps, performance, selection and visible-page UI state.

## Compatibility

Runtime compatibility is capability-detected, not version-branched. The
extractor guards optional APIs for graph/model traversal, geometry, layer lock
state, tags and custom attributes. Missing optional APIs degrade with
`compatibility_api_missing` diagnostics.

Real runtime coverage still uses the configured draw.io asset. M3 observed
30.3.12. M4 adds version-labeled compatibility fixtures and contract tests, but
does not claim full runtime compatibility for a second draw.io version unless a
second asset is available.

## Internal Contract

`cyberdraw-runtime-contract` centralizes:

- capability names and versions;
- message names;
- snapshot request/response types;
- diagnostics;
- limits;
- scope;
- payload metadata;
- validation helpers;
- revision helpers.

The contract remains private and experimental. No JSON Schema is published.
Because the package exports compiled `build/` entrypoints, clean-checkout
consumers must be built with their workspace dependency closure, for example
`pnpm --filter drawio-mcp-plugin... run build` or
`pnpm --filter drawio-mcp-server... run build`.

## Security

Controls retained or added:

- no stdout logging from production server code;
- no labels, metadata, XML or full snapshots in logs;
- dangerous object keys removed;
- runtime objects and functions excluded from payloads;
- hard byte policy before response emission, including final serialization
  rejection;
- malformed snapshot responses rejected server-side.

## Observability

M4 logs only aggregate internal facts:

- capability supported/unsupported;
- snapshot start/end;
- revision;
- page count;
- element count;
- bytes;
- truncation;
- timeout and incompatible peer failures through existing logger paths.

## Rollback

Rollback remains straightforward:

1. Remove `cyberdraw-runtime-contract`.
2. Remove `runtime` metadata from plugin `document-state`.
3. Remove the snapshot preflight from `cyberdraw-runtime-snapshot.ts`.
4. Remove M4 stale-read helpers and tests.
5. Restore M3 snapshot limits/revision behavior or remove the private snapshot
   path entirely.

Inherited tools and existing public MCP responses do not require migration.

## Tests

Added or updated coverage includes:

- modern peer capability;
- old peer without capability;
- unsupported and malformed capability;
- timeout after advertised support;
- late response cleanup by request id;
- deterministic revision and canonical JSON;
- known hash vector;
- partial snapshot stale classification;
- manual runtime edit changes content revision;
- UI-only state preservation;
- stdout purity through existing server suite;
- no public tool named `cyberdraw.runtimeSnapshot.v1`.

## Performance

M4 does not define an SLA. Payload accounting is deliberately lightweight and
uses stable JSON length as an approximation. The plugin bundle increased from
about 148.6 KiB to 156.7 KiB in the local build because the internal contract is
bundled into the plugin.

## Risks Residuals

- FNV-1a 64-bit is not cryptographic.
- Incremental byte estimates can differ from final JSON size.
- No chunking exists; hard-limit failures still require the client to request a
  narrower internal scope in future work.
- A second real draw.io runtime version was not executed in this environment.
- Plugin-local unit tests remain absent; behavior is covered indirectly through
  server real-environment tests.

## Exit Criteria

M4 meets the internal hardening criteria when build, lint, tests, dependency
audit and `git diff --check` pass and no public MCP tool is added.
