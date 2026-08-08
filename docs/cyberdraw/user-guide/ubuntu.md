# CyberDraw MCP Ubuntu Guide

## Status

M22.3 IMPLEMENTED / READY FOR REAL UBUNTU VALIDATION.

Ubuntu/Linux installer integration is implemented using the common M22
installation core. Automated validation has passed, but real Ubuntu host
validation and real Codex integration/use are still pending.

## Expected Product Profile

The expected Ubuntu profile should match the accepted MVP boundary:

- stdio MCP server;
- `drawio-mcp-server --editor`;
- editor bound to `127.0.0.1` by default;
- WebSocket bound to `127.0.0.1` by default;
- Codex or another supported MCP client launches the installed server;
- no public network exposure by default.

## Installer Command

From the repository checkout:

```sh
packages/drawio-mcp-server/installers/ubuntu/cyberdraw-ubuntu-installer.sh install \
  --tarball /path/to/drawio-mcp-server-2.2.0.tgz \
  --expected-sha256 <sha256> \
  --expected-sha512 <sha512>
```

Additional commands:

```sh
packages/drawio-mcp-server/installers/ubuntu/cyberdraw-ubuntu-installer.sh doctor
packages/drawio-mcp-server/installers/ubuntu/cyberdraw-ubuntu-installer.sh check

packages/drawio-mcp-server/installers/ubuntu/cyberdraw-ubuntu-installer.sh upgrade \
  --tarball /path/to/drawio-mcp-server-2.2.0.tgz \
  --expected-sha256 <sha256> \
  --expected-sha512 <sha512>

packages/drawio-mcp-server/installers/ubuntu/cyberdraw-ubuntu-installer.sh uninstall
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

## Default Paths

The supported Ubuntu/Linux default managed install path is:

```text
${XDG_DATA_HOME:-$HOME/.local/share}/CyberDraw MCP
```

The Codex config path remains:

```text
$HOME/.codex/config.toml
```

## Validation State

Automated validation covers:

- artifact checksum verification;
- rejection of non-self-contained tarballs;
- client configuration backup;
- port detection;
- process cleanup;
- doctor diagnostics;
- upgrade;
- uninstall.

Pending real Ubuntu evidence:

- accepted artifact install or upgrade on a real Ubuntu host;
- real Codex restart/load/use;
- final cleanup evidence.

## Network Warning

Binding to `0.0.0.0` or another LAN-reachable address is not the safe default.
That profile exposes unauthenticated HTTP and WebSocket surfaces and must be
explicitly selected.
