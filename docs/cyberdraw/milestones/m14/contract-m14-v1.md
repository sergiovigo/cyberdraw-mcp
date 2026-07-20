# M14 Contract Specification: m14-v1

## Status

PLANNED / DESIGN.

This document specifies the intended public `m14-v1` contract for
`cyberdraw_analyze_structure`. It is not implemented yet.

## Version Negotiation

M14 keeps request-driven versioning:

- M13-compatible requests return `m13-v1`.
- Requests using M14-only operations, scope forms, coverage requirements or
  response fields return `m14-v1`.
- The server must not upgrade an existing M13-compatible request solely because
  M14 exists.
- Version selection is decided from accepted request shape before execution.
- Unknown fields are rejected and do not activate M14.

Normative M14 activation fields:

- `scope.pageIds`;
- `scope.layerTargets`;
- `scope.document`;
- any accepted multi-page, multi-layer or mixed page/layer scope form;
- `mode: "query"` with `query.operation: "count"` or
  `query.operation: "summarize"`;
- `coverageRequirements`;
- `limits`;
- any future field explicitly added to this contract.

## Input

Top-level input remains a closed object. M14 design fields:

- `mode`: `analyze`, `query`, `plan` or `validate`.
- `scope`: default, inherited M13 page/layer scope, explicit M14 page IDs,
  explicit M14 page-qualified layer targets or rejected document scope.
- `query`: exact structural filters for `query`, `plan` and `validate`.
  `query.operation` selects `list`, `count` or `summarize` for `mode:
"query"`.
- `coverageRequirements`: requested minimum coverage class.
- `limits`: client-requested caps bounded by server configuration.
- `expansion`: bounded expansion controls.
- `planning`: closed planning policy and selected finding IDs for `plan` and
  `validate`.
- `validation`: closed validation mode for `validate`.
- `response`: include flags and public result caps.

Unknown fields are rejected.

Input normalization is deterministic:

- omitted `scope` uses the M13 safe default current page/layer resolver;
- inherited single page/layer fields remain M13-compatible when no M14 field is
  present;
- `pageIds` and each `layerTargets[].layerIds` array must be non-empty;
- IDs must be non-empty strings after schema validation;
- exact duplicate page IDs or layer IDs are removed in first-seen order;
- a page cannot appear in both `pageIds` and `layerTargets`; that would broaden
  a layer target to page scope and is rejected with `duplicate-scope-target`;
- a layer target whose page does not match the resolved layer ownership is
  rejected with `layer-not-found`;
- an explicit scope that resolves no target is rejected with `empty-scope`;
- explicit scope never falls back to default scope.

## Scope

Supported M14 public scope intents:

- omitted scope: safe default current page/layer behavior from M13;
- explicit page through `pageIds`;
- explicit layer through page-qualified `layerTargets`;
- explicit multiple pages through `pageIds`;
- explicit multiple layers through `layerTargets`;
- explicit page/layer combinations through `pageIds` plus non-overlapping
  `layerTargets`.

Unsupported public scope intent:

- document scope.

Document scope must return structured rejection with
`document-scope-not-supported` and no execution. Rejections for document scope
use `m14-v1`, do not execute content snapshots, do not fall back to default
scope and keep read-only safety counters at zero.

## Query

M14 query remains closed and exact. It may expose M10-backed filters such as:

- finding types;
- classifications;
- reason codes;
- page IDs;
- layer IDs;
- element IDs;
- source IDs;
- target IDs;
- referenced IDs;
- confidences.

M14 does not expose label search, XML search, free text, SQL, JSONPath, regex,
embeddings or a rule language.

## Operations

M14 public top-level modes remain:

- `analyze`: return structural findings and summary.
- `query`: return filtered structural findings or sanitized aggregate outputs.
- `plan`: return non-executable proposals.
- `validate`: return read-only validation for the generated plan.

For `mode: "query"`, `query.operation` is normative:

