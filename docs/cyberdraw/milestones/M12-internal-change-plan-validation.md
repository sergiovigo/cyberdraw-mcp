# M12: Internal Change Plan Validation

## Status

COMPLETE internal milestone evidence.

M12 adds a private pure validation layer for M11 structural change plans. It
does not add a public MCP tool, public schema, endpoint, persistence, approval
workflow, executor, XML editing, draw.io command execution or mutation path.

The status is COMPLETE for the internal milestone because the pure unit matrix,
private server path, full validation run and real-environment evidence are
implemented and recorded in the final report.

## Objective

M12 validates that a `StructuralChangePlan` remains internally coherent and
correlates with the M9 analysis and optional M10 query result used to create it:

```text
runtime snapshot
-> hierarchical planning
-> scoped execution
-> expansion
-> merge
-> graph model
-> structural analysis
-> structural query
-> structural change plan
-> internal change plan validation
```

Validation means only that closed internal preconditions are satisfied by the
available data. It is not approval and does not apply the plan.

## Scope

Implemented:

- pure `validateStructuralChangePlan(input)` in `cyberdraw-graph-model`;
- closed validation modes: `integrity-only`, `analysis-correlated` and
  `full-internal`;
- closed outcomes with deterministic precedence;
- deterministic `m12-validation-*` IDs;
- recomputation of M11 plan, proposal and conflict IDs;
- plan counts, summary, duplicate and canonical ordering checks;
- closed operation, precondition and postcondition schema validation;
- correlation against current M9 analysis and optional M10 query result;
- document, revision, coverage and policy checks;
- conflict recomputation and missing/invented conflict detection;
- private server integration after M11 without repeating earlier phases.

## Non-Scope

M12 intentionally does not implement mutation, plan application, editor
adapters, plugin commands, XML or mxGraphModel editing, filesystem writes,
rollback, undo/redo, approval workflows, public MCP tools, HTTP endpoints,
persistence, caches, semantic diff, automatic fixes, execution engines, command
buses, scripting, DSLs, JSONPath, SQL, regex evaluation, streaming or chunking.

## Architecture

The validator lives in
`packages/cyberdraw-graph-model/src/structural-change-plan-validation.ts`.
The function accepts already materialized M11, M9 and optional M10 values and
returns a JSON-compatible result. It has no dependency on the server, browser,
filesystem, network, time, random values, environment variables or mutable
singletons.

The server wires the validator privately in
`executeHierarchicalSnapshotPlan()` after M11 planning. The new private
execution field is `structuralChangePlanValidation`.

## API Pure

`validateStructuralChangePlan(input)` accepts:

- `plan`;
- current `analysis`;
- optional current `queryResult`;
- optional expected policy;
- optional current revision evidence;
- explicit limits;
- one closed validation mode.

It returns:

- `validationVersion`;
- deterministic `validationId`;
- stored and recomputed plan IDs;
- outcome;
- document identity and revision status;
- coverage and plan integrity status;
- proposal and conflict validation results;
- failed preconditions;
- diagnostics, limitations and summary.

## Validation Modes

- `integrity-only`: validates schema, limits, IDs, ordering, counts, operations,
  preconditions, postconditions, conflicts and internal consistency. It does not
  assert freshness.
- `analysis-correlated`: also validates document identity, analysis version,
  revision evidence, coverage, completeness, finding presence and contextual
  targets.
- `full-internal`: also validates the supplied M10 query result when the plan
  carries `queryVersion`.

## Outcomes

Closed outcomes are:

`valid`, `valid-with-limitations`, `invalid-input`, `validation-failed`,
`tampered-plan`, `stale-plan`, `insufficient-coverage`,
`precondition-failed`, `conflict`, `blocked-by-policy`,
`unsupported-operation`, `limit-exceeded`, `incompatible-analysis`,
`incompatible-query-result` and `manual-review-required`.

Precedence is:

1. `invalid-input`
2. `validation-failed`
3. `tampered-plan`
4. `stale-plan`
5. `incompatible-analysis`
6. `incompatible-query-result`
7. `insufficient-coverage`
8. `conflict`
9. `precondition-failed`
10. `blocked-by-policy`
11. `unsupported-operation`
12. `manual-review-required`
13. `valid-with-limitations`
14. `valid`

## Plan Integrity

M12 recomputes `planId`, every `proposalId` and every `conflictId` from the
same canonical material used by M11. It also checks selected finding count,
proposal count, conflict count, manual review count, summary, duplicate IDs and
canonical ordering. A stored ID alone is never trusted.

