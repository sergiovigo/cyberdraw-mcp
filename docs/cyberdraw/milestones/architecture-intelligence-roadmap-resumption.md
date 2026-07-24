# Architecture Intelligence Roadmap Resumption

## Status

SUPERSEDED BY M16 CLOSURE.

This document resumes the CyberDraw Architecture Intelligence roadmap after the
closed M15 prompt-to-diagram MVP. It does not implement runtime behavior, add MCP
tools, change public contracts or reopen M13, M14 or M15.

The recommendation in this document was accepted as M16. M16 is closed by
`docs/cyberdraw/milestones/m16/formal-closure-m16.md` with PASS WITH
LIMITATIONS.

Post-M16 roadmap note: M17 is now closed by
`docs/cyberdraw/milestones/m17/formal-closure-m17.md` with PASS WITH
LIMITATIONS. ADR 0008 accepts a scoped internal identity policy only. Semantic
diff, persistence, mutation execution, approval, rollback, transactions, public
graph identity and incremental analysis remain after identity and are not
numbered here.

## Context

M15 was a deliberately narrow product detour: it delivered a demonstrable
prompt-to-diagram path by letting an MCP client or agent generate constrained
Mermaid and calling `cyberdraw_create_diagram`, a small public wrapper over the
existing draw.io Mermaid import path. M15 is COMPLETE / CLOSED with PASS WITH
LIMITATIONS because its real-environment evidence is HTTP-local, not
HTTPS/Caddy.

The M15 closure document explicitly states that after M15.3 closes, work should
return to CyberDraw's broader architecture intelligence roadmap instead of
expanding prompt-to-diagram into a general generation platform.

The original Architecture Intelligence line is still anchored in RFC 0001, ADR
0003, ADR 0004 and the M0 backlog item `M0-P1-005`. The backlog records a
suggested milestone named "Architecture Intelligence Foundation runtime
integration hardening and compatibility evidence". M3-M14 covered many parts of
that risk, but the repository still lacks one formal milestone that consolidates
runtime compatibility evidence across the architecture intelligence foundation
and closes or explicitly defers the remaining acceptance questions.

## Authoritative Evidence

- `docs/cyberdraw/M0-BACKLOG.md:75-86` defines `M0-P1-005: Review Architecture
  Intelligence Foundation RFC` and asks to review open decisions, validate the
  package/server-first direction and decide whether an implementation ADR is
  warranted.
- `docs/cyberdraw/M0-BACKLOG.md:87-96` records the M2 update and ADR 0003
  resolution: Alternative C is accepted, but identity, `CanonicalDiagramInput`,
  JSON Schema, persisted findings, change plans, semantic diff, WebSocket
  integration and new MCP tools are not stabilized.
- `docs/cyberdraw/M0-BACKLOG.md:97-161` records the M3-M13 progression from
  runtime snapshots through public read-only structural analysis.
- `docs/cyberdraw/M0-BACKLOG.md:163-164` names the suggested milestone:
  "Architecture Intelligence Foundation runtime integration hardening and
  compatibility evidence".
- `docs/cyberdraw/AI-ONBOARDING.md:25-28` says to read `M0-BACKLOG.md`, RFC
  0001 and ADR 0003 before planning the next milestone.
- `docs/cyberdraw/GOVERNANCE.md:158-172` requires future milestones to state
  inherited behavior changes, update relevant docs, add ADRs for lasting
  decisions, keep upstream sync separate, validate proportionally and distinguish
  proposed designs from current behavior.
- `docs/cyberdraw/ARCHITECTURE.md:370-386` marks future architecture as planning
  context and requires dedicated milestones plus ADRs for future architecture
  changes.
- `docs/cyberdraw/rfc/0001-internal-graph-model.md:187-192` recommends
  Alternative C as the future implementation direction, while saying the RFC is
  not a stable product contract.
- `docs/cyberdraw/rfc/0001-internal-graph-model.md:658-676` lists initial
  internal model operations as library/service operations and says future public
  MCP wrappers require separate schemas.
- `docs/cyberdraw/adr/0003-internal-graph-model-architecture.md:79-106` accepts
  the private source-neutral graph-model package and server-first adoption, while
  adding no public MCP tools or transport changes.
- `docs/cyberdraw/adr/0003-internal-graph-model-architecture.md:305-318`
  defines runtime integration evidence expected for the next phase.
- `docs/cyberdraw/adr/0004-runtime-snapshot-scaling-strategy.md:67-80` accepts
  the scope-first hierarchical snapshot strategy and keeps chunking, streaming,
  persistence and incremental analysis out of scope.
- `docs/cyberdraw/milestones/M15-prompt-to-diagram-mvp.md:697-710` keeps
  non-flowchart Mermaid and prompt-to-diagram expansion deferred and directs work
  back to the architecture intelligence roadmap.

