# M13 Acceptance Matrix

## Status

COMPLETE / CLOSED.

| Criterion                               | Implementation                                                        | Automated test                                                   | Real validation                                               | Status |
| --------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------- | ------ |
| Tool visible in `tools/list`            | Registered as `cyberdraw_analyze_structure`                           | `lists exactly one public M13 tool through MCP tools/list`       | Real tool call was available after session refresh            | CLOSED |
| Invocation by public name               | Public MCP name is `cyberdraw_analyze_structure`                      | Unit and real-environment tests invoke the public name           | Codex invoked `cyberdraw_analyze_structure`                   | CLOSED |
| DTO `m13-v1`                            | Public mapper emits `version: "m13-v1"`                               | Real-environment assertions check `m13-v1`                       | Codex response included `version: "m13-v1"`                   | CLOSED |
| Zero mutation                           | Safety counters and mutation invariant guard                          | Unit tests assert zero and fail on nonzero mutation counter      | `mutationAttempted: false`; `mutationInvocations: 0`          | CLOSED |
| No document scope by default            | Default resolver uses active page/layer or page fallback              | Default-scope unit tests throw on default document scope         | `scope.inspected.document: false`; `documentScopeUsed: false` | CLOSED |
| Fail closed                             | Ambiguous defaults and unresolved active page are controlled failures | Unit tests cover missing active page and ambiguous documents     | Not triggered in final successful validation                  | CLOSED |
| Conclusive coverage for inspected scope | Public coverage maps scoped result                                    | Unit tests and real-environment tests inspect coverage           | `coverage.conclusive: true`                                   | CLOSED |
| Proposals not executable                | Plan mapper emits `executable: false`                                 | Unit and real-environment plan assertions                        | Not executed by final `analyze` validation                    | CLOSED |
| Revision compatibility                  | Public revision section exposes compatibility                         | Validation and real-environment assertions cover revision status | Not part of the final Codex validation field list             | CLOSED |
| Cleanup and UI preservation             | Real harness preserves and cleans UI state                            | `hierarchical-snapshot.test.ts` UI preservation coverage         | Not separately asserted by the final Codex validation         | CLOSED |
| Node 22.x                               | Server CI matrix includes `22.x`                                      | `.github/workflows/server-ci.yml`                                | Not applicable to a single Codex MCP invocation               | CLOSED |
| Node 24.x                               | Server CI matrix includes `24.x`                                      | `.github/workflows/server-ci.yml`                                | Not applicable to a single Codex MCP invocation               | CLOSED |
| Safe default visible layer              | Default resolver selects deterministic visible layer when available   | Unit tests cover default current page and visible layer          | Final scoped validation inspected layer `1`                   | CLOSED |
| Explicit page scope                     | Public schema accepts page scope                                      | Unit tests preserve explicit page scope                          | Not part of final default Codex call                          | CLOSED |
| Explicit layer scope                    | Public schema accepts page plus layer scope                           | Unit tests preserve explicit layer scope                         | Not part of final default Codex call                          | CLOSED |
| Multiple-document handling              | WebSocket connection replaces active document atomically              | `documents-changed-broadcast.test.ts`                            | Product defect fixed by PR #20 before closure                 | CLOSED |
| Limitations are explicit                | Public response carries closed limitation codes                       | Mapper and real-environment tests                                | `analysis-is-scoped-not-complete-document` observed           | CLOSED |

## Closure

All acceptance criteria required for M13 closure are satisfied by the merged PRs,
automated test coverage, CI workflow coverage and the final real Codex
validation.
