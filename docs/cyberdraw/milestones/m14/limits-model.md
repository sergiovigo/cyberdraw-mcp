# M14 Limits Model

## Status

IMPLEMENTED / CLOSED WITH OPEN REPORTING DECISIONS.

M14 implements configurable public bounds for pages, layers, findings,
proposals, expansion steps and execution time. Values below remain contract
guidance rather than portable client guarantees; exact numeric caps are server
configuration and may be tightened without changing the public DTO. The open
decision about always exposing `effectiveLimits` remains intentionally open.

| Limit               | Required configurable limit | Client request field       | Implemented contract guidance                                                                   | Absolute safety maximum                    | Effective limit in response | Remaining decision                                                               |
| ------------------- | --------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------- |
| Max pages           | Yes                         | `limits.maxPages`          | Requested page counts are bounded and may only narrow server caps                               | Required, value not fixed as contract text | Optional; do not assume     | Exact configured number remains deployment-specific                              |
| Max layers          | Yes                         | `limits.maxLayers`         | Requested layer counts are bounded and may only narrow server caps                              | Required, value not fixed as contract text | Optional; do not assume     | Exact configured number remains deployment-specific                              |
| Max findings        | Yes                         | `limits.maxFindings`       | Public findings and aggregate populations are bounded                                           | Required, value not fixed as contract text | Optional; do not assume     | Bucket-specific reporting can evolve without exposing raw findings               |
| Max proposals       | Yes                         | `limits.maxProposals`      | Public plan and validation proposals are capped and remain non-executable                       | Required, value not fixed as contract text | Optional; do not assume     | Exact configured number remains deployment-specific                              |
| Max expansion steps | Yes                         | `limits.maxExpansionSteps` | Expansion remains bounded by inherited hierarchical runtime controls                            | Required, value not fixed as contract text | Optional; do not assume     | Exact configured number remains deployment-specific                              |
| Max execution time  | Yes                         | `limits.maxExecutionTime`  | Runtime timeout is bounded by server-side execution controls                                    | Required, value not fixed as contract text | Optional; do not assume     | Timeout enforcement remains best-effort within the existing runtime architecture |

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

## Remaining Open Decisions

- Exact numeric defaults remain deployment configuration rather than contract
  constants.
- Whether M14 should expose effective limits in every `m14-v1` response remains
  open; clients must not require that field.
