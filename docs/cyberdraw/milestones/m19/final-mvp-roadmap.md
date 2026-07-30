# M19 Final MVP Roadmap

Status: PROPOSED.

M19 recommends the next two milestones needed to convert the current technical
MVP into a release-ready MVP. This document does not start or close those
milestones.

## Recommended Sequence

```text
M19 - Product definition and release-readiness assessment
  -> M20 - Packaging, Licensing And Reproducible Installation
  -> M21 - Final MVP Product Acceptance And Closure
```

## M20 - Packaging, Licensing And Reproducible Installation

### Objective

Make the CyberDraw MVP installable, auditable and packageable from a clean
environment without changing the MVP functional contract.

### Scope

- release artifact strategy;
- npm package/version decision for the server;
- extension package artifact decision;
- verified third-party license inventory;
- `THIRD_PARTY_NOTICES.md` completion for distributable artifacts;
- draw.io asset provenance and pinning decision;
- reproducible clean installation commands;
- version reporting and release metadata;
- release notes template;
- upgrade guidance;
- uninstall and cleanup guidance;
- packaging CI only if required to make the artifact reproducible.

### Non-Goals

- no new MCP tools;
- no public semantic diff;
- no Architecture Intelligence mutation execution;
- no persistence;
- no auth implementation;
- no new deployment product surface beyond documentation and packaging
  decisions.

### Acceptance Criteria

- official install command documented and tested from a clean environment;
- package manager and Node requirements are explicit;
- third-party notices are complete enough for selected artifacts;
- draw.io asset version/provenance is pinned or recorded per release;
- generated release artifacts are reproducible or the remaining nondeterminism
  is documented;
- production dependency audit status is recorded;
- dev/test advisory status is visible and separately classified;
- upgrade and uninstall/cleanup guidance exists;
- no functional public contract changes occur.

### Risks

- draw.io asset licensing/provenance may require more work than expected;
- extension store packaging may need separate review from server packaging;
- dependency audit tooling may continue to report dev/test transitive advisories
  with no compatible upstream remediation;
- release artifact contents may include generated bundles requiring additional
  notice review.

## M21 - Final MVP Product Acceptance And Closure

### Objective

Run final product acceptance for the official MVP profile and close the MVP
honestly as ready or not ready for the selected distribution audience.

### Scope

- clean-machine acceptance on Node 22 and Node 24;
- official Codex stdio setup;
- built-in editor launch;
- visible diagram creation with `cyberdraw_create_diagram`;
- post-create public structural analysis/query;
- multi-page scenario;
- multi-document routing/fail-closed scenario;
- controlled failure with sanitized output;
- restart/recovery acceptance;
- final compatibility matrix;
- final known limitations;
- final MVP closure verdict.

### Non-Goals

- no public semantic diff;
- no incremental analysis implementation;
- no persistence;
- no mutation executor;
- no approval workflow;
- no rollback or transactions;
- no server-side LLM/provider integration;
- no public beta claim without evidence.

### Acceptance Criteria

- clean install succeeds with the official command;
- Codex stdio configuration works from documented instructions;
- the editor starts on loopback;
- the official create-diagram flow creates a visible draw.io page;
- the created diagram can be inspected with public read-only analysis;
- controlled bad input returns sanitized reason codes;
- restart/recovery flow can repeat creation and inspection;
- final Node 22/24 status is recorded;
- final product compatibility matrix is complete;
- final release-readiness decision is one of:
  - INTERNAL MVP READY;
  - EXTERNAL MVP READY WITH LIMITATIONS;
  - EXTERNAL MVP NOT READY;
  - PUBLIC BETA READY;
  - PUBLIC BETA NOT READY.

## Future Work After MVP

M19 does not number or authorize these capabilities. They remain candidates for
separate roadmap decisions:

- internal incremental analysis;
- changed-region analysis;
- internal cache invalidation;
- public semantic diff design;
- persistence or review sessions;
- Architecture Intelligence mutation execution;
- approval workflows;
- rollback and transactions;
- authenticated remote deployment;
- broader real draw.io/browser compatibility matrix;
- desktop integration if upstream CSP permits it.

## Guardrails For M20/M21

- Do not reinterpret internal M17/M18 foundations as public product features.
- Do not claim complete-document behavior without coverage evidence.
- Do not claim external deployment readiness without auth/proxy/TLS evidence.
- Do not turn client-generated Mermaid into server-side prompt interpretation.
- Do not require LLM provider keys for the MVP.
- Do not hide license, provenance or dependency-audit limitations.
