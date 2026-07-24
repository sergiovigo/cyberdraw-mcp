# CyberDraw MCP Documentation

This directory is the official documentation home for the CyberDraw MCP fork.
It is the starting point for developers and AI agents working on fork-specific
baseline, governance, security, architecture and future milestone planning.

CyberDraw MCP starts as a conservative fork of Draw.io MCP Server. The M0
documentation records inherited behavior and establishes a reproducible baseline
before CyberDraw-specific features are introduced.

## Document Map

| Document                                                                                                                     | Purpose                                                                                                          | Status                                   |
| ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| [README.md](README.md)                                                                                                       | Entry point, reading order and question map                                                                      | Official M0 index                        |
| [GOVERNANCE.md](GOVERNANCE.md)                                                                                               | Fork purpose, principles and policies                                                                            | Official fork policy                     |
| [BASELINE.md](BASELINE.md)                                                                                                   | M0 environment, commands, smoke tests and discrepancies                                                          | M0 baseline evidence                     |
| [ARCHITECTURE.md](ARCHITECTURE.md)                                                                                           | Inherited monorepo, runtime architecture and data flows                                                          | M0 architecture baseline                 |
| [TOOLS-INVENTORY.md](TOOLS-INVENTORY.md)                                                                                     | Inherited MCP tools, schemas, risks and coverage                                                                 | M0 inventory                             |
| [SECURITY-BASELINE.md](SECURITY-BASELINE.md)                                                                                 | Security surfaces, risks and prioritized recommendations                                                         | M0 security baseline                     |
| [UPSTREAM.md](UPSTREAM.md)                                                                                                   | Upstream remote, sync rules and known divergence                                                                 | M0 upstream policy                       |
| [M0-BACKLOG.md](M0-BACKLOG.md)                                                                                               | Follow-up work discovered during M0                                                                              | Open backlog                             |
| [AI-ONBOARDING.md](AI-ONBOARDING.md)                                                                                         | Practical guide for future AI agents                                                                             | Operational guide                        |
| [rfc/0001-internal-graph-model.md](rfc/0001-internal-graph-model.md)                                                         | Proposed internal graph model for architecture intelligence                                                      | Draft RFC                                |
| [spikes/0001-internal-graph-readonly.md](spikes/0001-internal-graph-readonly.md)                                             | M2 read-only prototype evidence for RFC 0001 Alternative C                                                       | Spike evidence                           |
| [spikes/0002-runtime-snapshot-handler.md](spikes/0002-runtime-snapshot-handler.md)                                           | M3 internal runtime snapshot handler spike evidence for ADR 0003 exit criteria                                   | Spike evidence                           |
| [milestones/M4-runtime-snapshot-product-hardening.md](milestones/M4-runtime-snapshot-product-hardening.md)                   | M4 internal hardening evidence for runtime snapshot negotiation, payload limits, revisions and stale-read policy | Internal milestone evidence              |
| [milestones/M5-scoped-snapshot-delivery.md](milestones/M5-scoped-snapshot-delivery.md)                                       | M5 internal scoped runtime snapshot delivery semantics for pages, layers and selection                           | Internal milestone evidence              |
| [milestones/M6-runtime-snapshot-benchmarks.md](milestones/M6-runtime-snapshot-benchmarks.md)                                 | M6 runtime snapshot benchmark evidence and M7 scaling recommendation                                             | Internal milestone evidence              |
| [milestones/M7-real-environment-snapshot-benchmarks.md](milestones/M7-real-environment-snapshot-benchmarks.md)               | M7 real draw.io browser benchmark evidence for scoped runtime snapshots                                          | Internal milestone evidence              |
| [milestones/M8-hierarchical-snapshot-planner.md](milestones/M8-hierarchical-snapshot-planner.md)                             | M8 internal hierarchical planner/executor evidence for scoped runtime snapshots                                  | Internal milestone evidence              |
| [milestones/M8.1-real-external-reference-expansion.md](milestones/M8.1-real-external-reference-expansion.md)                 | M8.1 real draw.io evidence for external-reference scope expansion                                                | Internal milestone evidence              |
| [milestones/M9-internal-structural-analysis.md](milestones/M9-internal-structural-analysis.md)                               | M9 private structural analysis vertical over scoped snapshots, merge and graph model                             | Internal milestone evidence              |
| [milestones/M10-internal-structural-queries.md](milestones/M10-internal-structural-queries.md)                               | M10 private deterministic query layer over already materialized M9 structural analysis results                   | Internal milestone evidence              |
| [milestones/M11-internal-structural-change-planning.md](milestones/M11-internal-structural-change-planning.md)               | M11 private deterministic proposal planning layer over M9 findings and M10 selections                            | Internal milestone evidence              |
| [milestones/M12-internal-change-plan-validation.md](milestones/M12-internal-change-plan-validation.md)                       | M12 private deterministic validation layer for M11 structural change plans                                       | Internal milestone evidence              |
| [milestones/M13-public-read-only-structural-analysis.md](milestones/M13-public-read-only-structural-analysis.md)             | M13 public read-only MCP tool over bounded M8-M12 structural analysis                                            | Public milestone evidence                |
| [milestones/m13/closure.md](milestones/m13/closure.md)                                                                       | Formal M13 closure record for public read-only structural analysis                                               | COMPLETE / CLOSED                        |
| [milestones/m13/capability-matrix.md](milestones/m13/capability-matrix.md)                                                   | M13 capability matrix for modes, scope, safety, limits and evidence                                              | Closure evidence                         |
| [milestones/m13/acceptance-matrix.md](milestones/m13/acceptance-matrix.md)                                                   | M13 acceptance criteria mapped to implementation, tests, CI and real validation                                  | Closure evidence                         |
| [milestones/m13/closure-incidents.md](milestones/m13/closure-incidents.md)                                                   | M13 closure incident register separating operational issues from product defects                                 | Closure evidence                         |
| [milestones/M14-public-structural-query-and-scope-controls.md](milestones/M14-public-structural-query-and-scope-controls.md) | M14 closed public query, count, summarize and bounded multi-scope controls                                       | COMPLETE / CLOSED                        |
| [milestones/m14/formal-closure-m14.md](milestones/m14/formal-closure-m14.md)                                                 | Formal M14 closure record for public structural query and scope controls                                         | COMPLETE / CLOSED                        |
| [milestones/m14/real-environment-validation-m14.4.md](milestones/m14/real-environment-validation-m14.4.md)                   | M14.4 real-environment validation evidence and HTTPS/Caddy harness limitation                                    | PASS WITH LIMITATIONS                    |
| [milestones/m14/contract-m14-v1.md](milestones/m14/contract-m14-v1.md)                                                       | Implemented m14-v1 public contract for bounded scope, coverage and sanitized query operations                    | Implemented contract                     |
| [milestones/m14/compatibility-matrix.md](milestones/m14/compatibility-matrix.md)                                             | Compatibility mapping between M13-compatible requests and M14-only capabilities                                  | Implemented matrix                       |
| [milestones/m14/limits-model.md](milestones/m14/limits-model.md)                                                             | Configurable limits for M14 public multi-scope operations                                                        | Implemented with open reporting decision |
| [milestones/m14/reason-code-registry.md](milestones/m14/reason-code-registry.md)                                             | Public reason-code registry for M14 structured rejections and limitations                                        | Implemented registry                     |
| [milestones/M15-prompt-to-diagram-mvp.md](milestones/M15-prompt-to-diagram-mvp.md)                                           | Prompt-to-diagram MVP using client-generated Mermaid and draw.io import                                          | M15.2 implemented                        |
| [benchmarks/](benchmarks/)                                                                                                   | Small aggregate M6 synthetic and M7 real-environment benchmark summaries                                         | Benchmark evidence                       |
| [diagrams/internal-graph-model.md](diagrams/internal-graph-model.md)                                                         | Mermaid diagrams supporting RFC 0001                                                                             | Draft supporting diagrams                |
| [adr/0001-fork-strategy.md](adr/0001-fork-strategy.md)                                                                       | Decision to begin as a conservative fork                                                                         | Accepted ADR                             |
| [adr/0002-runtime-and-baseline-policy.md](adr/0002-runtime-and-baseline-policy.md)                                           | Node, pnpm and audit baseline policy                                                                             | Accepted ADR                             |
| [adr/0003-internal-graph-model-architecture.md](adr/0003-internal-graph-model-architecture.md)                               | Decision to adopt RFC 0001 Alternative C as a private server-first internal graph package architecture           | Accepted ADR                             |
| [adr/0004-runtime-snapshot-scaling-strategy.md](adr/0004-runtime-snapshot-scaling-strategy.md)                               | Accepted runtime snapshot scaling strategy after M7 real-environment evidence                                    | Accepted ADR                             |
| [adr/0005-m13-safe-default-scope.md](adr/0005-m13-safe-default-scope.md)                                                     | M13 decision to default to active page/layer scope and never silently widen to document scope                    | Accepted ADR                             |
| [adr/0006-websocket-active-document-registry.md](adr/0006-websocket-active-document-registry.md)                             | Decision that each WebSocket connection owns exactly one active document at a time                               | Accepted ADR                             |
| [adr/0007-public-scope-coverage-and-dto-versioning-for-m14.md](adr/0007-public-scope-coverage-and-dto-versioning-for-m14.md) | Public scope, coverage and DTO versioning decision for M14                                                       | Accepted for M14 design                  |

