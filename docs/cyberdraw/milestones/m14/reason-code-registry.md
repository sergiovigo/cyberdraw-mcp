# M14 Reason-Code Registry

## Status

PLANNED / DESIGN.

M14 reason codes are stable public strings for structured rejections,
limitations and diagnostics. They must not include labels, XML, paths,
hostnames, stack traces or environment values.

| Code                           | Exact condition                                                                        | Category       | Effect                         | Retry path                                | Related fields                          | Future compatibility                                       |
| ------------------------------ | -------------------------------------------------------------------------------------- | -------------- | ------------------------------ | ----------------------------------------- | --------------------------------------- | ---------------------------------------------------------- |
| `scope-too-broad`              | Requested bounded scope exceeds configured page, layer or combined scope limits        | Rejection      | No execution when detectable   | Retry with narrower `scope` or `limits`   | `scope`, `limits`                       | Stable; thresholds may change by configuration             |
| `document-scope-not-supported` | Request asked for public document scope, which M14 does not execute                    | Rejection      | No execution                   | Retry with page or layer scope            | `scope.document`                        | Stable until a future ADR explicitly allows document scope |
| `active-page-unavailable`      | Default scope could not resolve an unequivocal active page                             | Rejection      | No execution                   | Retry after selecting a page or use scope | omitted `scope`                         | Stable from ADR 0005                                       |
| `page-not-found`               | Explicit page ID could not be resolved                                                 | Rejection      | No execution for that request  | Retry with a valid page ID                | `scope.pageIds`, inherited page scope   | Stable                                                     |
| `layer-not-found`              | Explicit layer ID could not be resolved on its page                                    | Rejection      | No execution for that request  | Retry with a valid page-qualified layer   | `scope.layerTargets`                    | Stable                                                     |
| `ambiguous-document`           | No `target_document` was supplied and multiple active documents are available          | Rejection      | No execution                   | Retry with `target_document`              | `target_document`                       | Stable from ADR 0006                                       |
| `stale-coverage`               | Freshness evidence fails `coverageRequirements.minimum: "nonStale"`                    | Rejection      | No stale result unless allowed | Retry after refreshing snapshot evidence  | `coverageRequirements`, `revision`      | Stable; freshness mechanism may evolve                     |
| `incomplete-target-scope`      | Executed scope does not satisfy `completeTargetScopes` for every normalized target     | Limitation     | Limited or rejected outcome    | Retry with narrower target scope          | `coverageRequirements`, `executedScope` | Stable                                                     |
| `expansion-limit-reached`      | Expansion stopped at configured scope, depth, byte or step limits                      | Partial result | Limited outcome                | Retry with lower expansion or scope       | `expansion`, `limits`                   | Stable                                                     |
| `result-limit-reached`         | Public result list, grouping bucket count or response size was capped                  | Partial result | Limited outcome                | Retry with narrower query or lower scope  | `query.limit`, `response`, `limits`     | Stable                                                     |
| `revision-incompatible`        | Revision evidence is missing, mismatched or incompatible with validation requirements  | Rejection      | Limited or rejected outcome    | Retry after refresh or compatible request | `revision`, `coverageRequirements`      | Stable                                                     |
| `unsupported-query-operation`  | Request used an unsupported operation, grouping or query shape                         | Rejection      | No execution                   | Retry with `list`, `count` or `summarize` | `query.operation`, `query.groupBy`      | Stable; new operations require contract update             |
| `duplicate-scope-target`       | A target is expressed in conflicting scope forms, such as page plus layer on that page | Rejection      | No execution                   | Retry with one scope form for that page   | `scope.pageIds`, `scope.layerTargets`   | Stable                                                     |
| `empty-scope`                  | Explicit scope contains no resolvable target after validation and normalization        | Rejection      | No execution                   | Retry with at least one page or layer     | `scope.pageIds`, `scope.layerTargets`   | Stable                                                     |

## Registry Rules

- Codes are lowercase kebab-case.
- Codes are public compatibility surface once implemented.
- A code may appear in `limitations` or sanitized diagnostics.
- A code must be added here before being exposed publicly.
- Codes must describe structural state or request handling, not internal stack
  details.
