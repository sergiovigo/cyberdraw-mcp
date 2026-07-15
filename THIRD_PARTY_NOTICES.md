# Third Party Notices

This file records only components verified during M0. It is not yet a complete
license audit.

## Verified Project License

| Component | Evidence | License |
| --- | --- | --- |
| Inherited Draw.io MCP Server source by Ladislav Gazo | `LICENSE.md`, root and package `license` fields | MIT |

## Verified Runtime/Build Components

| Component | Evidence | License status |
| --- | --- | --- |
| Node.js runtime | Local runtime and Docker `node:22-slim` usage | Pending full notice review |
| pnpm 10.8.1 | Root `packageManager` | Pending full notice review |
| TypeScript 5.9.3 | pnpm catalog | Pending full notice review |
| MCP TypeScript SDK 1.29.0 | `drawio-mcp-server` dependency | Pending full notice review |
| Hono / `@hono/node-server` | `drawio-mcp-server` dependency | Pending full notice review |
| `ws` | `drawio-mcp-server` dependency | Pending full notice review |
| WXT | `drawio-mcp-extension` dev dependency | Pending full notice review |
| React / React DOM | `drawio-mcp-extension` dependencies | Pending full notice review |
| Playwright | `drawio-mcp-server` dev dependency and test browser cache | Pending full notice review |
| Caddy binary | downloaded by `drawio-mcp-dev-proxy` postinstall | Pending full notice review |
| draw.io / diagrams.net assets | downloaded/cached from `jgraph/drawio` releases for built-in editor | Pending full notice review |

## Pending Review

- Full dependency license inventory from `pnpm-lock.yaml`.
- Browser extension store assets and icons.
- draw.io bundled assets and third-party notices included inside upstream WARs.
- Caddy binary license notice requirements.
- Playwright downloaded browser artifacts and codecs.
- Generated extension bundles and embedded plugin bundle contents.

Do not add unverified license claims to this file. Add evidence and source paths
when a component is reviewed.
