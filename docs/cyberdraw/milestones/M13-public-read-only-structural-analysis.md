# M13: Public Read-Only Structural Analysis

## Status

COMPLETE.

M13 adds exactly one public MCP tool:

```text
cyberdraw_analyze_structure
```

The tool is read-only. It exposes bounded structural analysis, query, proposal
planning and plan validation over the currently open draw.io diagram without
adding any public mutation endpoint or executable change plan.

## Objective

Expose the internal M8-M12 chain through a small public response:

```text
MCP tool
-> runtime snapshot
-> hierarchical planning
-> scoped execution
-> bounded expansion
-> contextual merge
-> internal graph model
-> M9 structural analysis
-> M10 structural query
-> M11 structural change planning
-> M12 plan validation
-> public read-only response
```

## Scope

Implemented:

- one public server-side MCP tool;
- closed input schema and closed modes;
- default visible-page analysis when no scope is supplied;
- explicit page/layer scope support;
- bounded expansion, bytes, query and public response sizes;
- public mappers for findings, query metadata, plans, validation, diagnostics
  and limitations;
- public read-only safety field;
- unit tests, MCP registry tests and real-environment MCP calls.

## Non-Scope

M13 does not implement:

- applying proposals;
- editing draw.io, XML or mxGraphModel;
- saving files;
- executing commands, callbacks, scripts or arbitrary operations;
- public XML, snapshot, graph or internal model dumps;
- persistence, caching, semantic diff or stable identity guarantees;
- reconnect or move policies as public planning strategies.

## Tool Name

`cyberdraw_analyze_structure`.

## Input

The public schema is closed. Top-level fields:

- `mode`: `analyze`, `query`, `plan` or `validate`; default `analyze`.
- `scope`: optional `pageId` and optional `layerId`; `layerId` requires
  `pageId`.
- `expansion`: optional `enabled`, `maxScopes`, `maxDepth`, `maxBytes`.
- `query`: optional filters and pagination for `query`, `plan` and `validate`.
- `planning`: optional public policy and selected finding IDs for `plan` and
  `validate`.
- `validation`: optional validation mode for `validate`.
- `response`: optional include flags for public sections.

The tool rejects XML-like IDs, URL-like IDs, filesystem-path-like IDs, unknown
fields, unsafe numeric limits and prototype-pollution shaped objects.

## Modes

- `analyze`: runs M9 after M8 scoped execution.
- `query`: runs M9 and M10.
- `plan`: runs M9, optionally M10, then M11.
- `validate`: runs M9, optionally M10, then M11 and M12.

Invalid combinations are rejected:

- `query` is not allowed in `analyze`;
- `planning` is only allowed in `plan` and `validate`;
- `validation` is only allowed in `validate`;
- `planning.selectedFindingIds` and `query.findingIds` cannot both select
  findings in one request.

## Defaults

- `mode`: `analyze`.
- `scope`: current visible page through the internal planner.
- `expansion.enabled`: `true`.
- `expansion.maxScopes`: `4`.
- `expansion.maxDepth`: `2`.
- `expansion.maxBytes`: `2 MiB`.
- `query.limit`: `100`.
- `planning.policy`: `conservative`.
- `validation.mode`: `full-internal`.
- `response.includeFindings`: `true`.
- `response.includeSummary`: `true`.
- `response.includePlan`: `true`.
- `response.includeValidation`: `true`.
- `response.includeDiagnostics`: `false`.

Document scope is not used by default.

## Public Policies

Public policies are closed:

- `conservative`;
- `review-only`;
- `allow-detach-broken-terminal`;
- `allow-delete-confirmed-orphan`.

They map to M11 policy fields. M13 does not expose reconnect, move, raw policy
objects or arbitrary rule language.

## Selection

For `plan` and `validate`:

1. `planning.selectedFindingIds` selects exact finding IDs.
2. Otherwise, a supplied `query` selects the exact M10 result.
3. Otherwise, all eligible findings inside the M11 limits are selected.

There is no fuzzy, prefix or label matching.

## Output

The response has:

- `version: "m13-v1"`;
- `mode`;
- `outcome`;
- public `scope`, `coverage` and `revision`;
- optional `summary`;
- optional public `findings`;
- optional public `query`;
- optional public `plan`;
- optional public `validation`;
- optional public `diagnostics`;
- public `limitations`;
- `safety`.

It never returns raw M8-M12 objects.

## Public Mappings

Findings expose only structural identifiers and closed classifications:

