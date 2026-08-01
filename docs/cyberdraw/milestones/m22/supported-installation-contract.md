# M22 Supported Installation Contract

## Status

IMPLEMENTED FOR M22.1 / READY FOR AUDIT.

This document records the first supported local installation contract used by
the macOS installer. It is not an MCP contract and does not add public tools,
schemas, endpoints or runtime protocol behavior.

## Contract Version

`m22-installation-contract-v1`

## Runtime Requirements

| Field              | Value                                       |
| ------------------ | ------------------------------------------- |
| Package name       | `drawio-mcp-server`                         |
| Node minimum       | Node.js `22`                                |
| Package manager    | `corepack pnpm@10.8.1` for local install    |
| Artifact source    | Explicit local tarball path                 |
| Default profile    | `localhost`                                 |
| Default host       | `127.0.0.1`                                 |
| Default HTTP port  | `3000`                                      |
| Default WS port    | `3333`                                      |
| Codex server entry | `[mcp_servers.cyberdraw]`                   |
| Manifest path      | `<install-dir>/cyberdraw-installation.json` |

The installer must not silently install from npm by package name. The user must
provide a local tarball.

## Tarball Validation

Before installation or Codex configuration changes, the installer validates:

- file exists and is readable;
- SHA-256;
- SHA-512;
- `package/package.json` exists and is valid JSON;
- package name is `drawio-mcp-server`;
- package version is present;
- `bin.drawio-mcp-server` points to `build/index.js`;
- no `workspace:*` range exists in packaged metadata;
- no runtime dependency named `cyberdraw-*` exists in dependencies,
  optionalDependencies or peerDependencies.

The known bad artifact shape that tries to resolve
`cyberdraw-graph-model@0.0.0` from npm is rejected before install.

## Profiles

### Localhost

Default profile:

- host: `127.0.0.1`;
- transport: stdio;
- editor enabled;
- no LAN exposure.

### LAN

LAN profile:

- host defaults to `0.0.0.0`;
- requires explicit `--lan-confirm`;
- warns that HTTP and WebSocket are exposed;
- has no authentication;
- is not remote deployment support.

## Commands

Implemented command surface:

```sh
packages/drawio-mcp-server/installers/macos/cyberdraw-macos-installer.sh install \
  --tarball /path/to/drawio-mcp-server-2.2.0.tgz \
  --expected-sha256 <sha256> \
  --expected-sha512 <sha512>

packages/drawio-mcp-server/installers/macos/cyberdraw-macos-installer.sh doctor
packages/drawio-mcp-server/installers/macos/cyberdraw-macos-installer.sh check

packages/drawio-mcp-server/installers/macos/cyberdraw-macos-installer.sh upgrade \
  --tarball /path/to/drawio-mcp-server-2.2.0.tgz \
  --expected-sha256 <sha256> \
  --expected-sha512 <sha512>

packages/drawio-mcp-server/installers/macos/cyberdraw-macos-installer.sh uninstall
```

Supported options:

- `--install-dir <path>`;
- `--codex-config <path>`;
- `--expected-sha256 <hex>`;
- `--expected-sha512 <hex>`;
- `--profile localhost|lan`;
- `--host <host>`;
- `--http-port <number>`;
- `--websocket-port <number>`;
- `--lan-confirm`;
- `--yes`.

## Local Manifest

The installer writes:

```text
<install-dir>/cyberdraw-installation.json
```

The manifest records:

- contract version;
- package name;
- package version;
- install directory;
- tarball path and filename;
- SHA-256;
- SHA-512;
- profile;
- host;
- HTTP port;
- WebSocket port;
- stdio/editor flags;
- Codex server entry name;
- creation timestamp.

## Codex Configuration

The installer updates only:

```toml
[mcp_servers.cyberdraw]
```

Existing Codex configuration is backed up before modification. Other MCP server
entries are preserved. Uninstall removes only the CyberDraw entry.

The generated entry uses the installed package binary path and explicit
`--editor`, `--host`, `--http-port` and `--extension-port` arguments.

## Doctor Status Model

Doctor/check returns structured JSON with:

- `PASS`;
- `WARN`;
- `FAIL`;
- `NOT CHECKED`.

Current doctor checks include:

- operating system;
- Node version;
- manifest;
- binary executable;
- Codex config;
- profile;
- HTTP port availability;
- WebSocket port availability;
- residual managed processes whose command includes the install directory and
  `drawio-mcp-server`;
- controlled MCP initialize handshake;
- `tools/list`;
- non-empty tool discovery;
- required CyberDraw tools:
  - `cyberdraw_create_diagram`;
  - `cyberdraw_analyze_structure`;
- process cleanup status.

The doctor reports the observed tool count from `tools/list`, but the contract
does not hardcode a fixed total. A valid installed server must return a
non-empty tools list and include the two required CyberDraw tools above.

`NOT CHECKED` is reserved for explicit reasons such as missing installation
metadata or an unavailable binary.

## Upgrade

Upgrade requires an existing manifest and a new valid local tarball. It:

- validates the new tarball before replacement;
- preserves profile and ports unless overridden;
- backs up the previous manifest;
- backs up Codex config before rewriting;
- prepares the replacement in a temporary install directory;
- runs doctor after replacement;
- restores the previous managed install and Codex config when post-upgrade
  doctor fails and safe restoration is available.

The replacement is not claimed fully atomic and is not described as complete
rollback of product state or diagrams.

## Uninstall

Uninstall:

- reads the managed manifest;
- refuses unsafe targets such as the current working directory, root, home or a
  directory without a managed manifest;
- refuses to delete a managed directory that contains unrecognized top-level
  content requiring manual review;
- attempts to stop only managed processes whose command includes the install
  directory and `drawio-mcp-server`;
- removes only the managed install directory;
- backs up Codex config;
- removes only `[mcp_servers.cyberdraw]`;
- preserves external tarballs.

## Test Evidence

Automated test coverage:

- valid tarball validation;
- `workspace:*` rejection;
- private `cyberdraw-*` runtime dependency rejection;
- `cyberdraw-graph-model@0.0.0` rejection;
- wrong package name rejection;
- checksum mismatch rejection;
- malicious tarball layout rejection for path traversal, absolute paths,
  symlinks, missing package metadata, duplicate package metadata and entries
  outside `package/`;
- manifest generation;
- Codex config preservation;
- invalid or ambiguous Codex config rejection without overwrite;
- CyberDraw entry update;
- localhost default;
- LAN opt-in requirement;
- uninstall scope safety;
- doctor process-cleanup behavior plus MCP handshake and tools/list probe;
- fixture install without touching real Codex config;
- upgrade manifest backup;
- upgrade validation failure before replacement;
- post-upgrade doctor failure restoration;
- unsafe uninstall target and unrecognized managed-content rejection.

Manual macOS evidence remains pending for M22.2 audit.
