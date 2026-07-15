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

Read `AGENTS.md` before modifying anything. It contains repository-wide logging,
navigation and command-output discipline.

## Repository Layout

| Path | Meaning |
| --- | --- |
| `packages/drawio-mcp-server/` | Node MCP server, stdio/HTTP transports, WebSocket bridge, tool schemas, editor routes |
| `packages/drawio-mcp-plugin/` | Browser plugin loaded into draw.io; executes tool handlers |
| `packages/drawio-mcp-extension/` | WXT browser extension, popup/options UI and content scripts |
| `packages/drawio-mcp-compat/` | Shared draw.io version compatibility helpers |
| `packages/drawio-mcp-dev-proxy/` | Local HTTPS/WSS development proxy |
| `docs/cyberdraw/` | Official CyberDraw fork documentation |
| `docs/cyberdraw/adr/` | Architecture decision records |
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
- Do not commit or push unless the user explicitly asks.

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
```

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

For architecture-level orientation, prefer `ARCHITECTURE.md` before reading
source files.
