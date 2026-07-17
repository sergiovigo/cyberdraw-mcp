# AI Onboarding for CyberDraw MCP

This guide is for future AI agents entering the CyberDraw MCP repository. It is
practical by design: use it to orient quickly, avoid out-of-scope changes and
start future milestones cleanly.

## What This Project Is

CyberDraw MCP is a conservative fork of Draw.io MCP Server. It exposes draw.io
diagram operations as MCP tools through a Node server, a WebSocket bridge and a
browser-side draw.io plugin.

M0 does not add CyberDraw-specific functionality. It records the inherited
system and establishes a reproducible baseline for later security-oriented
diagramming work.

## Read First

1. `docs/cyberdraw/README.md` for the documentation map.
2. `docs/cyberdraw/GOVERNANCE.md` for fork rules.
3. `docs/cyberdraw/BASELINE.md` for reproducible commands and known gaps.
4. `docs/cyberdraw/ARCHITECTURE.md` for components and data flow.
5. `docs/cyberdraw/SECURITY-BASELINE.md` before changing network, import/export
   or filesystem behavior.
6. `docs/cyberdraw/M0-BACKLOG.md` before planning the next milestone.
7. `docs/cyberdraw/rfc/0001-internal-graph-model.md` when working on the draft
   Architecture Intelligence Foundation proposal.
8. `docs/cyberdraw/adr/0003-internal-graph-model-architecture.md` before
   integrating the internal graph model at runtime.
9. `docs/cyberdraw/spikes/0002-runtime-snapshot-handler.md` when working on the
   internal runtime snapshot handler prototype.
10. `docs/cyberdraw/milestones/M4-runtime-snapshot-product-hardening.md` before
    using runtime snapshots for future product features.
11. `docs/cyberdraw/milestones/M5-scoped-snapshot-delivery.md` before changing
    internal runtime snapshot scopes.
12. `docs/cyberdraw/milestones/M6-runtime-snapshot-benchmarks.md` before
    changing runtime snapshot scaling strategy, limits, chunking or
    incremental-analysis plans.
13. `docs/cyberdraw/milestones/M7-real-environment-snapshot-benchmarks.md`
    before changing real-runtime snapshot limits, browser extraction behavior
    or ADR 0004 follow-up strategy.

Read `AGENTS.md` before modifying anything. It contains repository-wide logging,
navigation and command-output discipline.

## Repository Layout

| Path | Meaning |
| --- | --- |
| `packages/drawio-mcp-server/` | Node MCP server, stdio/HTTP transports, WebSocket bridge, tool schemas, editor routes |
| `packages/drawio-mcp-plugin/` | Browser plugin loaded into draw.io; executes tool handlers |
| `packages/drawio-mcp-extension/` | WXT browser extension, popup/options UI and content scripts |
| `packages/drawio-mcp-compat/` | Shared draw.io version compatibility helpers |
| `packages/cyberdraw-graph-model/` | Private pure read-only graph model spike package; core consumes experimental `CanonicalDiagramInput`, legacy draw.io/MCP read shapes stay in an adapter |
| `packages/cyberdraw-runtime-contract/` | Private runtime snapshot contract constants, types, validation and revision helpers shared by server and plugin |
| `packages/cyberdraw-runtime-benchmarks/` | Private manual M6 synthetic and M7 real-environment benchmark harnesses for runtime snapshot scaling evidence |
| `packages/drawio-mcp-dev-proxy/` | Local HTTPS/WSS development proxy |
| `docs/cyberdraw/` | Official CyberDraw fork documentation |
| `docs/cyberdraw/adr/` | Architecture decision records |
| `docs/cyberdraw/rfc/` | Draft requests for comments; proposals only until accepted by ADR or milestone plan |
| `docs/cyberdraw/diagrams/` | Supporting Mermaid diagrams for CyberDraw architecture proposals |
| `docs/superpowers/` | Historical planning/spec documents inherited from earlier work |
| `THIRD_PARTY_NOTICES.md` | Third-party notice tracking |

## Rules to Follow

- Do not introduce new functionality during baseline/documentation work.
- Do not mix upstream syncs with CyberDraw feature work.
- Do not change dependencies, lockfiles, workflows or package metadata unless
  the task explicitly requires it.
- Keep MCP stdio stdout pure: diagnostics must not write raw stdout in server
  production code.
