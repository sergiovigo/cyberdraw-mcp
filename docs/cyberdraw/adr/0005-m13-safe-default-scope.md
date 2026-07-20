# ADR 0005: M13 Safe Default Scope

## Status

Accepted.

## Context

M13 exposes the first public read-only structural analysis MCP tool:
`cyberdraw_analyze_structure`. Earlier M8-M12 phases were internal and
scope-first. Public callers can omit `scope`, so M13 needs a default that is
useful, deterministic and bounded without surprising the user by analyzing an
entire document.

## Problem

A missing scope can be interpreted several ways:

- analyze the whole document;
- analyze the active page;
- analyze the active layer;
- reject the call until the user supplies an explicit scope.

Full-document fallback is unsafe for default public behavior because it can
increase payload size, latency and privacy exposure. Silent widening also makes
`coverage` harder to reason about.

## Alternatives

### A: Default To Document Scope

Rejected. It is broad, potentially expensive and reveals more structural
context than the user requested.

### B: Require Explicit Scope

Rejected for M13 because it makes the simplest read-only invocation harder and
does not match the active-editor workflow.

### C: Default To Active Page Only

Acceptable but less precise than the active visible layer when a layer is
unambiguously available.

### D: Default To Active Page And Deterministic Visible Layer

Accepted. It preserves active-editor intent, avoids whole-document widening and
keeps the response bounded.

## Decision

When `cyberdraw_analyze_structure` is called without `scope`, M13:

1. resolves the active document unequivocally;
2. resolves the active page;
3. selects a deterministic visible layer when one exists;
4. falls back to page scope when no layer is resolvable;
5. fails closed when no active page is unequivocally resolvable;
6. never falls back silently to document scope.

This decision was implemented and corrected by PR #19.

Explicit scopes are preserved: explicit page scope remains page scope, and
explicit layer scope remains the requested page/layer scope. Missing explicit
targets return controlled failures or limitations instead of widening to
document scope.

## Consequences

Positive:

- default calls are bounded and predictable;
- public responses are easier to interpret;
- the user does not accidentally request document-wide analysis;
- privacy exposure remains proportional to the active editor context.

Negative:

- default calls do not provide complete-document coverage;
- callers that need full-document reasoning must request broader explicit
  behavior through a separately designed capability, not through M13 defaults;
- scoped limitations must be surfaced clearly.

## Guarantees

- `scope.inspected.document` is false for default M13 calls.
- `scope.documentScopeUsed` is false for default M13 calls.
- Missing or ambiguous active page state fails closed.
- Missing visible layer falls back only to page scope.
- Default scope does not silently widen to document scope.

## Limitations

The default result can be conclusive for the inspected scope while still having
unknown complete-document coverage. The public response must preserve that
distinction through `scope`, `coverage` and `limitations`.

## Security And Privacy Impact

Safe defaults reduce the amount of diagram structure exposed by a minimal public
tool call. They also reduce the chance that a client accidentally collects
labels, relationships or graph structure outside the user's active context. M13
still filters labels, XML, raw graph data and runtime internals from public
responses.