## Current Foundation

| Capability | Introduced in | Current status | Public/private | Real-environment evidence | Known limitations | Deferred work |
| --- | --- | --- | --- | --- | --- | --- |
| Internal graph model | M2 spike, ADR 0003 | Implemented as private package architecture | Private | Synthetic and fixture package tests | Package API remains internal; stable identity not accepted | Stable external schema, public compatibility surface |
| Runtime snapshots | M3 spike, M4 hardening | Private versioned runtime snapshot path | Private | M3-M5 real-environment tests | Cross-version breadth remains limited | Public WebSocket/API stability |
| Scoped snapshots | M5 | Implemented for document, pages, layers and selection | Private | M5 real-environment path plus later M7/M8 evidence | No public schema; older peers retain document-only compatibility | Broader compatibility matrix |
| Revision and stale semantics | M3-M5, M8-M14 | Implemented as scoped evidence and public reporting where exposed | Private plus M13/M14 public summaries | Real-environment stale/read tests exist for focused paths | Semantics are scoped, not complete-document guarantees | Broader compatibility and failure-mode evidence |
| Hierarchical planner | M8 | Complete internal planner/executor | Private | Focused real-environment tests | No chunking, streaming, persistence or stable identity | Compatibility regression matrix |
| External-reference expansion | M8.1 | Complete focused real expansion evidence | Private | Real draw.io layer-scope expansion | Small functional evidence, not full benchmark matrix | Broader cross-page/cross-version evidence |
| Structural analysis | M9 | Complete private analysis vertical | Private | Real fixture covers broken reference, cross-layer edge and orphan categories | Conservative coverage/completeness semantics | More rule packs and profiles |
| Structural queries | M10 | Complete private deterministic query layer | Private | Reuses M9 real fixture evidence | No public query language beyond later M14 DTO | Future query extensions require contract design |
| Change planning | M11 | Complete private non-mutating proposal planner | Private | Reuses real fixture evidence | Proposals are abstract and non-executable | Execution, approval, rollback, mutation |
| Change-plan validation | M12 | Complete private validator | Private | Real-environment M12 evidence | Does not apply plans | Execution path, persistence, approval |
| Public structural analysis | M13 | Complete closed public read-only tool | Public `m13-v1` | Real MCP invocation and automated evidence | Scoped analysis can be misread as complete-document coverage | Mutation-capable milestones need separate design |
| Public structural query/scope controls | M14 | Complete closed M14 contract | Public `m14-v1` | HTTP real-environment evidence with HTTPS/Caddy limitation | `effectiveLimits` remains non-mandatory; no document-scope execution | Future public changes require ADR/contract |
| Runtime compatibility | M3-M8.1 evidence | Partially proven for supported focused paths | Internal | HTTP/WebSocket draw.io evidence, M7 benchmarks | Second runtime/version breadth and HTTPS/Caddy remain limited | Consolidated compatibility evidence |
| Protocol compatibility | M4-M5, M13-M14 | Capability negotiation and public DTO compatibility exist | Private plus public DTOs | Unit and real-environment focused evidence | No single architecture-intelligence compatibility matrix | M16 compatibility matrix |
| Stable identity | M2/ADR 0003 | Not accepted | Internal only | Deterministic provisional IDs under same normalized input | Not stable across moves, clones or imports | Separate design milestone if needed |
| Persistence | RFC 0001 only | Not implemented, not accepted | None | None | Privacy/security policy absent | Explicit future milestone only |
| Semantic diff | RFC 0001 only | Not implemented, not accepted | None | None | Requires stable identity and policy | Explicit future milestone only |
| Mutation execution | M11/M12 intentionally non-executable; M15 separate import wrapper | Not part of architecture-intelligence public structural path | M15 write tool exists for Mermaid import only | M15 HTTP-local demo | No plan execution path | Separate accepted design only |
| Rollback | Repeatedly out of scope | Not implemented | None | None | No transaction model | Separate accepted design only |

## Remaining Gaps

### A. Required For Architecture Intelligence Foundation Maturity

- A single consolidated compatibility matrix for the internal architecture
  intelligence runtime path does not exist.
- Runtime integration evidence is spread across M3-M14 and is not audited as one
  foundation with explicit "already proven", "needs regression evidence" and
  "unproven" states.
- ADR 0003's next-phase evidence has been partially satisfied by M3-M8.1, but
  the repository has not recorded a formal closure decision for that suggested
  milestone.

### B. Compatibility And Hardening

- Cross-version draw.io runtime breadth remains limited in the historical M3-M8
  documents.
