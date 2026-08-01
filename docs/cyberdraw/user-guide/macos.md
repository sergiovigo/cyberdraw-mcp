# CyberDraw MCP macOS Guide

## Status

M22 INSTALLER IMPLEMENTED / MANUAL MACOS AUDIT PENDING.

The accepted MVP has been transferred and installed on a MacBook Pro outside
the original development environment. That real installation is useful evidence,
but M22 still needs a final manual macOS audit of the supported installer flow.

## Installer Command

From the repository checkout:

```sh
packages/drawio-mcp-server/installers/macos/cyberdraw-macos-installer.sh install \
  --tarball /path/to/drawio-mcp-server-2.2.0.tgz \
  --expected-sha256 <sha256> \
  --expected-sha512 <sha512>
```

Additional commands:

```sh
packages/drawio-mcp-server/installers/macos/cyberdraw-macos-installer.sh doctor
packages/drawio-mcp-server/installers/macos/cyberdraw-macos-installer.sh check

packages/drawio-mcp-server/installers/macos/cyberdraw-macos-installer.sh upgrade \
  --tarball /path/to/drawio-mcp-server-2.2.0.tgz \
  --expected-sha256 <sha256> \
  --expected-sha512 <sha512>

packages/drawio-mcp-server/installers/macos/cyberdraw-macos-installer.sh uninstall
```

Useful options:

- `--install-dir <path>`;
- `--codex-config <path>`;
- `--profile localhost|lan`;
- `--host <host>`;
- `--http-port <number>`;
- `--websocket-port <number>`;
- `--lan-confirm`;
- `--yes`.

## Current Lessons

The macOS installation showed that:

- the self-contained M20 artifact must be distinguished from an ordinary
  workspace tarball;
- a wrong tarball can try to resolve `cyberdraw-graph-model@0.0.0` from npm;
- Linux and macOS paths are not interchangeable;
- the output directory must be resolved on the machine that generates or uses
  the artifact;
- Codex may need time or a restart to recognize a newly configured server
  namespace;
- the editor should be opened through `127.0.0.1` on the local Mac for the safe
  profile.

## Localhost Profile

The safe default profile is:

- stdio MCP server;
- `drawio-mcp-server --editor`;
- editor host `127.0.0.1`;
- WebSocket host `127.0.0.1`;
- no LAN exposure;
- no authentication requirement because the service is loopback-only.

M22 should make this profile the default macOS installer behavior.

## LAN Profile

The LAN profile is not the default.

If a user configures `0.0.0.0` or another LAN-reachable bind address, CyberDraw
exposes local HTTP and WebSocket surfaces to the reachable network. There is no
authentication in that profile today.

M22 must require explicit user acknowledgement before writing a LAN profile.

## Artifact Validation

The macOS installer validates before configuration changes:

- package name and version;
- SHA-256;
- SHA-512;
- absence of `workspace:*`;
- absence of private `cyberdraw-*` runtime dependencies;
- presence of `drawio-mcp-server`;
- presence of `LICENSE.md` and `THIRD_PARTY_NOTICES.md`.

It rejects tarballs that try to resolve private packages such as
`cyberdraw-graph-model@0.0.0` from npm.

## Codex Configuration

The installer updates only:

```toml
[mcp_servers.cyberdraw]
```

Existing Codex configuration is backed up before modification. Other MCP server
entries are preserved.

The installer does not modify the user's real Codex config during automated
tests; tests use temporary config files.