Related root documents:

| Document                                               | Purpose                            | Status                           |
| ------------------------------------------------------ | ---------------------------------- | -------------------------------- |
| [FORK.md](../../FORK.md)                               | Short public summary of the fork   | M0 summary                       |
| [THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md) | Third-party notice tracking        | M0 partial inventory             |
| [AGENTS.md](../../AGENTS.md)                           | Repository-wide agent instructions | Inherited plus CyberDraw pointer |

## Recommended Reading Order

1. `README.md` for orientation.
2. `GOVERNANCE.md` for fork rules and policy boundaries.
3. `BASELINE.md` for reproducible setup and validation evidence.
4. `ARCHITECTURE.md` for system structure and runtime flows.
5. `TOOLS-INVENTORY.md` for the inherited MCP tool surface.
6. `SECURITY-BASELINE.md` for security assumptions and risks.
7. `UPSTREAM.md` before syncing from the original repository.
8. `M0-BACKLOG.md` before planning M1 or later work.
9. `AI-ONBOARDING.md` when an AI agent needs a concise operating guide.
10. `rfc/0001-internal-graph-model.md` for the draft Architecture Intelligence
    Foundation proposal.
11. `spikes/0001-internal-graph-readonly.md` for M2 prototype evidence.
12. `adr/0003-internal-graph-model-architecture.md` for the accepted package
    architecture and runtime-integration guardrails.