- omitted or `list`: return filtered structural findings and remains
  M13-compatible when no other M14 field is present;
- `count`: return aggregate counts without finding payloads;
- `summarize`: return closed grouping buckets without finding payloads unless
  explicitly included within caps.

`count` and `summarize` are not top-level modes.

## Coverage Requirements

Supported conceptual coverage requirements:

- `any`;
- `nonStale`;
- `completeTargetScopes`.

`completeDocument` is not accepted as a public M14 execution requirement
because public document scope is not supported.

Coverage requirement behavior:

- `any` allows a bounded result with explicit limitations.
- `nonStale` rejects stale coverage with `stale-coverage`.
- `completeTargetScopes` requires every normalized target scope to be inspected
  conclusively; failure is `incomplete-target-scope`.
- `conclusive` means the inspected target scope has a definite result.
- `complete` means every requested target scope was inspected as requested.
- `completeness: "unknown"` is a valid limitation state and is not itself an
  error.
- Partial results are allowed only when the requested coverage requirement does
  not require rejection.

## Limits

Limits must be configurable. M14 must bound:

- pages;
- layers;
- findings;
- proposals;
- expansion steps;
- execution time;
- response bytes.

Initial values remain open decisions until implementation evidence exists.

## Response

`m14-v1` response fields:

- `version`: always present;
- `mode`: always present;
- `operation`: always present and normalized, such as `analyze`, `list`,
  `count`, `summarize`, `plan` or `validate`;
- `outcome`: always present;
- `requestedScope`: always present;
- `executedScope`: always present;
- `coverage`: always present;
- `limitations`: always present, empty when there are no limitations;
- optional `summary`;
- optional `results`;
- optional `plan`;
- optional `validation`;
- `revision`: always present when revision evidence exists;
- `safety`: always present.

Rejected responses keep `requestedScope`, empty `executedScope`, `coverage`,
`limitations`, `revision` when available and `safety`. They do not include XML,
raw graph dumps, raw snapshots or sensitive content.

## Requested Scope

`requestedScope` records the user's explicit intent or defaulted state:

- `defaulted`;
- `scopeType`;
- page IDs;
- page-qualified layer IDs;
- rejected reason when applicable.

## Executed Scope

`executedScope` records what actually ran. For rejected requests, it must be
empty and must state that no execution occurred.

## Coverage

Coverage must distinguish:

- conclusive coverage for inspected scopes;
- stale coverage;
- truncated coverage;
- incomplete target scope;
- unknown complete-document coverage.

M14 must not imply complete-document coverage from multiple pages or layers.

## Limitations

Limitations use stable reason codes from
[`reason-code-registry.md`](reason-code-registry.md). They must not include
labels, XML, paths, hostnames, stack traces or environment values.

## Summary

`summary` may include sanitized counts such as:

- finding count;
- broken reference count;
- cross-layer edge count;
- confirmed orphan count;
- proposal count;
- conflict count;
- manual review count.

## Results

`results` may include:

- public findings for `query`;
- count totals for `count`;
- grouping buckets for `summarize`.

Results must be capped and deterministic.

## Revision

`revision` exposes public compatibility status and revision counters already
available through the M13 model. M14 does not define stable identity across
document revisions.

## Safety

Safety remains:

```json
{
  "readOnly": true,
  "mutationAttempted": false,
  "mutationInvocations": 0
}
```

Any nonzero mutation counter is a read-only invariant failure.

## Reason Codes

Initial reason codes are defined in
[`reason-code-registry.md`](reason-code-registry.md).

## Examples

### Default Analyze Compatible With M13

This remains M13-compatible and should return `m13-v1`.

```json
{
  "mode": "analyze"
}
```

### Explicit Page Query

```json
{
  "mode": "query",
  "scope": {
    "pageIds": ["page-a"]
  },
  "query": {
    "operation": "list",
    "findingTypes": ["broken-reference"],
    "limit": 50
  },
  "coverageRequirements": {
    "minimum": "nonStale"
  }
}
```

