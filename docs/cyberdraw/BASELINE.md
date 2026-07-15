# CyberDraw MCP Baseline

Milestone: M0 Project Bootstrap & Reproducible Baseline

Date: 2026-07-15
Branch: `chore/project-bootstrap`

## Environment

| Item | Value |
| --- | --- |
| OS | Ubuntu 24.04.4 LTS, Linux 6.8.0-134-lowlatency x86_64 |
| Node.js | `v24.18.0` |
| pnpm | `10.8.1` |
| Corepack | `0.35.0` |
| Git branch | `chore/project-bootstrap` |
| Git status before M0 docs | clean |
| `origin` | `https://github.com/sergiovigo/cyberdraw-mcp.git` |
| `upstream` | `https://github.com/lgazo/drawio-mcp-server.git` |

`rtk` and `roam` are required by the root `AGENTS.md`, but neither command was
available in this shell. The baseline therefore used direct shell commands and
`rg`/`nl` for read-only inspection.

## Node Version Discrepancy

Observed sources disagree:

- `README.md` documents Node.js v22 or higher, tested against v22 LTS and v24 LTS.
- `packages/drawio-mcp-server/package.json` declares `engines.node >=20.0.0`.
- `packages/drawio-mcp-dev-proxy/package.json` declares `engines.node >=20.0.0`.
- CI runs Node `22.x` and `24.x`.
- Docker uses `node:22-slim`.

Recommended M0 decision: treat Node 22 LTS as the official minimum for the fork,
with Node 24 as the forward-compatibility lane. Do not change `engines` during
M0. A later milestone should align package engines, README, Docker and CI in one
explicit compatibility change.

## Reproducible Setup

Commands executed:

```sh
corepack enable
corepack prepare pnpm@10.8.1 --activate
pnpm install --frozen-lockfile
```

Result: PASS WITH WARNINGS.

Warnings:

- Node emitted `[DEP0169]` for `url.parse()`.
- pnpm showed an update notice from `10.8.1` to `11.13.0`; no update was made.
- pnpm ignored build scripts for `spawn-sync`.
- `drawio-mcp-dev-proxy` postinstall downloaded Caddy to an ignored `bin/caddy`.
- WXT postinstall emitted Vite deprecation/performance warnings.

The lockfile was not regenerated.

## Command Matrix

| Area | Command | Approx. duration | Result | Notes |
| --- | --- | ---: | --- | --- |
| Environment | `node --version` | <1s | PASS | `v24.18.0` |
| Environment | `pnpm --version` | ~2s | PASS | `10.8.1`; first call triggered Corepack download |
| Environment | `corepack --version` | <1s | PASS | `0.35.0` |
| Git | `git branch --show-current` | <1s | PASS | `chore/project-bootstrap` |
| Git | `git status --short` | <1s | PASS | Clean before docs |
| Git | `git remote -v` | <1s | PASS | `origin` fork, `upstream` original |
| Install | `corepack enable` | <1s | PASS | No output |
| Install | `corepack prepare pnpm@10.8.1 --activate` | <1s | PASS | Activated requested pnpm |
| Install | `pnpm install --frozen-lockfile` | ~15s | PASS WITH WARNINGS | No lockfile update |
| Build | `pnpm run build` | ~12s | PASS WITH WARNINGS | WXT/Vite warnings and Node deprecation warning |
| Lint/typecheck | `pnpm --filter drawio-mcp-server run lint` | ~7s | PASS WITH WARNINGS | Runs `vendor:compat`, Biome and `tsc --noEmit` |
| Tests initial | `pnpm run test` | ~61s | FAIL | Failed because Playwright Chromium was missing |
| Browser prereq | `pnpm exec playwright install chromium` from server package | ~19s | PASS | Downloaded Playwright browser cache outside repo |
| Server tests | `pnpm --filter drawio-mcp-server run test` | ~92s | PASS WITH WARNINGS | 40 suites, 328 tests |
| Root tests | `pnpm run test` | ~122s | PASS WITH WARNINGS | Compat 8 tests; server 328 tests |
| Plugin tests | none | n/a | NOT AVAILABLE | `drawio-mcp-plugin` has no `test` script |
| Compat tests | included in `pnpm run test` | ~2s | PASS WITH WARNINGS | VM Modules warning |
| Audit | `pnpm audit --audit-level=moderate` | ~1s | FAIL | npm audit endpoint returned HTTP 410 |
| MCP smoke | inline Node SDK stdio client | ~1s | PASS WITH WARNINGS | Logs on stderr; stdout JSON-RPC consumed by SDK |
| Editor smoke | start server with `--transport http --editor` and curl | ~1s | PASS | `/health` ok, `/` 200, `/mcp` GET 406, stdout 0 bytes |

## Smoke Test Results

MCP stdio smoke:

- Server started over stdio with a local WebSocket port.
- `listTools` returned 28 tools.
- `list-documents` returned `{"success":true,"result":[]}` with no connected document.
- `list-pages` returned `isError=true` with `No connected Draw.io documents`.
- A fake WebSocket document was registered through `document-state`.
- `list-documents` returned the fake document.
- `get-shape-categories` against the fake document timed out in about 154 ms when
  the fake plugin did not reply.

Editor smoke:

- Command started `drawio-mcp-server --transport http --editor --http-port 39999 --extension-port 38999 --host 127.0.0.1`.
- `/health` returned `{"status":"ok"}`.
- `/` returned HTTP 200.
- `/mcp` via raw GET returned HTTP 406, expected without MCP negotiation.
- Captured stdout was 0 bytes; diagnostics went to stderr.

## Differences Detected

- Node compatibility is inconsistent across README, package engines, Docker and CI.
- `pnpm audit --audit-level=moderate` is documented in CI but fails locally with
  HTTP 410 from the old audit endpoint used by pnpm 10.8.1 on this date.
- The root `test` command requires Playwright Chromium, but that browser is not
  installed by `pnpm install`; CI installs it explicitly.
- `drawio-mcp-plugin` has build coverage but no package-level `test` script.
- The server CLI rejects `--extension-port 0`; tests use internal APIs with port
  zero. A real CLI smoke must use a concrete port.
- The docs mention `output_path` for export; the server schema implements it,
  while the plugin-side registry does not forward it because file writing is
  handled server-side after export.

## Reproducible Procedure

Use Node 22 LTS or Node 24. The baseline above was taken on Node 24.18.0.

```sh
corepack enable
corepack prepare pnpm@10.8.1 --activate
pnpm install --frozen-lockfile
pnpm run build
pnpm --filter drawio-mcp-server run lint
pnpm --filter drawio-mcp-server exec playwright install chromium
pnpm run test
```

The equivalent Playwright command executed during M0 was run from
`packages/drawio-mcp-server`:

```sh
pnpm exec playwright install chromium
```

The audit command is currently not reproducible with pnpm 10.8.1 because the
registry endpoint returns 410.
