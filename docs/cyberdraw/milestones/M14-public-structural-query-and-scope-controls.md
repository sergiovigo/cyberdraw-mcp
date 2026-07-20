# M14: Public Structural Query and Scope Controls

## Status

PLANNED / DESIGN.

M14.0 defines the design for the next public CyberDraw MCP milestone after M13.
It does not implement code, tests or runtime behavior.

## Objective

Make `cyberdraw_analyze_structure` more useful for read-only structural
inspection by adding explicit bounded scope controls and public sanitized
`count` and `summarize` query operations while preserving M13 behavior for
existing compatible requests.

## Motivation

M13 proved that CyberDraw can safely expose structural analysis, query,
planning and validation through one public read-only MCP tool. The next product
gap is not mutation. The next gap is precision: callers need to ask targeted
questions across explicit pages or layers, understand coverage requirements,
receive structured scope rejections, and get counts or summaries without
requesting full finding payloads.

## Relationship With M13

M14 builds directly on M13:

- keeps `cyberdraw_analyze_structure` as the only CyberDraw public tool;
- keeps M13-compatible requests on `m13-v1`;
- returns `m14-v1` only when a request uses M14-only capabilities;
- keeps default scope safe and scoped to current page/layer behavior;
- keeps all CyberDraw structural capabilities read-only;
- preserves M13 plan and validate behavior as non-executable review output.

## Scope

M14 is in scope for:

- explicit multiple-page scope;
- explicit multiple-layer scope;
- bounded page/layer combinations;
- structured rejection of document scope;
- explicit coverage requirements for public query-style operations;
- sanitized public query operations: `count` and `summarize` under
  `mode: "query"`;
- `m14-v1` contract documentation;
- compatibility matrix for M13 and M14 requests;
- limit model and reason-code registry;
- unit, server and real-environment validation plans.

## Exclusions

M14 does not include:

- document scope execution;
- silent broadening from a narrower scope to a broader one;
- persistence;
- approval workflows;
- semantic diff;
- execution or application of proposals;
- rollback;
- transactions;
- chunking;
- streaming;
- stable identity across revisions;
- new CyberDraw public MCP tools;
- changes to inherited Draw.io mutation tools.

CyberDraw mutation remains postponed until the sequence:

```text
query/scope -> preview -> semantic diff -> approval -> controlled execution
```

is designed and accepted.

## Architecture

M14 keeps the M13 pipeline and extends only the public contract and bounded
scope/query mapping:

```text
cyberdraw_analyze_structure request
-> M13-compatible or M14-capable input classification
-> safe default or explicit bounded page/layer scope resolution
-> structured rejection for document scope or over-broad scope
-> hierarchical scoped execution
-> M9 structural analysis
-> M10 query selection, including count/summarize when requested
-> optional M11 planning for plan mode
-> optional M12 validation for validate mode
-> sanitized m13-v1 or m14-v1 response
```

M14 should not add persistence or a second source of truth. The draw.io runtime
remains authoritative. The internal graph model remains reconstructable and
discardable for one bounded snapshot-derived analysis run.

## Public Contract

The public tool remains:

```text
cyberdraw_analyze_structure
```

Versioning:

- M13-compatible requests return `version: "m13-v1"`.
- Requests using M14-only fields or operations return `version: "m14-v1"`.
- Existing M13 calls are not automatically upgraded.

M14 keeps the M13 top-level modes:

- `analyze`;
- `query`;
- `plan`;
- `validate`.

M14 adds `count` and `summarize` as sanitized `query.operation` values under
`mode: "query"`. The exact activation rule is normative in
[`m14/contract-m14-v1.md`](m14/contract-m14-v1.md) and ADR
[`0007`](../adr/0007-public-scope-coverage-and-dto-versioning-for-m14.md).

M14 scopes:

- default current page/layer;
- explicit page;
- explicit layer;
- explicit multiple pages;
- explicit multiple layers;
- bounded page/layer combinations.

Document scope is rejected before execution with a structured reason code. It
does not execute, fall back or broaden silently.

## Compatibility

