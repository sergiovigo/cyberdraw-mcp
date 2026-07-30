# M20 Installation, Upgrade And Uninstall

## Status

READY FOR FINAL M20 AUDIT.

## User Installation

The intended user command is:

```sh
npx -y drawio-mcp-server@<version> --editor
```

Prerequisites:

- Node.js 22 or 24;
- an MCP client that can launch a stdio server;
- local browser access to the built-in editor URL;
- network access on first run unless draw.io assets are already cached.

M20 package evidence:

- the generated `drawio-mcp-server-2.2.0.tgz` contains bundled private
  first-party runtime code;
- the distributed package metadata contains no `workspace:*` ranges and no
  private `cyberdraw-*` runtime dependencies;
- clean install from the tarball succeeds in a temp app with temporary `HOME`;
- `drawio-mcp-server --help` runs from that clean install.

## Source Installation

Developer/source install remains reproducible from the repository lockfile:

```sh
corepack pnpm@10.8.1 install --frozen-lockfile
corepack pnpm@10.8.1 --filter drawio-mcp-server run build
corepack pnpm@10.8.1 --filter drawio-mcp-server run start -- --editor
```

Use source installation for development and audit work only. It is not the
target end-user distribution path.

## Editor Startup

With `--editor`, the server serves the built-in editor on loopback by default.
The first cold-cache startup downloads the pinned draw.io WAR and verifies both
SHA-256 and SHA-512 before extraction.

The official MVP profile remains:

- stdio MCP transport;
- `127.0.0.1` bind;
- built-in editor;
- local WebSocket bridge;
- no browser extension required;
- no TLS required for the loopback built-in editor path.

## Upgrade

For package users, upgrade is expected to mean changing the pinned package
version in the MCP client command:

```sh
npx -y drawio-mcp-server@<new-version> --editor
```

Upgrade does not mutate user diagrams, apply Architecture Intelligence plans or
perform rollback. It may update the cached draw.io asset version when a future
release changes the pinned provenance metadata.

## Uninstall / Cleanup

Uninstall is manual and scoped:

- remove the MCP server entry from the MCP client configuration;
- close the server process and local editor tab;
- remove browser extension installs only if the extension profile was used;
- remove TLS material only if `--tls-auto` was used and the user intentionally
  wants to delete local certificates;
- clear the draw.io editor asset cache only if the user wants to reclaim disk
  space or force a fresh asset download;
- clear npm/npx cache only if the user wants to force package refetch.

No M20 command deletes user diagrams automatically.

## M21 Acceptance Requirement

M21 must repeat the official user installation and functional flow from a clean
environment. M20's successful CLI help smoke is packaging evidence, not final
product acceptance.