Tampering detection covers changed plan IDs, proposal IDs, conflict IDs,
operations, targets, source finding IDs, coverage, revision, counts, proposals,
conflicts, preconditions, postconditions, rationale and ordering.

## Proposal Validation

Each proposal returns a status plus operation, target, finding, revision,
coverage, policy, precondition and conflict statuses. Proposal statuses are
closed: `valid`, `valid-with-review`, `invalid`, `stale`, `target-missing`,
`finding-missing`, `finding-changed`, `coverage-insufficient`,
`blocked-by-policy`, `conflict`, `unsupported-operation` and `tampered`.

## Preconditions

Only closed M11 preconditions are accepted:

- document identity matches;
- document revision matches;
- finding exists;
- finding classification unchanged;
- target identity unchanged;
- page/layer context unchanged;
- referenced element remains absent;
- referenced element remains ambiguous;
- coverage requirement satisfied;
- no conflicting proposal accepted.

Each precondition returns `passed`, `failed`, `not-verifiable`, `stale` or
`unsupported`. Unknown preconditions are rejected.

## Correlation

M9 correlation checks analysis version, document identity, revision evidence,
coverage, completeness, finding presence, finding classification and contextual
target identity. M10 correlation checks `outcome: "ok"`, query version,
analysis identity, document identity, revision evidence, coverage,
completeness, preserved diagnostics/limitations and exact selected finding IDs.
The query is not reexecuted.

## Freshness

When both original and current document revisions exist, they must match
exactly. A mismatch is `stale-plan`. Missing original or current revision
evidence is reported as a limitation and prevents an unqualified `valid`
outcome.

## Policy

The expected current policy is included in plan ID recomputation and operation
permission checks. Review-only blocks destructive operations. Delete, detach,
remove and reconnect require explicit policy allowances.

## Operations

M12 validates closed abstract operations only:

- `detach-terminal`;
- `remove-edge`;
- `delete-element`;
- `retain-element`;
- `move-element-to-layer`;
- `reconnect-edge`;
- `load-external-context`;
- `review`;
- `no-op`.

Operations cannot carry commands, callbacks, XML, paths or opaque payloads.

## Finding Classes

Broken-reference validation requires the referenced terminal to remain broken
or ambiguous as declared and the contextual edge/terminal target to match.
Orphan validation requires the orphan classification and contextual element to
match; destructive delete still requires sufficient target-scope or document
coverage and explicit policy. Cross-layer validation requires same structural
edge/source/target context and preserves review/no-op semantics.

## Conflicts

Conflicts are recomputed from proposal targets in O(P). Missing conflicts and
invented conflicts are reported deterministically. M12 does not resolve
conflicts.

## IDs

Validation IDs use the `m12-validation-*` namespace and are deterministic over
validation version, mode, plan identity, recomputed plan identity, document
identity, revision status, outcome, failed preconditions, proposal results and
conflict results. They do not use timestamps or random values.

## Limits

Default limits bound proposals, conflicts, preconditions, diagnostics,
identifier length, serialized plan bytes and canonicalization depth. Unsafe
numbers, excessive depth, excessive bytes, dangerous prototype keys and
non-plain objects are rejected.

## Security

M12 emits no labels, XML, graph dumps, filesystem paths, hostnames,
environment values, commands, callbacks, eval strings, runtime URLs or
executable inputs. Inputs are defensively cloned and prototype pollution shaped
objects are rejected.

## Complexity

Validation is O(P + C + Preconditions) for plan integrity and O(F + P) for
analysis correlation. Conflict recomputation is O(P). Canonicalization is
bounded by explicit size and depth limits.

## Compatibility

M12 extends private package/server types only. Existing public MCP tools,
schemas, plugin behavior and WebSocket public surfaces are unchanged. RFC 0001
remains Draft. ADR 0004 is unchanged.

## Rollback

Rollback removes:

1. `structural-change-plan-validation.ts` and tests;
2. graph-model exports and optional execution-result field;
3. optional server executor validation call;
4. M12 test additions and documentation references.

No migration is required because no persistence or public API was added.

## Exit Criteria

M12 is COMPLETE in this working tree. The pure layer, private server
integration, deterministic IDs, tampering checks, correlation checks, closed
operation/precondition validation, no-public-tool guard, no-mutation
instrumentation, complete validation run and real-environment M12 evidence are
implemented.
