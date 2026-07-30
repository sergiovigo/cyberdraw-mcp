# Third Party Notices

This file records components verified during M0 and M20. It is not yet a
complete external-distribution license audit.

Reproducible dependency license inventory command:

```sh
pnpm licenses list --recursive --json
```

This command reports dependency metadata from the installed pnpm workspace. It
does not by itself complete notice review for distributable artifacts.

## Verified Project License

| Component                                            | Evidence                                        | License |
| ---------------------------------------------------- | ----------------------------------------------- | ------- |
| Inherited Draw.io MCP Server source by Ladislav Gazo | `LICENSE.md`, root and package `license` fields | MIT     |

## Verified Runtime/Build Components

| Component                     | Evidence                                                                            | License status             |
| ----------------------------- | ----------------------------------------------------------------------------------- | -------------------------- |
| Node.js runtime               | Local runtime and Docker `node:22-slim` usage; CyberDraw M1 supports Node.js 22+    | Pending full notice review |
| pnpm 10.8.1                   | Root `packageManager`                                                               | Pending full notice review |
| pnpm 11.13.0                  | Root `audit:dependencies` script uses it only for dependency audit                  | Pending full notice review |
| TypeScript 5.9.3              | pnpm catalog                                                                        | Pending full notice review |
| MCP TypeScript SDK 1.29.0     | `drawio-mcp-server` dependency                                                      | Pending full notice review |
| Hono / `@hono/node-server`    | `drawio-mcp-server` dependency                                                      | Pending full notice review |
| `ws`                          | `drawio-mcp-server` dependency                                                      | Pending full notice review |
| WXT                           | `drawio-mcp-extension` dev dependency                                               | Pending full notice review |
| React / React DOM             | `drawio-mcp-extension` dependencies                                                 | Pending full notice review |
| Playwright                    | `drawio-mcp-server` dev dependency and test browser cache                           | Pending full notice review |
| Caddy binary                  | downloaded by `drawio-mcp-dev-proxy` postinstall                                    | Pending full notice review |
| draw.io / diagrams.net assets | downloaded/cached from pinned `jgraph/drawio` release `v31.1.5` for built-in editor | Pending full notice review |

## Verified Provenance Behaviors

| Component                            | Evidence                                                                                                                                                                                                                                                                                                                                                             | Notes                                                                                                      |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Caddy 2.8.4 dev proxy binary         | `packages/drawio-mcp-dev-proxy/scripts/install-caddy.mjs` pins `CADDY_VERSION = "2.8.4"` and verifies the downloaded archive against Caddy's release `checksums.txt` with SHA512 before extraction                                                                                                                                                                   | Binary is downloaded into `packages/drawio-mcp-dev-proxy/bin/`; license notice requirements remain pending |
| draw.io / diagrams.net editor assets | `packages/drawio-mcp-server/src/assets/downloader.ts` pins `draw.war` to `jgraph/drawio` release `v31.1.5` and verifies SHA-256 `43b0437762cf25375e233726d6539792584c4bd38176e4eceae5ea4359090278` plus SHA-512 `56ea7da0efd96f70aca9d0190a87adc5290660c0941291f704bb94c407f7a07f380251a61dcbed77fff25661cd990668724acd7cd21ed0b1a3c16338e3018b38` before extraction | Asset version/provenance is pinned for M20; full draw.io WAR notice review remains pending                 |

## M20 Runtime Dependency License Metadata

`corepack pnpm@10.8.1 licenses list --recursive --json` reports the following
license metadata for the official server artifact candidate's runtime
dependencies:

| Component                    | Version   | License metadata                                                              |
| ---------------------------- | --------- | ----------------------------------------------------------------------------- |
| `@hono/node-server`          | `2.0.11`  | MIT                                                                           |
| `@modelcontextprotocol/sdk`  | `1.29.0`  | MIT                                                                           |
| `cachedir`                   | `2.4.0`   | MIT                                                                           |
| `hono`                       | `4.12.31` | MIT                                                                           |
| `nanoid`                     | `5.1.6`   | MIT                                                                           |
| `node-forge`                 | `1.4.0`   | `(BSD-3-Clause OR GPL-2.0)`                                                   |
| `unzipper`                   | `0.12.3`  | MIT                                                                           |
| `ws`                         | `8.21.0`  | MIT                                                                           |
| `zod`                        | `4.2.1`   | MIT                                                                           |
| `cyberdraw-graph-model`      | `0.0.0`   | First-party private workspace implementation bundled into `drawio-mcp-server` |
| `cyberdraw-runtime-contract` | `0.0.0`   | First-party private workspace implementation bundled into `drawio-mcp-server` |

The first-party workspace packages remain private, version `0.0.0` and
unpublished. M20 bundles their runtime implementation into the server artifact
without documenting them as public APIs or external package dependencies.

## M20 Draw.io WAR Notice Evidence

The pinned `draw.war` contains license files including:

- `img/LICENSE`;
- `shapes/LICENSE`;
- `stencils/LICENSE`;
- `templates/LICENSE`;
- `js/libavoid-js/LICENSE`.

These files were observed in the pinned WAR, but M20 does not claim that the
draw.io WAR notice review is complete.

## Pending Review

- Full dependency license inventory from `pnpm-lock.yaml`.
- Browser extension store assets and icons.
- draw.io bundled assets and third-party notices included inside upstream WARs.
- Final wording for first-party bundled implementation notices required by
  `drawio-mcp-server`.
- Caddy binary license notice requirements.
- Playwright downloaded browser artifacts and codecs.
- Generated extension bundles and embedded plugin bundle contents.

Do not add unverified license claims to this file. Add evidence and source paths
when a component is reviewed.
