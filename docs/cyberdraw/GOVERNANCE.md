# CyberDraw MCP Governance

This document is the official governance reference for the CyberDraw MCP fork.
It describes how the fork should evolve after M0 while preserving the inherited
Draw.io MCP Server behavior until a later milestone explicitly changes it.

## Purpose of the Fork

CyberDraw MCP is a conservative fork of Draw.io MCP Server. The fork exists to
establish a reproducible, documented and governable baseline for future
security-oriented diagramming work.

The fork does not begin by renaming packages, replacing architecture or adding
CyberDraw-specific tools. M0 makes the inherited system understandable first.

## Objectives

- Preserve inherited Draw.io MCP behavior during baseline work.
- Make setup, build, lint, test and smoke validation reproducible.
- Document architecture, tools, security posture and upstream tracking.
- Keep MCP stdio output clean for spec-strict clients.
- Track third-party components, generated artifacts and downloaded assets.
- Prepare a controlled path for future security-oriented milestones.

## Principles

- Baseline before features: establish what exists before changing behavior.
- Small, explicit changes: each milestone should have a narrow purpose.
- Upstream-aware development: inherited behavior is a compatibility asset.
- Security visibility: unauthenticated surfaces and filesystem writes must be
  documented before they are expanded.
- Reproducibility: local and CI procedures should remain explainable from docs.
- Documentation is part of the product: docs under `docs/cyberdraw/` are the
  official fork record.

## Synchronization Strategy

Keep `upstream` pointed at the original repository:

```text
https://github.com/lgazo/drawio-mcp-server.git
```

Rules for upstream synchronization:

1. Perform upstream synchronization in dedicated branches.
2. Do not mix upstream syncs with CyberDraw feature work.
3. Review upstream changes against the CyberDraw architecture, tools inventory,
   security baseline and backlog.
4. Run the reproducible baseline before merging a sync.
5. Document intentional divergence in `UPSTREAM.md` or a dated ADR.

See `UPSTREAM.md` for the operational process.

## Change Policy

M0 and baseline maintenance must not introduce new functionality. In particular,
do not mix these changes with:

- new MCP tools;
- cybersecurity specialization;
- an intermediate diagram model;
- package renames or broad branding changes;
- architecture changes;
- repository restructuring;
- dependency changes unrelated to the explicit task.

Behavioral changes require a named milestone, updated documentation and suitable
validation. Architecture-level decisions should be recorded as ADRs under
`docs/cyberdraw/adr/`.

## Baseline Policy

Recommended baseline runtime:

- Node.js 22 LTS minimum;
- Node.js 24 retained as a forward-compatibility lane;
- `pnpm@10.8.1` through Corepack.

Baseline commands:

```sh
corepack enable
corepack prepare pnpm@10.8.1 --activate
pnpm install --frozen-lockfile
pnpm run build
pnpm --filter drawio-mcp-server run lint
pnpm --filter drawio-mcp-server exec playwright install chromium
pnpm run test
```

M0 records a Node version discrepancy between docs, package engines, Docker and
CI. Do not change those surfaces casually; align them in one explicit
compatibility task.

## Documentation Policy

Fork-specific documentation lives under `docs/cyberdraw/`.

- `README.md` is the entry point and document map.
- `GOVERNANCE.md` is the official fork policy.
- `BASELINE.md` records reproducible M0 evidence.
- `ARCHITECTURE.md` describes the inherited system.
- `TOOLS-INVENTORY.md` records the inherited MCP tool surface.
- `SECURITY-BASELINE.md` records known security surfaces and risks.
- `UPSTREAM.md` records upstream tracking policy and divergence.
- `M0-BACKLOG.md` records follow-up work discovered during M0.
- `AI-ONBOARDING.md` gives future AI agents a practical starting path.
- `adr/` records lasting architecture and governance decisions.

Update affected documents when changing behavior, operational policy, security
posture, dependencies, generated artifacts, vendored assets or release process.

## Security Policy

Security policy for the fork:

- Keep MCP stdout clean. With stdio transport, stdout is reserved for MCP
  JSON-RPC frames produced by the MCP SDK.
- Treat MCP HTTP and WebSocket endpoints as unauthenticated unless an explicit
  deployment layer provides authentication.
- Prefer loopback binding for local development and require a documented
  authenticating reverse proxy for non-local deployments.
- Document filesystem-writing behavior such as `output_path`.
- Treat imported diagram XML, SVG, PNG embedded XML and Mermaid source as
  untrusted input interpreted by draw.io/browser code.
- Run the server with least privilege in deployment profiles that allow export
  writes.

See `SECURITY-BASELINE.md` for the M0 inventory and prioritized follow-ups.

## Release Policy

CyberDraw releases should be based on a documented baseline:

- record Node, pnpm, branch, commit and relevant upstream draw.io asset version;
- run build, lint and tests from the baseline procedure;
- document any skipped validation with reason and impact;
- record upstream divergence since the previous release;
- review third-party notices before distributing artifacts;
- do not publish releases that combine upstream sync, baseline repair and new
  feature work unless the release notes separate those changes clearly.

## Third-Party Policy

Maintain `THIRD_PARTY_NOTICES.md` whenever adding dependencies, vendored assets,
downloaded binaries, generated bundles or externally sourced content.

Do not add unverified license claims. Record evidence, source path and review
status for each component. Draw.io assets, Playwright browser artifacts, Caddy
binaries and generated extension bundles require explicit provenance review
before release packaging.

## Future Milestones Policy

Future milestones may add CyberDraw-specific behavior only after the baseline is
accepted. Each milestone should:

- state whether it changes inherited behavior;
- update architecture, tools, security and onboarding docs as needed;
- add ADRs for lasting design choices;
- keep upstream sync work separate;
- include validation proportional to the changed surface;
- carry unresolved M0 backlog items forward explicitly or close them with
  evidence.

Future architecture ideas are planning material until implemented. Documents
must clearly distinguish current behavior from proposed designs.
