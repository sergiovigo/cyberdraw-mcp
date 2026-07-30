# M20 License Inventory

## Status

PARTIAL / READY FOR FINAL M20 AUDIT.

## Inventory Command

Workspace dependency metadata was collected with:

```sh
corepack pnpm@10.8.1 licenses list --recursive --json
```

The command produced license metadata grouped into 16 license expressions. It
does not include first-party workspace packages as third-party dependencies and
does not by itself complete notices for bundled browser assets or downloaded
draw.io WAR contents.

## Official Artifact Candidate Runtime Dependencies

| Component                    | Version   | License metadata            | Distribution role                        |
| ---------------------------- | --------- | --------------------------- | ---------------------------------------- |
| `@hono/node-server`          | `2.0.11`  | MIT                         | Server HTTP runtime                      |
| `@modelcontextprotocol/sdk`  | `1.29.0`  | MIT                         | MCP server runtime                       |
| `cachedir`                   | `2.4.0`   | MIT                         | Asset cache path helper                  |
| `hono`                       | `4.12.31` | MIT                         | Built-in editor HTTP app                 |
| `nanoid`                     | `5.1.6`   | MIT                         | Runtime identifiers                      |
| `node-forge`                 | `1.4.0`   | `(BSD-3-Clause OR GPL-2.0)` | TLS material generation                  |
| `unzipper`                   | `0.12.3`  | MIT                         | draw.io WAR extraction                   |
| `ws`                         | `8.21.0`  | MIT                         | WebSocket bridge                         |
| `zod`                        | `4.2.1`   | MIT                         | Tool schema validation                   |
| `cyberdraw-graph-model`      | `0.0.0`   | first-party bundled private | Internal graph model implementation      |
| `cyberdraw-runtime-contract` | `0.0.0`   | first-party bundled private | Internal runtime snapshot implementation |

The two `cyberdraw-*` packages remain private workspace implementation details.
They are bundled into the server artifact and are not published, exposed as
public APIs or declared as external runtime dependencies of the distributable
package.

## Runtime Asset Notices

The built-in editor downloads the pinned draw.io WAR at runtime rather than
bundling the WAR in the npm package.

The WAR contains license files for selected asset groups:

- `img/LICENSE`;
- `shapes/LICENSE`;
- `stencils/LICENSE`;
- `templates/LICENSE`;
- `js/libavoid-js/LICENSE`.

M20 does not claim full draw.io notice completion. Before external
distribution, the release must decide how these notices are surfaced to users
and whether additional upstream notices inside the WAR are required.

## Extension And Dev/Test Inventory

Extension and dev/test dependencies are outside the official local stdio server
artifact, but remain relevant for optional artifacts and source releases.

Known examples from the workspace license inventory:

| Component          | Version   | License metadata | Role                    |
| ------------------ | --------- | ---------------- | ----------------------- |
| `react`            | `19.1.0`  | MIT              | Browser extension UI    |
| `react-dom`        | `19.1.0`  | MIT              | Browser extension UI    |
| `wxt`              | `0.20.20` | MIT              | Extension build tooling |
| `@playwright/test` | `1.59.1`  | Apache-2.0       | Real-environment tests  |

## Unresolved Items

- complete per-package notice review for the server artifact;
- final wording for first-party internal bundled implementation notices;
- draw.io WAR bundled third-party notice review;
- extension bundle notice review;
- Caddy dev-proxy binary notice review;
- Playwright/Chromium downloaded artifact notice review;
- final `THIRD_PARTY_NOTICES.md` text for the release.

External MVP distribution remains limited until these items are resolved or
explicitly accepted by release governance.
