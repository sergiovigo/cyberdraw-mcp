# M22.3 Ubuntu Installer Integration

## Status

IMPLEMENTED / READY FOR REAL UBUNTU VALIDATION.

M22.3 reuses the M22.1 installation core and adds the Ubuntu/Linux entrypoint
and wrapper. It does not close M22. Real Ubuntu host validation and real Codex
integration/use remain pending.

## Implementation

Files:

- `packages/drawio-mcp-server/scripts/installation/ubuntu-installer.mjs`
- `packages/drawio-mcp-server/installers/ubuntu/cyberdraw-ubuntu-installer.sh`
- `packages/drawio-mcp-server/scripts/installation/core.mjs`
- `packages/drawio-mcp-server/scripts/installation/core.test.mjs`

The Ubuntu wrapper is Bash, preserves all arguments, resolves its own location
instead of depending on the current working directory and fails clearly when
Node.js is unavailable. It does not require `sudo` for the supported default
profile.

## Default Paths

Ubuntu/Linux managed install directory:

```text
${XDG_DATA_HOME:-$HOME/.local/share}/CyberDraw MCP
```

Codex configuration:

```text
$HOME/.codex/config.toml
```

The path is user-scoped, deterministic, supports spaces and does not change the
macOS managed install path.

## Supported Commands

```sh
packages/drawio-mcp-server/installers/ubuntu/cyberdraw-ubuntu-installer.sh install \
  --tarball /path/to/drawio-mcp-server-2.2.0.tgz \
  --expected-sha256 <sha256> \
  --expected-sha512 <sha512>

packages/drawio-mcp-server/installers/ubuntu/cyberdraw-ubuntu-installer.sh doctor
packages/drawio-mcp-server/installers/ubuntu/cyberdraw-ubuntu-installer.sh check

packages/drawio-mcp-server/installers/ubuntu/cyberdraw-ubuntu-installer.sh upgrade \
  --tarball /path/to/drawio-mcp-server-2.2.0.tgz \
  --expected-sha256 <sha256> \
  --expected-sha512 <sha512>

packages/drawio-mcp-server/installers/ubuntu/cyberdraw-ubuntu-installer.sh uninstall
```

Supported options match the common installation contract:

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

## Network Profile

Default Ubuntu profile:

- profile: `localhost`;
- host: `127.0.0.1`;
- HTTP port: `3000`;
- WebSocket/extension port: `3333`;
- transport: `stdio`;
- editor: enabled;
- authenticated: false;
- LAN: false.

The LAN profile remains explicit opt-in with `--profile lan --lan-confirm`.
It exposes unauthenticated HTTP and WebSocket surfaces and is not remote
deployment support.

## Automated Evidence

Automated validation covers:

- Linux default path through `$HOME/.local/share/CyberDraw MCP`;
- `XDG_DATA_HOME` override;
- paths containing spaces;
- no regression to the macOS default path;
- Ubuntu wrapper path resolution from a different `cwd`;
- install manifest generation under the Linux path;
- Codex config generation and preservation of unrelated sections;
- localhost default profile;
- doctor/check with real MCP initialize and `tools/list` against the installed
  fixture binary;
- non-empty tool discovery;
- required tools:
  - `cyberdraw_create_diagram`;
  - `cyberdraw_analyze_structure`;
- upgrade preserving profile and running post-upgrade doctor;
- uninstall removing only the managed install and CyberDraw Codex block;
- process cleanup after the MCP probe.

The automated fixture uses temporary `HOME`, `XDG_DATA_HOME`, install and Codex
config paths. It does not modify the user's real `~/.codex/config.toml`.

## Pending Real Evidence

Before M22.3 can be marked COMPLETE, a real Ubuntu host must validate:

- accepted artifact checksum verification;
- install or upgrade with `drawio-mcp-server-2.2.0.tgz`;
- managed install under the selected Linux/XDG path;
- Codex config update and backup;
- doctor PASS including MCP initialize and `tools/list`;
- presence of `cyberdraw_create_diagram` and `cyberdraw_analyze_structure`;
- real Codex restart/load/use;
- uninstall or cleanup without residual processes.

## Limitations

- Real Ubuntu host validation is pending.
- Real Ubuntu Codex integration/use is pending.
- Windows remains pending and is not implemented by M22.3.
- M22 remains IN PROGRESS.
- This work does not add authentication, remote deployment, public beta,
  package publication, GitHub Release, new MCP tools or changed MCP contracts.
