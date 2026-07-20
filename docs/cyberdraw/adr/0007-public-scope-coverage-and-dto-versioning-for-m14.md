# ADR 0007: Public Scope, Coverage And DTO Versioning For M14

## Status

Accepted for M14 design.

## Context

M13 exposed `cyberdraw_analyze_structure` as the first public read-only
CyberDraw MCP tool. It returns `m13-v1` for bounded structural analysis, query,
planning and validation over safe default or explicit page/layer scope.

M14 needs richer public scope and query controls without changing existing M13
responses or introducing mutation.

## Problem

The next public milestone must let callers ask broader but still bounded
questions without confusing that capability with complete-document analysis.
It also must add public aggregate operations without fragmenting the public MCP
surface or breaking existing `m13-v1` clients.

## Decision

M14 keeps one public CyberDraw MCP tool:

```text
cyberdraw_analyze_structure
```

Versioning is request-driven:

- M13-compatible requests continue to return `m13-v1`.
- Requests using M14-only scope forms, operations or fields return `m14-v1`.
- Existing M13 requests are not automatically upgraded.

The normative M14 activation fields are:

- `scope.pageIds`;
- `scope.layerTargets`;
- `scope.document`;
- any accepted multi-page, multi-layer or mixed page/layer scope form;
- `mode: "query"` with `query.operation: "count"` or
  `query.operation: "summarize"`;
- `coverageRequirements`;
- `limits`;
- any future field explicitly added to the `m14-v1` contract.

Unknown fields are rejected by schema validation. They do not activate M14.
Version selection must be decided from the accepted request shape before
execution starts, not from analysis results.

M14 does not expose public complete-document scope. A request for document scope
is rejected structurally before execution. The server must not execute it, fall
back to another scope or broaden silently.

M14 accepts only bounded public scopes:

- default current page/layer;
- explicit page;
- explicit layer;
- explicit multiple pages;
- explicit multiple layers;
- explicit page/layer combinations.

M14 adds sanitized aggregate query operations:

- `count`;
- `summarize`.

They are selected through `mode: "query"` and `query.operation`, not by adding
new top-level modes. Those operations must not expose labels, XML, raw graph
data, raw snapshots, filesystem paths, hostnames, commands, callbacks or
environment values.

## Alternatives

### A: Add A Second Public Tool

Rejected. A second tool would fragment the public surface before the first
public CyberDraw tool has matured.

### B: Always Return `m14-v1`

Rejected. Existing M13-compatible calls should keep stable response behavior.

### C: Allow Complete-Document Scope Publicly

Rejected for M14. M13 and ADR 0005 established that document scope is not a safe
default. M14 extends bounded explicit scopes but does not introduce public full
document execution.

### D: Add Free-Form Query Language

Rejected. M14 should expose closed structural operations, not SQL, JSONPath,
regex, full-text search or arbitrary rule execution.

## Consequences

Positive:

- preserves one public CyberDraw tool;
- protects M13 clients from accidental DTO changes;
- gives users useful aggregate structural queries;
- keeps broad analysis bounded by explicit page/layer choices;
- preserves the read-only security model.

Negative:

- implementation must maintain version selection logic;
- public docs must explain when `m13-v1` versus `m14-v1` is returned;
- callers that need full-document analysis still need a future design.

## Guarantees

- M13-compatible requests keep `m13-v1`.
- M14-only requests use `m14-v1`.
- Document scope is rejected before execution.
- No request silently broadens to document scope.
- `count` and `summarize` are query operations under `mode: "query"`.
- `count` and `summarize` are sanitized and bounded.
- All M14 behavior remains read-only.

## Limitations

M14 does not stabilize identity across revisions, persist results, create
approval records, compute semantic diffs, apply changes, roll back changes,
stream results or chunk oversized scopes.

## Security And Privacy Impact

The decision preserves M13's read-only and privacy filtering posture while
allowing more explicit user-selected scope. The main security control is that
scope broadening must be explicit, bounded and rejectable. Aggregate operations
must be treated as potential information disclosure and therefore must expose
only sanitized structural counts and closed grouping keys.

## Compatibility

The decision is backward compatible because M13-compatible requests retain
their existing version and shape. M14 clients can opt into new behavior through
M14-only fields or operations.