- `findingId`;
- `type`;
- `classification`;
- contextual page/layer/element/edge/terminal IDs;
- `referencedElementId`;
- `reasonCode`;
- `confidence`;
- `reviewRequired`.

Query output exposes only outcome, counts, paging, ordering and truncation.

Plan output exposes non-executable proposals:

- `proposalId`;
- `proposalType`;
- `operationType`;
- finding IDs;
- contextual target IDs;
- rationale code;
- review/destructive flags;
- reversible estimate;
- precondition codes;
- limitation codes;
- `executable: false`.

Validation output exposes:

- `validationId`;
- outcome;
- plan integrity;
- revision and coverage status;
- failed precondition count;
- conflict count;
- proposal status summary;
- limitation codes;
- manual-review flag.

Diagnostics and limitations are sanitized to closed code/severity/id fields.

## Outcomes

Public outcomes are:

- `ok`;
- `ok-with-limitations`;
- `manual-review-required`;
- `insufficient-coverage`;
- `stale`;
- `conflict`;
- `invalid-request`;
- `analysis-failed`;
- `planning-blocked`;
- `validation-failed`;
- `resource-limit-exceeded`;
- `runtime-unavailable`.

Expected structural states such as insufficient coverage, missing findings,
conflicts and manual review are returned as normal responses.

## Errors

Schema and incompatible-mode errors are MCP errors. Runtime unavailability,
missing active diagram, unsupported plugin capability and timeout are controlled
MCP errors with sanitized messages. Stack traces and internal exception details
are not returned.

## Limits

Hard public caps:

- query limit: `500`;
- finding/page/layer ID arrays: `50`;
- identifier length: `512`;
- max scopes: `8`;
- max expansion depth: `4`;
- snapshot bytes: `4 MiB`;
- public findings: `200`;
- public proposals: `200`;
- public diagnostics/limitations: `100`;
- response bytes: `512 KiB`;
- timeout: `90 s`.

The tool does not silently raise caps. Oversized public responses are reduced to
a resource-limit response rather than returning unbounded data.

## Safety

The public safety field is produced by the server:

```json
{
  "readOnly": true,
  "mutationAttempted": false,
  "mutationInvocations": 0
}
```

The tool does not use mutation adapters, editor commands, XML writes, save
paths, filesystem writes or plugin mutation messages.

## Privacy

The public response excludes labels, XML, styles, full geometry, raw metadata,
graph dumps, source snapshots, serialized cells, filesystem paths, hostnames,
environment values, stack traces, commands, scripts, callbacks, functions and
runtime URLs.

## Instrumentation

Unit and real-environment tests cover the causal chain:

- planner invocation;
- runtime snapshot requests;
- merge;
- graph build;
- structural analysis;
- structural query;
- structural plan;
- structural validation;
- mutation count remains zero.

M13 does not expose this internal instrumentation in normal public responses.

## Real Fixture

The real test reuses the M9-M12 fixture:

- layer A initial scope;
- layer B expansion from a real external terminal reference;
- one broken target reference;
- one same-page cross-layer edge;
- one confirmed orphan;
- no document scope;
- public `analyze`, `query`, `plan` and `validate` MCP calls;
- public non-executable plan;
- public validation;
- UI state preserved;
- cleanup handled by the existing real-environment harness.

## Compatibility

Existing MCP tools, plugin registry entries, WebSocket private runtime snapshot
messages, HTTP/SSE transport, stdio transport and draw.io plugin behavior remain
compatible. No plugin-side public tool is added.

RFC 0001 remains Draft. ADR 0003 remains the accepted private graph-model
architecture. ADR 0004 is unchanged.

## Rollback

Rollback removes:

1. `packages/drawio-mcp-server/src/tools/cyberdraw-analyze-structure.ts`;
2. its tests;
3. the single registrar entry;
4. the `target_document` proxy exemption for the public tool;
5. M13 documentation updates.

No data migration is required because M13 adds no persistence.

## Exit Criteria

M13 is COMPLETE because:

- one public read-only MCP tool exists and appears in `tools/list`;
- the input schema is closed;
- all four modes are implemented;
- M8-M12 are reused without repeated phases in one invocation;
- proposals are non-executable;
- mutation remains zero;
- XML, graph dumps and raw internals are filtered;
- limits are strict;
- real MCP calls cover analyze, query, plan and validate;
- document scope is not used by default or by the layer fixture;
- UI preservation and cleanup remain covered;
- existing tool compatibility is preserved.