13. `spikes/0002-runtime-snapshot-handler.md` for M3 runtime snapshot handler
    evidence.
14. `milestones/M4-runtime-snapshot-product-hardening.md` for internal
    hardening decisions before productizing snapshots.
15. `milestones/M5-scoped-snapshot-delivery.md` for scoped snapshot semantics.
16. `milestones/M6-runtime-snapshot-benchmarks.md` for benchmark evidence and
    the M7 scaling recommendation.
17. `milestones/M7-real-environment-snapshot-benchmarks.md` for real browser
    evidence before changing snapshot limits or scaling strategy.
18. `milestones/M8-hierarchical-snapshot-planner.md` before using hierarchical
    scoped snapshots for internal analysis workflows.
19. `milestones/M8.1-real-external-reference-expansion.md` for the real
    external-reference expansion evidence that completes M8.
20. `milestones/M9-internal-structural-analysis.md` for private broken
    reference, cross-layer and orphan analysis semantics.
21. `milestones/M10-internal-structural-queries.md` for private structural
    finding queries over M9 results.
22. `milestones/M11-internal-structural-change-planning.md` for private
    non-mutating structural change proposals over M9/M10 results.
23. `milestones/M12-internal-change-plan-validation.md` for private validation
    of M11 plans before any future execution phase.
24. `milestones/M13-public-read-only-structural-analysis.md` for the first
    public read-only structural analysis MCP tool.
25. `milestones/m13/closure.md`, `milestones/m13/capability-matrix.md`,
    `milestones/m13/acceptance-matrix.md` and
    `milestones/m13/closure-incidents.md` for the formal M13 closure package.
26. `adr/0005-m13-safe-default-scope.md` and
    `adr/0006-websocket-active-document-registry.md` for M13 closure decisions.
27. `milestones/M14-public-structural-query-and-scope-controls.md` and
    `milestones/m14/formal-closure-m14.md` for the closed M14 public query and
    scope controls milestone.
28. `milestones/m14/real-environment-validation-m14.4.md` for real-environment
    M14 validation evidence and the HTTPS/Caddy harness limitation.
29. `milestones/m14/contract-m14-v1.md`,
    `milestones/m14/compatibility-matrix.md`,
    `milestones/m14/limits-model.md` and
    `milestones/m14/reason-code-registry.md` for the implemented M14 contract
    package.
30. `adr/0007-public-scope-coverage-and-dto-versioning-for-m14.md` for the M14
    public scope, coverage and DTO versioning decision.
31. `milestones/M15-prompt-to-diagram-mvp.md` for the planned
    prompt-to-diagram MVP design and Mermaid reuse decision.
32. `adr/` when a lasting decision needs historical context.

## Question Map

