# M14 Limits Model

## Status

PLANNED / DESIGN.

M14 requires configurable limits. Values below are proposed initial design
values only when existing M13 evidence gives a safe reference point. They are
not implementation constants until validated by tests and real-environment
evidence.

| Limit               | Required configurable limit | Client request field       | Proposed initial value                                                                          | Absolute safety maximum                                        | Effective limit in response     | Open decision                                                                 |
| ------------------- | --------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------- |
| Max pages           | Yes                         | `limits.maxPages`          | Same order as M13 `expansion.maxScopes` default when pages are the requested unit               | Required, value not fixed until implementation evidence exists | Open; do not assume in examples | Exact number must be chosen during implementation after real fixture evidence |
| Max layers          | Yes                         | `limits.maxLayers`         | Same order as M13 `expansion.maxScopes` default when layers are the requested unit              | Required, value not fixed until implementation evidence exists | Open; do not assume in examples | Exact number must account for page/layer combinations                         |
| Max findings        | Yes                         | `limits.maxFindings`       | Reuse M13 public findings cap unless M14 evidence justifies a lower cap for multi-scope queries | Required, value not fixed until implementation evidence exists | Open; do not assume in examples | Decide whether `count` and `summarize` need separate bucket caps              |
| Max proposals       | Yes                         | `limits.maxProposals`      | Reuse M13 public proposals cap for plan/validate                                                | Required, value not fixed until implementation evidence exists | Open; do not assume in examples | Decide whether M14 multi-scope plans should use a lower initial cap           |
| Max expansion steps | Yes                         | `limits.maxExpansionSteps` | Reuse M13 expansion defaults for depth/scopes as the initial ceiling                            | Required, value not fixed until implementation evidence exists | Open; do not assume in examples | Decide whether explicit multi-scope requests should reduce expansion depth    |
| Max execution time  | Yes                         | `limits.maxExecutionTime`  | Reuse M13 timeout as an upper bound                                                             | Required, value not fixed until implementation evidence exists | Open; do not assume in examples | Decide whether M14 aggregate operations need a shorter timeout                |

## Required Behaviors

- Exceeding a limit must return a structured reason code.
- The server must not silently increase limits.
- The server must not broaden scope to satisfy a request.
- Rejections must occur before expensive execution when the request shape alone
  is over the configured limit.
- Runtime limit hits must preserve read-only safety counters.
- Client-requested limits may only narrow effective limits, never raise them
  above server configuration.
- If `effectiveLimits` is added to `m14-v1`, it must report sanitized numeric
  caps only. This remains an open design decision and is not required by the
  examples.

## Open Decisions

- Exact numeric defaults for pages and layers.
- Whether pages and layers share one combined target count or separate caps.
- Whether `count` may inspect more findings internally than `query` returns.
- Whether `summarize` needs a lower grouping bucket cap than M10 internal
  defaults.
- Whether M14 should expose effective limits in every `m14-v1` response.
