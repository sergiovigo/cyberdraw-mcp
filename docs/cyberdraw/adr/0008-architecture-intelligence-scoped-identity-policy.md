# ADR 0008: Architecture Intelligence Scoped Identity Policy

## Status

Accepted.

## Context

ADR 0003 accepted `packages/cyberdraw-graph-model` as a private, internal and
source-neutral graph model package. That ADR explicitly did not accept the
provisional identity strategy as stable between snapshots.

ADR 0004 accepted the scope-first runtime snapshot strategy and deferred
incremental analysis until a stable identity decision exists.

M17 gathered the missing identity evidence:

- M17.0 documented current identity assumptions, consumers, candidate policies
  and edge cases.
- M17.1 implemented a pure internal identity model and fixtures for
  `EXACT`, `PROBABLE`, `AMBIGUOUS` and `NO_MATCH`.
- M17.2 validated the narrow policy against REAL LOCAL HTTP runtime snapshots.

The evidence supports a scoped internal identity policy. It does not support
global stable identity, public graph identity, persistence keys, mutation target
identity or semantic equality.

## Decision

CyberDraw accepts an internal Architecture Intelligence scoped identity policy.

The accepted policy is:

- internal to `cyberdraw-graph-model`;
- scoped to the evidence domain described below;
- based first on compatible document context, entity type, raw draw.io anchor
  and required page context;
- supported by optional private signature evidence only for non-exact matching;
- explicit about uncertainty through `EXACT`, `PROBABLE`, `AMBIGUOUS` and
  `NO_MATCH`;
- not a public MCP contract, public graph schema, persistence key or mutation
  identifier.

The accepted ADR title intentionally uses "scoped identity", not "stable global
identity".

## Identity Domain

The policy applies to internal Architecture Intelligence evidence for:

- document context;
- pages;
- layers;
- elements/nodes;
- edges;
- scoped external-reference evidence.

The policy is proven for:

- one normalized snapshot;
- equivalent pure inputs;
- reordered candidate inputs;
- repeated snapshots in one REAL LOCAL HTTP draw.io runtime lifecycle;
- geometry changes where raw anchor and document/page context are preserved;
- layer moves where raw anchor and document/page context are preserved;
- label/content edits where raw anchor and document/page context are preserved;
- layer renames where layer raw anchor and page context are preserved;
- edge endpoint changes where edge raw anchor and page context are preserved;
- repeated scoped external-reference metadata.

The policy is not guaranteed for:

- true node copy/paste;
- arbitrary clone behavior;
- runtime reload or reopen;
- true page moves;
- import/reimport cycles with rewritten IDs;
- cross-document continuity;
- global identity.

## Matching Semantics

### EXACT

`EXACT` means continuity of a qualified anchor inside the accepted identity
domain.

Minimum evidence:

- same entity type;
- both sides provide the same document context;
- raw anchors match;
- required page context is compatible for layer, element, edge and
  external-reference entities;
- exactly one compatible candidate exists;
- neither side declares explicit conflict evidence.

`EXACT` does not mean:

- semantic equality;
- content equality;
- persistent identity;
- global identity;
- safe mutation target identity;
- unchanged graph structure.

Normative example: M17.2 observed that an edge with the same raw anchor and
changed endpoints remains `EXACT` identity continuity for the edge, while the
semantic structure changed.

### PROBABLE

`PROBABLE` means a unique private signature or qualified supporting evidence
suggests continuity, but the evidence is not strong enough for exact identity.

`PROBABLE` is heuristic. It is never equivalent to `EXACT`, is not suitable for
mutation targeting, and is not a persistence key without a future ADR.

### AMBIGUOUS

`AMBIGUOUS` means multiple candidates or conflicting signals prevent a safe
choice. It must prevail over silent inference. Callers must not select the first
candidate automatically.

### NO_MATCH

`NO_MATCH` means there is no defensible continuity under the scoped identity
policy.

## Private Signature Policy

`createPrivateIdentitySignature()` is accepted only as private supporting
evidence.

Its properties:

- internal;
- bounded by part count, per-part bytes and total material bytes;
- deterministic for the supplied material;
- based on FNV-1a 64-bit;
- not cryptographic;
- not a security primitive;
- not intended to be reversible in normal use, but not a confidentiality
  guarantee;
- not a stable global identifier;
- not a public DTO;
- not a persistence key;
- not a mutation target.

Private signatures can support `PROBABLE` or `AMBIGUOUS`; they must not elevate
a match to `EXACT` by themselves.

## Runtime Evidence

M17.2 provided REAL LOCAL HTTP evidence using:

- real Chromium;
- draw.io served by the repository harness;
- the real browser plugin;
- the real server runtime WebSocket;
- `InMemoryTransport` only for the MCP client side;
- real `cyberdraw.runtimeSnapshot.v1` extraction.

Runtime evidence proved:

- repeated snapshots preserve raw anchors for the tested entities;
- geometry moves preserve node raw anchor continuity;
- layer moves preserve element raw anchor continuity with
  `layer-context-changed` evidence;
- label/content edits preserve raw anchor continuity;
- layer renames preserve layer raw anchor continuity;
- unchanged edges and endpoint-changed edges preserve edge raw anchor
  continuity;
- delete/recreate of a visually similar node returns `NO_MATCH`;
- scoped external-reference evidence repeats exactly in the tested case.

M17.2 did not prove HTTPS/Caddy behavior, reload/reopen continuity,
import/reimport continuity, true page moves or arbitrary clone/copy-paste
behavior.

## Security And Privacy

Identity evidence can contain sensitive structure if callers include labels,
metadata, URLs or custom attributes in signature material. The policy therefore
requires:

- no identity evidence in public MCP responses;
- no raw signature material in returned signatures;
- no raw XML or graph dumps;
- no filesystem paths, hostnames or stack traces in identity diagnostics;
- no persistence of identity evidence by default;
- no use of identity evidence as authorization or mutation authority.

Future consumers must bucket, digest or omit sensitive text before constructing
private signature parts.

## Compatibility

This decision is backward compatible.

It does not change:

- M13 `m13-v1`;
- M14 `m14-v1`;
- M15 `m15-v1`;
- MCP tool names or schemas;
- runtime snapshot contract shape;
- plugin/server WebSocket protocol;
- public read-only Architecture Intelligence behavior.

The graph-model package remains private and internal. Its identity API is an
internal implementation surface, not a public compatibility promise.

## Consequences

Positive:

- downstream internal features can reason about identity without inventing
  incompatible policies;
- exact identity is conservative and evidence-bound;
- uncertainty is represented explicitly;
- semantic diff and incremental analysis can now be designed against a scoped
  identity foundation.

Negative:

- broad identity problems remain unresolved;
- callers must preserve the difference between identity continuity and semantic
  equality;
- future mutation or persistence work still needs separate design before using
  identity evidence.

## Explicit Non-Guarantees

This ADR does not accept:

- stable global identity;
- public stable graph identity;
- persistence or review-session keys;
- semantic diff;
- mutation execution;
- approval workflows;
- rollback or transactions;
- incremental analysis;
- complete-document public execution;
- identity across arbitrary imports, reloads, clones or copy/paste operations.

## Deferred Work

Future milestones may use this scoped policy as input when designing:

- semantic diff;
- incremental analysis;
- richer internal correlation;
- review lifecycle;
- persistence;
- controlled execution.

Those future milestones must not treat `PROBABLE` as `EXACT`, must not use
private signatures as public IDs, and must record their own acceptance evidence.
