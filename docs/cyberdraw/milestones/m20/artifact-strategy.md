# M20 Artifact Strategy

## Status

IN PROGRESS / READY FOR FINAL M20 AUDIT.

## Artifact Matrix

| Artifact               | Intended audience         | Build command                                                                                                                    | Contents                                                                                            | Version source                                      | License obligations                                                                                                | Reproducibility                                                                 | MVP status                   |
| ---------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- | ---------------------------- |
| Server npm package     | End users and MCP clients | `corepack pnpm@10.8.1 --filter drawio-mcp-server run build`; `corepack pnpm@10.8.1 --filter drawio-mcp-server run pack:artifact` | Compiled server, bundled private first-party runtime code, bundled browser plugin, package metadata | `packages/drawio-mcp-server/package.json` (`2.2.0`) | Runtime dependency notices, bundled first-party source notice, bundled plugin notice, draw.io runtime asset notice | Reproducible tarball content and clean install proven in M20                    | OFFICIAL MVP ARTIFACT        |
| Source release         | Developers and auditors   | Git archive plus `corepack pnpm@10.8.1 install --frozen-lockfile`                                                                | Full monorepo source                                                                                | Git commit                                          | Full source and dependency notice set                                                                              | Reproducible from lockfile                                                      | OPTIONAL COMPATIBLE ARTIFACT |
| Chrome extension zip   | Browser-extension users   | `corepack pnpm@10.8.1 --filter drawio-mcp-extension run build`                                                                   | WXT Chrome build                                                                                    | Extension manifest version (`2.2.0`)                | Extension bundle dependency notices                                                                                | Build reproducibility not fully audited in M20                                  | OPTIONAL COMPATIBLE ARTIFACT |
| Firefox extension zip  | Browser-extension users   | `corepack pnpm@10.8.1 --filter drawio-mcp-extension run build:firefox`                                                           | WXT Firefox build                                                                                   | Extension manifest version (`2.2.0`)                | Extension bundle dependency notices                                                                                | Build reproducibility not fully audited in M20                                  | OPTIONAL COMPATIBLE ARTIFACT |
| Docker image           | Operators                 | Existing Dockerfile                                                                                                              | Source-built server image                                                                           | Package manifests and image tag                     | Base image and runtime notices                                                                                     | Not audited as official MVP artifact                                            | EXPERIMENTAL                 |
| Built-in editor assets | Runtime browser editor    | First-run `--editor` / `prefetch-assets`                                                                                         | Extracted draw.io WAR webapp files                                                                  | Pinned draw.io `v31.1.5`                            | draw.io and bundled asset notices                                                                                  | Download is deterministic by URL and checksum; extraction smoke remains for M21 | RUNTIME ASSET                |

## Official MVP Artifact

The official artifact is the `drawio-mcp-server` npm package because it matches
M19's local stdio deployment:

```sh
npx -y drawio-mcp-server@<version> --editor
```

The package exposes the `drawio-mcp-server` binary and serves the built-in
editor on loopback. It must not require the browser extension, Docker, TLS,
remote deployment, model-provider keys or monorepo checkout state.

## Package Content Evidence

`npm pack --dry-run --json` before M20 content hardening showed the server
package included compiled test files and real-environment harness files.

M20 narrows `packages/drawio-mcp-server/package.json` `files` to compiled
runtime JavaScript while excluding:

- `build/**/*.test.js`;
- `build/real-environment/**`.

The package still includes:

- `build/index.js`;
- runtime tools;
- TLS helpers;
- asset downloader/manager;
- bundled `build/plugin/mcp-plugin.js`;
- package metadata and README.

## Packaging Decision

M20 implements strategy B: bundle private first-party runtime dependencies into
the distributable `drawio-mcp-server` artifact.

The development package may keep workspace dependencies for type checking and
tests, but the distributed package metadata must not contain:

- `workspace:*`;
- `cyberdraw-graph-model`;
- `cyberdraw-runtime-contract`;
- private first-party package versions as runtime dependencies.

The private packages remain:

- private;
- version `0.0.0`;
- workspace implementation details;
- unpublished;
- undocumented as public APIs.

## Distribution Build

The server build bundles only these private first-party runtime packages into
`build/vendored/`:

- `cyberdraw-graph-model`;
- `cyberdraw-runtime-contract`.

Third-party runtime dependencies remain external package dependencies.

`pack:artifact` stages a clean distribution package, writes package metadata
without workspace-only dependencies and runs `npm pack` over that staging
directory. The staging package and temporary npm `HOME` are removed on success
and failure; the tarball remains only in the explicit artifact destination.

## M20 Packaging Evidence

The generated `drawio-mcp-server-2.2.0.tgz` evidence:

- contains 73 package entries;
- contains `build/plugin/mcp-plugin.js`;
- contains `LICENSE.md`;
- contains `THIRD_PARTY_NOTICES.md`;
- contains no tests, coverage or real-environment harness files;
- contains no unresolved runtime references to `cyberdraw-graph-model`,
  `cyberdraw-runtime-contract` or `workspace:`;
- normalizes regular distributed files to `0644` and the CLI entrypoint to
  `0755`;
- installs in a clean temp app with temporary `HOME`;
- runs `drawio-mcp-server --help` from that clean install.