- Treat HTTP MCP and WebSocket surfaces as unauthenticated by default.
- Their default bind address is `127.0.0.1`; wildcard hosts are explicit
  exposure choices and should be paired with an auth proxy or trusted boundary.
- Treat `output_path` as trusted-client filesystem write behavior.
- Update `THIRD_PARTY_NOTICES.md` when adding dependencies, vendored assets,
  downloaded binaries, generated bundles or externally sourced content.
- Record lasting architecture or governance decisions as ADRs.

## What Not To Do

- Do not rename packages or rebrand internals casually.
- Do not add CyberDraw-specific tools without a milestone and ADR-level design.
- Do not restructure the monorepo as cleanup.
- Do not remove inherited compatibility logic without an explicit policy change.
- Do not expose HTTP/WebSocket services beyond loopback without documented auth.
- Do not treat historical plans under `docs/superpowers/` as current backlog.
- Do not treat the internal graph model spike as product behavior: ADR 0003
  accepts only the private, server-first package architecture. The M3 runtime
  snapshot spike adds an internal handler but still defers stable identity,
  public schemas and new MCP tools.
- Do not commit or push unless the user explicitly asks.
- Do not treat draft RFCs as accepted architecture; record implementation
  decisions separately when they are approved.

## Starting a New Milestone

1. Read `GOVERNANCE.md` and the accepted ADRs.
2. Review `M0-BACKLOG.md` and choose a narrow scope.
3. State whether the milestone changes inherited behavior.
4. Check whether an ADR is needed before implementation.
5. Identify docs that must change with the work: architecture, tools, security,
   upstream, onboarding or third-party notices.
6. Keep upstream synchronization in a separate branch.
7. Run validation proportional to the changed surface.
8. Update backlog status or carry unresolved items forward explicitly.

## Useful Baseline Commands

Use Corepack and the pinned pnpm version:

```sh
corepack enable
corepack prepare pnpm@10.8.1 --activate
pnpm install --frozen-lockfile
pnpm run build
pnpm --filter drawio-mcp-server run lint
pnpm --filter drawio-mcp-server exec playwright install chromium
pnpm run test
pnpm run audit:dependencies
```

`pnpm install` does not download Playwright browsers. Run the Chromium install
command explicitly before the full test suite on a fresh machine.

`pnpm run audit:dependencies` uses pnpm 11.13.0 only for auditing because the
normal pnpm 10.8.1 baseline uses a retired npm audit endpoint. A clean audit
result is not proof that no vulnerabilities exist.

If `rtk` or `roam` are unavailable, record that fact and continue with `rg`,
direct shell commands and package scripts.

## Where To Look For Components

- MCP server entry point: `packages/drawio-mcp-server/src/index.ts`
- Server tool registration: `packages/drawio-mcp-server/src/tools/index.ts`
- Server logging discipline: `packages/drawio-mcp-server/src/*logger*.ts`
- WebSocket/document routing: `packages/drawio-mcp-server/src/index.ts`
- Plugin entry point: `packages/drawio-mcp-plugin/src/plugin.ts`
- Plugin tool dispatch: `packages/drawio-mcp-plugin/src/tool-registry.ts`
- Draw.io compatibility matrix: `packages/drawio-mcp-plugin/src/drawio-compat/`
- Extension popup/options: `packages/drawio-mcp-extension/entrypoints/`
- Internal graph spike: `packages/cyberdraw-graph-model/src/`
- Runtime snapshot spike: `packages/drawio-mcp-plugin/src/runtime-snapshot.ts`,
  `packages/drawio-mcp-server/src/cyberdraw-runtime-snapshot.ts` and
  `packages/cyberdraw-graph-model/src/runtime-snapshot-adapter.ts`
- Runtime snapshot contract:
  `packages/cyberdraw-runtime-contract/src/index.ts`
- Scoped snapshot milestone:
  `docs/cyberdraw/milestones/M5-scoped-snapshot-delivery.md`
- Runtime snapshot benchmark milestone:
  `docs/cyberdraw/milestones/M6-runtime-snapshot-benchmarks.md`
- Real-environment snapshot benchmark milestone:
  `docs/cyberdraw/milestones/M7-real-environment-snapshot-benchmarks.md`

For architecture-level orientation, prefer `ARCHITECTURE.md` before reading
source files.