- HTTPS/Caddy remains a repeated harness limitation in M7, M14 and M15 evidence.
- Older peer and missing-capability behavior exists in targeted docs, but is not
  consolidated for architecture intelligence as a foundation-level matrix.
- Timeout/error classification, malformed/oversize payload behavior and stale
  revision behavior should be regression-proven without expanding public APIs.

### C. Deferred Architectural Capabilities

- Stable identity between snapshots.
- Public JSON Schema or stable graph-model API.
- Persistence of findings, reviews or sidecars.
- Semantic diff.
- Change-plan execution.
- Rollback, transactions and approval workflows.
- Chunking, streaming and incremental analysis.
- Domain-specific profiles and arbitrary policy/rule languages.

### D. Explicit Non-Goals / Future Work

The next milestone should not implement persistence, semantic diff, mutation
execution, rollback, arbitrary policy language, stable global identity, new
public mutation APIs, AI/LLM generation or prompt-to-diagram extensions.

### E. Tech Debt Unrelated To The Next Milestone

- Third-party notice/provenance backlog items.
- Optional deployment authentication profiles.
- Generic upstream compatibility process cleanups.
- Prompt-to-diagram non-flowchart expansion.

## Analysis Of The Suggested Milestone

Original suggested milestone:

> Architecture Intelligence Foundation runtime integration hardening and
> compatibility evidence

Meaning today:

- "Architecture Intelligence Foundation" is no longer hypothetical: M2-M14
  delivered the private graph model, runtime snapshots, hierarchical execution,
  structural analysis, queries, planning, validation and public read-only
  wrappers.
- "Runtime integration" is partly implemented: M3-M8.1 built the private runtime
  snapshot path and real evidence; M13/M14 exposed bounded read-only behavior.
- "Hardening and compatibility evidence" remains coherent because the evidence
  is distributed and gaps such as cross-version breadth, HTTPS/Caddy harness
  limits, older-peer behavior and failure classification still need a single
  foundation-level closure.

Recommended shape:

- A bounded hardening and evidence milestone.
- Mostly tests, compatibility matrix, documentation and minimal fixes for
  demonstrated runtime defects.
- No new public tool, no new DTO version, no mutation executor and no semantic
  diff.

## Candidate Next Milestones

| Option | Name | Objective | Scope | Non-goals | Evidence | Complexity | Value |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A | Architecture Intelligence Runtime Integration Hardening | Consolidate and harden the existing runtime integration evidence for M2-M14 | Compatibility matrix, regression tests, real-environment evidence, minimal fixes for proven defects | New APIs, stable identity, persistence, semantic diff, mutation execution | Unit, integration and HTTP-local real draw.io evidence | Medium | Closes the explicit M0 suggested milestone risk |
| B | Architecture Intelligence Compatibility Audit | Produce only documentation and a compatibility matrix | No runtime changes unless future milestone accepts them | Any implementation | Documentation review and existing evidence only | Small | Fast, but may leave known runtime gaps unresolved |
| C | Stable Identity Design | Design stable identity across snapshots | Identity strategy and ADR proposal | Runtime hardening, public schemas, persistence, mutation | Design evidence only | Medium | Important later, but ADR 0003 warns it is not yet proven and it would skip the explicit runtime-hardening gap |

## Recommended Next Milestone

Recommend Option A as:

M16 - Architecture Intelligence Runtime Integration Hardening

This should be M16 because:

- The repository has no current M16 definition.
- M15 explicitly says to return to the architecture intelligence roadmap.
- The M0 backlog already names the next coherent milestone as runtime
  integration hardening and compatibility evidence.
- M3-M14 provide enough implementation foundation to make this an evidence and
  hardening milestone rather than another discovery-only document.
- The milestone can remain narrow and avoid API expansion.

## Proposed Scope

- Create a foundation-level compatibility matrix for the architecture
  intelligence runtime path.
- Re-run and extend regression evidence for existing runtime snapshot,
  hierarchical planner, structural analysis, query, planning, validation and
  public read-only wrappers.
- Verify plugin/server contract versions, older-peer behavior, missing
  capability behavior and unsupported runtime behavior where harness support
  exists.
- Verify stale revision behavior, visible/background page behavior,
  document/page/layer/selection scopes, external-reference expansion,
  malformed/oversize payloads and timeout/error classification.
- Add minimal implementation fixes only for defects reproducibly found during
  M16 validation.
- Record residual limitations honestly, especially HTTPS/Caddy or
  cross-version/runtime coverage that cannot be proven in the local harness.

## Explicit Non-Goals

- No new MCP tools.
- No public contract changes.
- No new `m13-v1`, `m14-v1` or `m15-v1` semantics.
- No persistence.
- No semantic diff.
- No mutation executor.
- No rollback, transactions or approval workflows.
- No arbitrary policy language.
- No stable global identity implementation.
- No prompt-to-diagram extensions.
- No LLM/provider integration.
- No chunking, streaming or incremental analysis unless a separate ADR accepts
  it first.

