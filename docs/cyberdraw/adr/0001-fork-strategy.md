# ADR 0001: Conservative Fork Strategy

## Status

Accepted.

## Context

CyberDraw MCP starts from an existing Draw.io MCP Server codebase with working
MCP transports, a WebSocket bridge, a browser plugin, a browser extension,
draw.io compatibility logic, tests and existing operational documentation.

The intended future direction is security-oriented diagramming. That future work
depends on trust in the inherited baseline: developers need to know what tools
exist, how calls move through the system, what security assumptions are already
present and how upstream changes should be absorbed.

Beginning with a rewrite would replace known inherited behavior with new
unknowns before CyberDraw has documented compatibility, validation or security
boundaries.

## Decision

CyberDraw MCP will begin as a conservative fork.

During M0 the fork preserves inherited behavior and focuses on reproducibility,
documentation, governance, architecture inventory, security baseline and
upstream tracking. CyberDraw-specific tools, cybersecurity specialization,
intermediate diagram models, package renames, repository restructuring and
architecture changes are deferred to later milestones.

## Consequences

- Existing Draw.io MCP behavior remains the compatibility baseline.
- M0 can validate the current system without introducing feature risk.
- Future milestones have a clearer map of components, tools, security surfaces
  and upstream obligations.
- Some inherited inconsistencies remain temporarily, including Node version
  policy differences and dependency audit behavior.
- Architectural limitations are documented before they are changed.
- Fork identity is established through governance and documentation first, not
  through broad code churn.

## Alternatives Discarded

### Rewrite from Scratch

Discarded because it would delay useful baseline work, lose inherited behavior
as a reference point and create new implementation risk before CyberDraw has a
documented security model.

### Immediate CyberDraw Feature Branch

Discarded because adding security-specific tools before documenting the current
tool surface would mix product direction with baseline discovery.

### Broad Rebranding and Package Renames

Discarded because renames create review noise, increase upstream sync cost and
do not improve the technical baseline.

### Architecture Refactor During M0

Discarded because architecture changes require decision records, test strategy
and migration planning. M0's purpose is to observe and document the inherited
architecture, not replace it.
