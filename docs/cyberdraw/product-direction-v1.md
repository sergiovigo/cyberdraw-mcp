# CyberDraw Product Direction v1

## Status

DRAFT / POST-MVP DECISION INPUT.

## Purpose

CyberDraw has closed its internal MVP as accepted with limitations. The next
strategic decision is not whether the current product can work; M21 already
proved that. The decision is what kind of product CyberDraw should become after
supported local installation is stabilized.

This document keeps that decision separate from M22. M22 should make local
installation and operations repeatable. Product Direction v1 should then choose
the next product lane using real installation feedback.

## Current Product Fact Base

Accepted MVP:

- local-first;
- stdio MCP server;
- `drawio-mcp-server --editor`;
- loopback built-in draw.io editor;
- visible diagram creation through `cyberdraw_create_diagram`;
- public read-only inspection and `cyberdraw_analyze_structure`;
- no public semantic diff;
- no persistence;
- no global identity;
- no mutation executor;
- no approval workflow;
- no rollback or transactions.

Validated by M21:

- self-contained package artifact;
- clean install outside the monorepo;
- cold-cache and warm-cache editor startup;
- MCP handshake;
- 30 public tools discovered;
- five-node/four-edge visible diagram creation;
- read-only structural analysis;
- controlled negative cases;
- cleanup of the temporary acceptance environment.

Post-M21 real installation feedback adds:

- portability to a separate MacBook Pro is plausible and observed;
- installer UX needs to distinguish valid self-contained artifacts from ordinary
  workspace tarballs;
- Codex configuration remains a supported-operations gap;
- host/profile selection needs safer product language;
- diagnostics need to be automated before broader use.

## Direction Options

### Option A - Internal Local Diagramming Product

Focus on making the accepted MVP pleasant and repeatable for a small trusted
user group.

Likely work:

- supported installers;
- `doctor`;
- upgrade/uninstall;
- better troubleshooting;
- internal release notes;
- OS support matrix;
- documented Codex setup.

Risk: limited differentiation if the product remains only a draw.io controller.

### Option B - Public Beta Hardening

Focus on preparing CyberDraw for external users.

Required work:

- final legal and notices review;
- draw.io WAR asset notice closure;
- path traversal and extraction hardening;
- clear security posture for network profiles;
- public release artifacts and checksums;
- npm publication;
- GitHub Release;
- support policy;
- broader client matrix.

Risk: high support and compliance burden before product positioning is clear.

### Option C - Architecture Intelligence

Focus on evolving the internal graph, scoped identity and semantic diff
foundations into architecture understanding features.

Possible future capabilities:

- consistency analysis;
- changed-region analysis;
- selective recomputation;
- semantic comparison reports;
- non-mutating proposals;
- human-reviewed execution planning in later milestones.

Guardrail: do not expose public semantic diff, global identity, persistence or
mutation targeting without separate milestones and ADRs.

### Option D - Cybersecurity Diagramming Product

Focus CyberDraw on cybersecurity architecture and service documentation.

Possible domains:

- SOC and MDR;
- SIEM, SOAR, EDR and XDR;
- OT architecture;
- Medical IoT;
- RBVM;
- Zero Trust;
- DORA;
- NIS2;
- ENS;
- MITRE ATT&CK;
- incident-response flows;
- service blueprints;
- proposal and delivery diagrams.

Possible artifacts:

- curated architecture templates;
- shape and pattern libraries;
- guided prompts;
- domain validations;
- reference diagrams;
- export-ready service documentation.

Risk: requires a separate product taxonomy and content strategy, not only MCP
engineering.

## Recommended Sequence

Do not start a large Architecture Intelligence or cybersecurity specialization
milestone immediately.

Recommended path:

```text
M22 - Supported Installation And Local Operations
  -> CyberDraw Product Direction v1 decision
  -> M23 decision:
       Public Release Foundations
       or Architecture Intelligence Planning
       or Cybersecurity Diagramming Pack
```

## Decision Questions

Product Direction v1 must answer:

- Who is the primary user?
- Is CyberDraw primarily a generic draw.io MCP product or a cybersecurity
  diagramming product?
- Is the next distribution goal private/internal use, small-group external use
  or public beta?
- Which clients are product-supported and which are compatible in principle?
- What support burden is acceptable?
- What level of local network exposure is allowed?
- Which capabilities remain explicitly non-mutating?
- Should Architecture Intelligence become a product surface or remain internal
  until more evidence exists?
- What makes an M23 public release safe enough?

## Recommendation

First close M22. The real installation feedback already found issues that are
more urgent than adding new intelligence:

- artifact validation;
- platform-specific paths;
- Codex configuration;
- localhost versus LAN profiles;
- diagnostics;
- upgrade and uninstall.

After M22, select one M23 lane:

| Candidate M23                      | Choose if                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------- |
| Public Release Foundations         | installation is solid and the next blocker is legal/security/release publication.           |
| Architecture Intelligence Planning | users need deeper analysis and the internal M17/M18 foundations should become product work. |
| Cybersecurity Diagramming Pack     | the strongest value is a domain-specific diagramming workflow for cybersecurity teams.      |

## Non-Goals

This document does not authorize:

- new MCP tools;
- public semantic diff;
- incremental analysis implementation;
- persistence;
- global stable identity;
- mutation executor;
- approval workflow;
- rollback;
- transactions;
- public beta;
- npm publication;
- GitHub Release.