### Explicit Layer Summarize

```json
{
  "mode": "query",
  "scope": {
    "layerTargets": [
      {
        "pageId": "page-a",
        "layerIds": ["layer-1"]
      }
    ]
  },
  "query": {
    "operation": "summarize",
    "groupBy": "finding-type"
  },
  "coverageRequirements": {
    "minimum": "completeTargetScopes"
  }
}
```

### Multi-Page Count

```json
{
  "mode": "query",
  "scope": {
    "pageIds": ["page-a", "page-b"]
  },
  "query": {
    "operation": "count",
    "classifications": ["broken", "confirmed-orphan"]
  }
}
```

### Multi-Layer Query

```json
{
  "mode": "query",
  "scope": {
    "layerTargets": [
      {
        "pageId": "page-a",
        "layerIds": ["layer-1", "layer-2"]
      }
    ]
  },
  "query": {
    "operation": "list",
    "reasonCodes": ["missing_edge_target"],
    "order": "page-layer",
    "limit": 100
  }
}
```

### Stale Coverage Rejection

```json
{
  "version": "m14-v1",
  "mode": "query",
  "operation": "list",
  "outcome": "rejected",
  "requestedScope": {
    "defaulted": false,
    "scopeType": "pages",
    "pageIds": ["page-a"]
  },
  "executedScope": {
    "executed": false
  },
  "coverage": {
    "conclusive": false,
    "stale": true,
    "truncated": false,
    "completeness": "unknown"
  },
  "limitations": [
    {
      "code": "stale-coverage"
    }
  ],
  "revision": {
    "compatible": false
  },
  "safety": {
    "readOnly": true,
    "mutationAttempted": false,
    "mutationInvocations": 0
  }
}
```

### Scope Too Broad

```json
{
  "version": "m14-v1",
  "mode": "query",
  "operation": "count",
  "outcome": "rejected",
  "requestedScope": {
    "defaulted": false,
    "scopeType": "pages",
    "pageIds": ["page-a", "page-b", "page-c"]
  },
  "executedScope": {
    "executed": false
  },
  "coverage": {
    "conclusive": false,
    "stale": false,
    "truncated": false,
    "completeness": "unknown"
  },
  "limitations": [
    {
      "code": "scope-too-broad"
    }
  ],
  "revision": {
    "compatible": true
  },
  "safety": {
    "readOnly": true,
    "mutationAttempted": false,
    "mutationInvocations": 0
  }
}
```

### Document Scope Rejected

```json
{
  "mode": "analyze",
  "scope": {
    "document": true
  }
}
```

Expected response shape:

```json
{
  "version": "m14-v1",
  "mode": "analyze",
  "operation": "analyze",
  "outcome": "rejected",
  "requestedScope": {
    "defaulted": false,
    "scopeType": "document",
    "rejected": true
  },
  "executedScope": {
    "executed": false
  },
  "coverage": {
    "conclusive": false,
    "stale": false,
    "truncated": false,
    "completeness": "unknown"
  },
  "limitations": [
    {
      "code": "document-scope-not-supported"
    }
  ],
  "revision": {
    "compatible": true
  },
  "safety": {
    "readOnly": true,
    "mutationAttempted": false,
    "mutationInvocations": 0
  }
}
```

### Plan Non-Executable

```json
{
  "mode": "plan",
  "scope": {
    "layerTargets": [
      {
        "pageId": "page-a",
        "layerIds": ["layer-1"]
      }
    ]
  },
  "query": {
    "findingTypes": ["broken-reference"]
  },
  "planning": {
    "policy": "review-only"
  }
}
```

### Validate Read-Only

```json
{
  "mode": "validate",
  "scope": {
    "pageIds": ["page-a"]
  },
  "query": {
    "findingTypes": ["broken-reference"]
  },
  "planning": {
    "policy": "review-only"
  },
  "validation": {
    "mode": "full-internal"
  }
}
```