## Required Evidence

| Area | Already proven | Needs regression evidence | Still unproven | Out of scope |
| --- | --- | --- | --- | --- |
| Plugin/server contract versions | M4/M5 private contract docs | Matrix across current server/plugin paths | Broad unsupported peer matrix | Public WebSocket stability claims |
| Older peer compatibility | M5 document-only compatibility notes | Regression for missing scoped capability behavior | Old draw.io runtime fleet breadth | Rewriting old peers |
| Missing capability behavior | M4/M5 capability negotiation | Fail-closed behavior in runtime tests | Full compatibility lab | New fallback semantics |
| Unsupported version behavior | Version compatibility architecture exists | Explicit expected rejection/error classification | Exhaustive draw.io version matrix | Supporting new runtimes |
| Stale revision behavior | M4/M5/M8/M13/M14 scoped stale evidence | End-to-end regression across public/private paths | Complete-document freshness guarantees | Stable global identity |
| Document/page/layer/selection scopes | M5/M7/M8 evidence | Foundation matrix and regression | Chunked element scopes | Public document-scope execution |
| Visible/background pages | M3/M7/M8 evidence | Regression and documented limits | HTTPS/Caddy broad proof | New page discovery semantics |
| External references | M8.1 real evidence | Regression plus unsupported-reference classification | Arbitrary multi-hop/cross-document expansion guarantees | Complete graph crawl |
| Malformed/oversize payloads | M4/M5/M7 evidence | Error classification and no-leakage regression | Full fuzzing campaign | Raising limits |
| Timeout/error classification | Scattered runtime tests | Consolidated expected outcomes | SLA guarantees | Retry policies |
| Real draw.io browser evidence | M7/M8.1/M13/M14/M15 HTTP-local | M16 focused HTTP-local matrix | HTTPS/Caddy unless harness is fixed | Claiming HTTPS closure without evidence |

## Acceptance Criteria

- M16 has a written compatibility matrix distinguishing already proven, needs
  regression evidence, still unproven and out-of-scope behavior.
- Existing public contracts remain unchanged.
- No new MCP tool is added.
- Runtime snapshot, hierarchical planner, structural analysis, query, planning,
  validation, M13 and M14 tests remain green.
- Focused real-environment evidence covers current draw.io HTTP-local runtime
  behavior for visible/background pages, scoped snapshots and external-reference
  expansion.
- Older peer or missing-capability behavior is tested or explicitly recorded as
  unsupported with fail-closed behavior.
- Malformed, oversized, stale, timeout and unsupported cases produce
  deterministic sanitized outcomes.
- Any implementation change is limited to reproducible defects found during the
  milestone and is covered by tests.
- Remaining HTTPS/Caddy or cross-version limitations are documented without
  being converted into PASS claims.

## Risks

- Evidence may remain harness-limited if HTTPS/Caddy or multiple draw.io runtime
  versions cannot run locally.
- Consolidation work can grow into broad compatibility infrastructure unless
  scoped to the current supported runtime path.
- Stable identity and semantic diff are attractive follow-ups but would expand
  M16 beyond the documented risk.
- Public users may expect M16 to add capabilities; the milestone must be framed
  as hardening and compatibility evidence.

## Dependencies

- Closed M13 and M14 public read-only contracts.
- Closed M15 prompt-to-diagram MVP, without extending it.
- ADR 0003 internal graph model architecture.
- ADR 0004 scope-first hierarchical snapshot scaling strategy.
- Existing drawio-mcp-server real-environment harness.
- Existing plugin/server compatibility matrix and runtime snapshot code.

## Decision

Yes, the next milestone should be formalized as M16.

Recommended title:

M16 - Architecture Intelligence Runtime Integration Hardening

M16 should be a bounded hardening and evidence milestone. It should not implement
stable identity, persistence, semantic diff, mutation execution, rollback or new
public APIs. Its main value is to close the documented Architecture Intelligence
Foundation runtime integration risk with consolidated compatibility evidence and
minimal defect fixes only when demonstrated.

## Post-M16 Continuation

M16 closed the runtime integration hardening risk. The next roadmap proposal is:

M17 - Architecture Intelligence Stable Identity Foundation

M17 closed as PASS WITH LIMITATIONS. It defines and evidences a scoped internal
identity policy for correlating graph entities between snapshots within
explicit limits. It did not implement semantic diff, persistence, mutation
execution, approval, rollback, transactions, public graph identity, public graph
schema, public MCP tools or incremental analysis. Those domains remain future
work after the scoped identity foundation.
