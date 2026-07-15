# CyberDraw MCP Fork

CyberDraw MCP is a fork of Draw.io MCP Server intended to establish a controlled
foundation for future security-oriented diagramming workflows.

## Purpose

The immediate purpose of the fork is to preserve the inherited Draw.io MCP
behavior while making the project reproducible, documented and governable before
any new CyberDraw-specific features are added.

## Current Goals

- Establish a reproducible local and CI baseline.
- Document the real architecture, tools and security posture.
- Track upstream deliberately.
- Preserve MCP stdout discipline.
- Keep third-party notices and asset provenance visible.

## Not Yet In Scope

During M0, CyberDraw MCP does not introduce:

- new MCP tools;
- cybersecurity specialization;
- an intermediate diagram model;
- package renames or branding changes;
- architecture changes;
- repository restructuring;
- cosmetic optimization.

## Upstream Strategy

The fork keeps the original repository as `upstream` and treats upstream syncs as
separate maintenance work. Upstream syncs should not be mixed with feature work.
Every sync should run the reproducible baseline and document any intentional
divergence.

See `docs/cyberdraw/UPSTREAM.md` for the working process.
