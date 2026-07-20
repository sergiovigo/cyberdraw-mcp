# M13 Formal Closure: Public Read-Only Structural Analysis

## Status

COMPLETE / CLOSED.

M13 is complete, integrated in `main`, validated by CI and tested through a real
MCP invocation from Codex against the Draw.io editor.

## Milestone Identification

- Milestone: M13.
- Public feature: read-only structural analysis.
- Public MCP tool: `cyberdraw_analyze_structure`.
- Public DTO version: `m13-v1`.
- Delivery PRs: PR #18, PR #19 and PR #20.

## Original Objective

Expose the internal M8-M12 structural chain as one bounded public MCP tool that
can analyze, query, plan and validate structural findings without editing
draw.io, emitting executable operations or exposing raw internal graph data.

## Delivered Scope

M13 delivered:

- one public MCP tool named `cyberdraw_analyze_structure`;
- a closed public input schema;
- public modes `analyze`, `query`, `plan` and `validate`;
- default safe scope resolution from the active document, active page and a
  deterministic visible layer when one is available;
- explicit page and layer scopes;
- bounded expansion and response limits;
- sanitized public findings, query metadata, plans, validation, limitations and
  diagnostics;
- public safety counters proving read-only behavior;
- multi-document routing hardening for WebSocket-backed documents.

M13 did not deliver mutation, plan execution, XML editing, persistence, raw
graph dumps, semantic diffing, stable long-term identity guarantees or an
approval workflow.

## Components Incorporated

- Public server tool implementation for `cyberdraw_analyze_structure`.
- Server registration so the tool is visible in MCP `tools/list`.
- Public DTO mapper for `m13-v1`.
- Safe default scope resolver.
- Public input validation and limit enforcement.
- Read-only safety accounting.
- Real-environment coverage through the existing hierarchical snapshot harness.
- WebSocket document registry hardening for active-document replacement.
- Documentation updates for M13.

## Functional Architecture

The public call wraps existing internal phases:

```text
MCP tool call
-> active document/page/layer scope resolution
-> runtime snapshot
-> hierarchical planning
-> scoped execution
-> bounded expansion
-> contextual merge
-> internal graph model
-> M9 structural analysis
-> optional M10 structural query
-> optional M11 structural change planning
-> optional M12 plan validation
-> sanitized m13-v1 public response
```

The public response does not expose raw runtime snapshots, XML, labels,
serialized cells, internal graph objects, commands or executable operations.

## Public MCP Contract

The public contract is:

- tool name: `cyberdraw_analyze_structure`;
- DTO version: `m13-v1`;
- default mode: `analyze`;
- response sections: `scope`, `coverage`, `revision`, optional public details,
  `limitations` and `safety`;
- safety output:

```json
{
  "readOnly": true,
  "mutationAttempted": false,
  "mutationInvocations": 0
}
```

Schema errors and incompatible mode combinations are rejected. Runtime and
coverage limitations are represented with controlled outcomes and closed
limitation codes.

## Supported Modes

| Mode       | Internal phases              | Public behavior                                               |
| ---------- | ---------------------------- | ------------------------------------------------------------- |
| `analyze`  | M8/M9                        | Returns public structural summary and findings when included. |
| `query`    | M8/M9/M10                    | Filters already produced structural findings.                 |
| `plan`     | M8/M9, optional M10, M11     | Returns non-executable public proposals.                      |
| `validate` | M8/M9, optional M10, M11/M12 | Returns public validation status for the generated plan.      |

## Security Model

M13 is read-only by design:

- no mutation adapters are invoked;
- plans are public descriptions with `executable: false`;
- unsafe input shapes and unsafe identifiers are rejected;
- limits bound scope expansion, serialized response size, IDs and query counts;
- labels, XML, graph dumps, paths, hostnames, environment values and stack
  traces are filtered from public output;
- default scope never silently broadens to full-document analysis.

## Default Scope Behavior

A call without `scope`:

1. resolves an unequivocal active document;
2. resolves the active page;
3. selects a deterministic visible layer when one is resolvable;
4. falls back to page scope only when no layer can be resolved;
5. fails closed when the active page or active document is ambiguous;
6. never falls back silently to document scope.

This behavior was corrected by PR #19.

## Explicit Scope Behavior

Explicit page scope preserves the requested page. Explicit layer scope requires
the page ID and preserves the requested layer. Missing explicit targets produce
controlled failures or limitations instead of broadening to document scope.

## Read-Only Guarantees

The public safety section is produced by the server and remains:

- `readOnly: true`;
- `mutationAttempted: false`;
- `mutationInvocations: 0`.

