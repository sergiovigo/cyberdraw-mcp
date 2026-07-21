# M14 Compatibility Matrix

## Status

IMPLEMENTED / CLOSED.

This matrix records the final M14 compatibility surface after PRs #22-#25.
M13-compatible requests remain on `m13-v1`; recognized M14 capabilities select
`m14-v1` before runtime execution.

| Request type                                    | Response version                                   | Behavior                                                 | M13 compatibility                                         | Limitations                                    |
| ----------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------- |
| M13 default `analyze`                           | `m13-v1`                                           | Current default current page/layer analysis              | Fully compatible                                          | Not complete-document coverage                 |
| M13 `query`                                     | `m13-v1`                                           | Existing public filtered findings metadata               | Fully compatible                                          | No public count/summarize operation            |
| M13 `plan`                                      | `m13-v1`                                           | Existing non-executable proposal output                  | Fully compatible                                          | No execution or approval                       |
| M13 `validate`                                  | `m13-v1`                                           | Existing read-only validation output                     | Fully compatible                                          | No mutation or rollback                        |
| Explicit single page with inherited M13 fields  | `m13-v1`                                           | Existing explicit page analysis/query/plan/validate      | Fully compatible                                          | Single page only                               |
| Explicit single layer with inherited M13 fields | `m13-v1`                                           | Existing explicit layer analysis/query/plan/validate     | Fully compatible                                          | Single layer only                              |
| M14 page query through `scope.pageIds`          | `m14-v1`                                           | Bounded query over explicit page IDs                     | New M14 scope field, no M13 migration required            | Not document scope; limits apply               |
| M14 layer summarize through `layerTargets`      | `m14-v1`                                           | Sanitized closed grouping buckets for explicit layers    | New M14 scope and operation fields                        | Closed grouping keys only                      |
| M14 multi-page count                            | `m14-v1`                                           | Sanitized aggregate counts over explicit page IDs        | New M14 capability                                        | No finding payload                             |
| M14 multi-layer query                           | `m14-v1`                                           | Bounded query over explicit page-qualified layer targets | New M14 capability                                        | Layers must be page-qualified                  |
| M14 page/layer combinations                     | `m14-v1`                                           | Bounded analysis over explicit mixed targets             | New M14 capability                                        | Same page cannot be both page and layer target |
| M14 document scope request                      | `m14-v1`                                           | Structured rejection before execution                    | Compatible by rejection, not by execution                 | `document-scope-not-supported`                 |
| M14 stale coverage requirement failure          | `m14-v1`                                           | Structured rejection or limited outcome with reason code | New M14 clarity over existing stale behavior              | Requires revision evidence                     |
| M14 scope too broad                             | `m14-v1`                                           | Structured rejection before expensive execution          | New M14 bounded-scope control                             | `scope-too-broad`                              |
| M14 plan with M14 fields                        | `m14-v1` only when M14 scope/query fields are used | Non-executable proposal output                           | M13 plan remains `m13-v1` for M13-compatible requests     | No execution or approval                       |
| M14 validate with M14 fields                    | `m14-v1` only when M14 scope/query fields are used | Read-only validation output                              | M13 validate remains `m13-v1` for M13-compatible requests | No mutation or rollback                        |
| Unknown field                                   | Schema error, not `m13-v1` or `m14-v1`             | Rejected before version activation                       | Preserves M13 by refusing misspelled or unsupported input | Unknown fields do not activate M14             |

## Compatibility Rule

The response version is selected from request shape, not server release version.
If a request can be interpreted entirely as M13, it remains `m13-v1`.
`count` and `summarize` are selected with `mode: "query"` and
`query.operation`. Unknown fields are rejected and do not select a response DTO
version.