| Question                                                        | Read                                                                                                                                                      |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What is CyberDraw MCP and why does it exist?                    | `GOVERNANCE.md`, `adr/0001-fork-strategy.md`, `../../FORK.md`                                                                                             |
| How do I reproduce the M0 baseline?                             | `BASELINE.md`                                                                                                                                             |
| Which Node and pnpm versions are recommended?                   | `BASELINE.md`, `GOVERNANCE.md`                                                                                                                            |
| How is the monorepo organized?                                  | `ARCHITECTURE.md`, `AI-ONBOARDING.md`                                                                                                                     |
| How does an MCP tool call reach draw.io?                        | `ARCHITECTURE.md`                                                                                                                                         |
| Which MCP tools exist today?                                    | `TOOLS-INVENTORY.md`                                                                                                                                      |
| Which surfaces are security-sensitive?                          | `SECURITY-BASELINE.md`                                                                                                                                    |
| How should upstream syncs be handled?                           | `UPSTREAM.md`, `GOVERNANCE.md`                                                                                                                            |
| What work remains after M0?                                     | `M0-BACKLOG.md`                                                                                                                                           |
| What should another AI agent do first?                          | `AI-ONBOARDING.md`, `GOVERNANCE.md`                                                                                                                       |
| What is the proposed internal graph model?                      | `rfc/0001-internal-graph-model.md`, `diagrams/internal-graph-model.md`                                                                                    |
| What evidence exists for the read-only internal model spike?    | `spikes/0001-internal-graph-readonly.md`                                                                                                                  |
| What evidence exists for runtime snapshot extraction?           | `spikes/0002-runtime-snapshot-handler.md`                                                                                                                 |
| How is the runtime snapshot path hardened internally?           | `milestones/M4-runtime-snapshot-product-hardening.md`                                                                                                     |
| How do internal scoped runtime snapshots work?                  | `milestones/M5-scoped-snapshot-delivery.md`                                                                                                               |
| What benchmark evidence exists for snapshot scaling?            | `milestones/M6-runtime-snapshot-benchmarks.md`, `benchmarks/`, `adr/0004-runtime-snapshot-scaling-strategy.md`                                            |
| What real draw.io runtime evidence exists for scoped snapshots? | `milestones/M7-real-environment-snapshot-benchmarks.md`, `benchmarks/m7-real-summary.md`                                                                  |
| How does internal hierarchical snapshot planning work?          | `milestones/M8-hierarchical-snapshot-planner.md`, `milestones/M8.1-real-external-reference-expansion.md`, `adr/0004-runtime-snapshot-scaling-strategy.md` |
| How does internal structural analysis work?                     | `milestones/M9-internal-structural-analysis.md`, `rfc/0001-internal-graph-model.md`, `adr/0003-internal-graph-model-architecture.md`                      |
| How are structural findings queried internally?                 | `milestones/M10-internal-structural-queries.md`, `milestones/M9-internal-structural-analysis.md`                                                          |
| How are internal structural change proposals planned?           | `milestones/M11-internal-structural-change-planning.md`, `milestones/M10-internal-structural-queries.md`, `milestones/M9-internal-structural-analysis.md` |
| How are internal structural change plans validated?             | `milestones/M12-internal-change-plan-validation.md`, `milestones/M11-internal-structural-change-planning.md`                                              |
| What public read-only structural analysis tool exists?          | `milestones/M13-public-read-only-structural-analysis.md`, `../../TOOLS.md`                                                                                |
| Is M13 formally closed?                                         | `milestones/m13/closure.md`, `milestones/m13/acceptance-matrix.md`                                                                                        |
| What M13 capabilities and limits are public?                    | `milestones/m13/capability-matrix.md`, `milestones/M13-public-read-only-structural-analysis.md`                                                           |
| Which M13 validation incidents were found?                      | `milestones/m13/closure-incidents.md`                                                                                                                     |
| Why does M13 not analyze document scope by default?             | `adr/0005-m13-safe-default-scope.md`                                                                                                                      |
| How is the active document tracked per WebSocket connection?    | `adr/0006-websocket-active-document-registry.md`                                                                                                          |
| Is M14 formally closed?                                         | `milestones/m14/formal-closure-m14.md`, `milestones/M14-public-structural-query-and-scope-controls.md`                                                    |
| What is the implemented m14-v1 contract?                        | `milestones/m14/contract-m14-v1.md`, `adr/0007-public-scope-coverage-and-dto-versioning-for-m14.md`                                                       |
| How do M13 and M14 responses stay compatible?                   | `milestones/m14/compatibility-matrix.md`                                                                                                                  |
| Which limits and reason codes are implemented for M14?          | `milestones/m14/limits-model.md`, `milestones/m14/reason-code-registry.md`                                                                                |
| What internal graph model architecture was accepted?            | `adr/0003-internal-graph-model-architecture.md`                                                                                                           |
| Where are lasting decisions recorded?                           | `adr/`                                                                                                                                                    |
| What third-party assets need review?                            | `../../THIRD_PARTY_NOTICES.md`                                                                                                                            |

## Status Model

- Official: accepted fork policy or entry point.
- Baseline: factual M0 evidence about inherited behavior.
- Open backlog: unresolved follow-up work that must be planned separately.
- Operational guide: practical instructions that summarize official documents.
- Draft RFC: proposal under review; not accepted architecture or implementation.
- Spike evidence: prototype findings for review; not accepted product behavior.
- ADR accepted: durable decision record.

M0 documentation is authoritative for the baseline state. Future milestones must
update these files when changing behavior, architecture, security assumptions,
dependencies, release process or upstream strategy.
