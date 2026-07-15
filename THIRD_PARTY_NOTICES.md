# Third Party Notices

This file records only components verified during M0. It is not yet a complete
license audit.

Reproducible dependency license inventory command:

```sh
pnpm licenses list --recursive --json
```

This command reports dependency metadata from the installed pnpm workspace. It
does not by itself complete notice review for distributable artifacts.

## Verified Project License

| Component | Evidence | License |
| --- | --- | --- |
| Inherited Draw.io MCP Server source by Ladislav Gazo | `LICENSE.md`, root and package `license` fields | MIT |

## Verified Runtime/Build Components

| Component | Evidence | License status |
| --- | --- | --- |
| Node.js runtime | Local runtime and Docker `node:22-slim` usage; CyberDraw M1 supports Node.js 22+ | Pending full notice review |
| pnpm 10.8.1 | Root `packageManager` | Pending full notice review |
| pnpm 11.13.0 | Root `audit:dependencies` script uses it only for dependency audit | Pending full notice review |
| TypeScript 5.9.3 | pnpm catalog | Pending full notice review |
| MCP TypeScript SDK 1.29.0 | `drawio-mcp-server` dependency | Pending full notice review |
| Hono / `@hono/node-server` | `drawio-mcp-server` dependency | Pending full notice review |
| `ws` | `drawio-mcp-server` dependency | Pending full notice review |
| WXT | `drawio-mcp-extension` dev dependency | Pending full notice review |
| React / React DOM | `drawio-mcp-extension` dependencies | Pending full notice review |
| Playwright | `drawio-mcp-server` dev dependency and test browser cache | Pending full notice review |
| Caddy binary | downloaded by `drawio-mcp-dev-proxy` postinstall | Pending full notice review |
| draw.io / diagrams.net assets | downloaded/cached from `jgraph/drawio` releases for built-in editor | Pending full notice review |

## Verified Provenance Behaviors

| Component | Evidence | Notes |
| --- | --- | --- |
| Caddy 2.8.4 dev proxy binary | `packages/drawio-mcp-dev-proxy/scripts/install-caddy.mjs` pins `CADDY_VERSION = "2.8.4"` and verifies the downloaded archive against Caddy's release `checksums.txt` with SHA512 before extraction | Binary is downloaded into `packages/drawio-mcp-dev-proxy/bin/`; license notice requirements remain pending |
| draw.io / diagrams.net editor assets | `packages/drawio-mcp-server/src/assets/downloader.ts` fetches the latest `draw.war` from `https://api.github.com/repos/jgraph/drawio/releases/latest`; `auto-refresh.ts` refetches when cached assets fall outside the supported compatibility window | CyberDraw releases do not yet pin or record a specific draw.io asset version |

## Pending Review

- Full dependency license inventory from `pnpm-lock.yaml`.
- Browser extension store assets and icons.
- draw.io bundled assets and third-party notices included inside upstream WARs.
- Caddy binary license notice requirements.
- Playwright downloaded browser artifacts and codecs.
- Generated extension bundles and embedded plugin bundle contents.

Do not add unverified license claims to this file. Add evidence and source paths
when a component is reviewed.