M14 must be backward compatible with M13:

- M13 input shape remains valid.
- M13 response version remains `m13-v1` for M13-compatible inputs.
- Existing M13 mode names retain behavior.
- M13 safety counters remain present.
- M13 default scope remains safe and not document-wide.

M14 adds `m14-v1` only for new request forms, operations or scope shapes.

## Security

Security invariants:

- all M14 operations are read-only;
- mutation counters must remain zero;
- public plans remain non-executable;
- no draw.io editor command is invoked by CyberDraw analysis;
- no XML, raw graph, raw snapshot, labels, hostnames, filesystem paths,
  callbacks, commands or environment values are exposed;
- document scope is not a public execution scope;
- unsafe or over-broad requests fail closed with structured limitations.

## Privacy

M14 output must remain sanitized. `count` and `summarize` should report
aggregate structural facts without exposing labels, raw values or XML.

When scope is broad but still bounded, the response must identify requested and
executed scope in structural IDs only and retain coverage limitations so callers
do not infer complete-document coverage.

## Limits

M14 requires configurable limits for pages, layers, findings, proposals,
expansion steps and execution time. Initial values are design proposals, not
accepted implementation constants, and must be validated before implementation.

The limit model is recorded in
[`m14/limits-model.md`](m14/limits-model.md).

## Risks

- Public multi-scope requests could make large diagrams slower if limits are
  too high.
- Callers may still confuse multi-page coverage with complete-document
  coverage.
- Supporting both `m13-v1` and `m14-v1` adds mapper and test complexity.
- M14 increases public query expressiveness and must not become an arbitrary
  query language.
- Future mutation work may be tempted to reuse M14 result IDs as stable
  identity; M14 must not promise that.

## Slices

### M14.0: Design And Contracts

Document the milestone, ADR, `m14-v1` contract, compatibility matrix, limit
model and reason-code registry.

### M14.1: Scope Model

Implement public input parsing for explicit multi-page, multi-layer and bounded
page/layer combination scopes. Reject document scope structurally.

### M14.2: Query Operations

Expose sanitized `count` and `summarize` query operations through `mode:
"query"` and the existing internal M10 query layer without adding free-form
search, labels or raw graph output.

### M14.3: Server Contract And Safety

Wire `m14-v1` response mapping, version selection, safety counters, privacy
filters, result limits and structured reason codes.

### M14.4: Real-Environment Validation

Validate default, explicit page, explicit layer, multi-page, multi-layer,
rejected document scope, stale coverage and limit behavior through real MCP
calls against Draw.io.

### M14.5: Documentation And Closure

Update CyberDraw docs, tool inventory, onboarding and closure evidence after
implementation and CI validation.

## PR Strategy

Recommended PR sequence:

1. `docs(m14): define public query and scope controls`
2. `feat(m14): add bounded public scope model`
3. `feat(m14): expose count and summarize query operations`
4. `test(m14): add real-environment public scope validation`
5. `docs(m14): close public query and scope controls`

The implementation PRs may be combined only if the diff remains reviewable and
does not mix docs-only design with runtime behavior.

## Acceptance Criteria

M14 can be accepted when:

- M13-compatible requests still return `m13-v1`;
- M14-only requests return `m14-v1`;
- `cyberdraw_analyze_structure` remains the only public CyberDraw tool;
- default scope remains current page/layer and never document scope;
- explicit page, layer, multi-page and multi-layer scopes are bounded;
- document scope is structurally rejected before execution;
- `count` and `summarize` query operations are sanitized and bounded;
- `plan` and `validate` remain read-only and non-executable;
- mutation counters remain zero;
- coverage and limitations distinguish inspected scope from complete-document
  coverage;
- Node.js 22.x and 24.x CI lanes pass;
- real MCP validation covers the new public contract.

## Closure Criteria

M14 can close only after:

- implementation is merged;
- CI passes for the server workflow;
- real MCP validation is recorded;
- M14 docs and index entries are updated;
- reason codes and limits are documented as implemented;
- no code path applies CyberDraw structural proposals;
- no document scope execution exists.