Tests also fail closed if internal mutation counters are unexpectedly
incremented.

## Multiple-Document Handling

Each WebSocket connection keeps exactly one active document at a time. When the
same connection reports a new document, the server replaces the prior active
document for that connection instead of accumulating historical IDs. Multiple
connections still represent multiple concurrently available documents, and
explicit `target_document` routing is preserved.

This behavior was corrected by PR #20.

## Known Limitations

- Default analysis is scoped, not complete-document analysis.
- Cross-page or external-context relationships may require explicit expansion
  or additional context.
- Very large scopes remain bounded by public and internal limits.
- Public plans are review artifacts only and cannot be executed through M13.
- Completeness can be `unknown` when the inspected scope is conclusive but not a
  complete-document view.

The expected final limitation for the real Codex validation is
`analysis-is-scoped-not-complete-document`.

## Tests and Validations Performed

Automated evidence in the repository includes:

- `packages/drawio-mcp-server/src/tools/cyberdraw-analyze-structure.test.ts`
  for schema validation, defaults, public-only data, modes, safety counters,
  deterministic ordering, `tools/list`, fail-closed behavior and explicit
  scopes;
- `packages/drawio-mcp-server/src/real-environment/hierarchical-snapshot.test.ts`
  for real-environment M13 calls, UI preservation, no document snapshots by
  default and zero mutation invocations;
- `packages/drawio-mcp-server/src/documents-changed-broadcast.test.ts` for
  active-document replacement, multiconnection handling, explicit target
  routing and M13 default analysis on the latest document;
- `packages/drawio-mcp-server/src/stdio-transport-purity.test.ts` for stdout
  purity of stdio transport.

## CI Evidence

`.github/workflows/server-ci.yml` runs server CI on Node.js `22.x` and `24.x`
for pull requests and pushes that touch the server or runtime contract. The
workflow installs dependencies, audits dependencies, installs Chromium, builds
the server dependency closure, prefetches draw.io assets, runs server lint and
format checks, and runs the server test suite.

The M13 delivery commits are present in `git log` on `main`:

- PR #18: `feat(cyberdraw): add public read-only structural analysis tool`;
- PR #19: `fix(m13): resolve default analyze scope from active page/layer`;
- PR #20: `fix(server): replace active document per websocket connection`.

## Real Codex Validation

The final real validation from Codex invoked
`cyberdraw_analyze_structure` with `mode=analyze` and safe defaults against the
Draw.io editor. The observed public response included:

```text
outcome: ok-with-limitations
scope.inspected.document: false
scope.documentScopeUsed: false
coverage.conclusive: true
coverage.truncated: false
coverage.stale: false
coverage.completeness: unknown
safety.readOnly: true
safety.mutationAttempted: false
safety.mutationInvocations: 0
```

The expected limitation was observed:

```text
analysis-is-scoped-not-complete-document
```

## Validation Incidents

Three validation incidents were found and closed:

- Codex session inventory was stale and did not initially expose the tool.
- WebSocket port `3333` was already in use during local validation.
- One WebSocket connection accumulated historical document IDs before PR #20.

The first two were operational session/process issues. The third was a product
defect fixed by PR #20.

Detailed records are in
[`closure-incidents.md`](closure-incidents.md).

## Corrections Applied

- PR #19 corrected default scope resolution so safe defaults resolve from the
  active page/layer instead of failing or widening unexpectedly.
- PR #20 corrected document registry behavior so a WebSocket connection
  atomically replaces its active document.

## Residual Risks

- Callers may misinterpret scoped coverage as complete-document coverage unless
  they read `scope`, `coverage` and `limitations`.
- External relationships outside the inspected scope can remain undiscovered
  until explicitly loaded or expanded.
- Future mutation-capable milestones must keep M13's public plan output
  non-executable unless a separate accepted design changes that boundary.
- Operational MCP clients can cache tool inventories; restarting or reconnecting
  may be required after server changes.

## Acceptance Criteria

M13 acceptance criteria are mapped in
[`acceptance-matrix.md`](acceptance-matrix.md). All listed criteria are closed
for the delivered M13 scope.

## Final Result

M13 is COMPLETE / CLOSED. The milestone introduced one public read-only MCP
tool, delivered `m13-v1`, preserved safe scoped defaults, kept mutation counters
at zero, handled multiple documents correctly after PR #20, and remains covered
by automated tests, CI configuration and real Codex validation against Draw.io.

## Formal Closure Declaration

M13 is complete, integrated in `main`, validated through CI, and proven by a
real MCP invocation from Codex against the Draw.io editor. No additional M13
code, test, dependency or lockfile changes are required for closure.
