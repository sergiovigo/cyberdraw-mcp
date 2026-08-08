# M22 macOS Installer

## Status

COMPLETE.

M22.2 has automated validation and real macOS host validation. M22 remains open
because Ubuntu, Windows and cross-OS closure are pending.

The first supported macOS installer implementation lives in:

```text
packages/drawio-mcp-server/installers/macos/cyberdraw-macos-installer.sh
```

It delegates to the Node implementation:

```text
packages/drawio-mcp-server/scripts/installation/macos-installer.mjs
packages/drawio-mcp-server/scripts/installation/core.mjs
```

## Scope

Implemented:

- `install`;
- `doctor`;
- `check`;
- `upgrade`;
- `uninstall`;
- tarball validation;
- SHA-256/SHA-512 verification;
- `workspace:*` rejection;
- private `cyberdraw-*` runtime dependency rejection;
- local manifest generation;
- Codex config backup and `[mcp_servers.cyberdraw]` upsert;
- default localhost profile;
- explicit LAN profile opt-in;
- structured PASS/WARN/FAIL/NOT CHECKED doctor output;
- controlled MCP handshake probe;
- `tools/list` probe;
- required CyberDraw tool detection;
- scoped uninstall.

Not implemented:

- authentication;
- remote deployment;
- public beta packaging;
- Homebrew;
- MSI;
- Ubuntu installer;
- Windows installer;
- fully atomic upgrade rollback.

## Real macOS Validation

Evidence level: REAL-PROVEN for managed install state, post-fix upgrade,
doctor and Codex integration/use on the supported macOS localhost installer
flow. A full post-fix clean install run is not recorded as REAL-PROVEN.

Host:

- OS: macOS / `darwin`;
- Node.js: `24.2.0`.

Artifact:

- file: `drawio-mcp-server-2.2.0.tgz`;
- SHA-256:
  `57ba4e26955206079f44279ca0b552b9a32a76e794eb0dba78a8e00191793013`;
- SHA-512:
  `8b2676aa9380d220e202b0ee2e411e0a264481ef45feb03624a2bd3360aa0ffa7a1314edc652b38ac5e01117821cd8f91a5a33dd97c2417557c81d241723fe04`.

Managed install:

```text
/Users/sergiovigo/Library/Application Support/CyberDraw MCP
```

The first real install attempt created the managed installation, then failed
closed before updating Codex `config.toml` because the conservative TOML parser
rejected real Codex quoted table/key shapes. PR #54 / commit `04185bb` fixed
that parser issue before the successful real upgrade below.

Supported profile:

| Field         | Value       |
| ------------- | ----------- |
| Profile       | `localhost` |
| Host          | `127.0.0.1` |
| HTTP port     | `3000`      |
| WebSocket     | `3333`      |
| Transport     | `stdio`     |
| Editor        | `true`      |
| Authenticated | `false`     |
| LAN           | `false`     |

Codex configuration result:

```toml
[mcp_servers.cyberdraw]
command = "/Users/sergiovigo/Library/Application Support/CyberDraw MCP/node_modules/.bin/drawio-mcp-server"
args = ["--editor","--host","127.0.0.1","--http-port","3000","--extension-port","3333"]
```

Real upgrade result:

- action: `upgrade`;
- manifest valid;
- `config.toml` backup created;
- previous managed installation backup created;
- `doctor.ok = true`.

Real doctor result:

| Check              | Result |
| ------------------ | ------ |
| operating-system   | PASS   |
| node-version       | PASS   |
| manifest           | PASS   |
| binary             | PASS   |
| codex-config       | PASS   |
| profile            | PASS   |
| http-port          | PASS   |
| websocket-port     | PASS   |
| residual-processes | PASS   |
| MCP initialize     | PASS   |
| tools/list         | PASS   |
| process-cleanup    | PASS   |

The real `tools/list` result discovered `30` tools and included both required
CyberDraw tools:

- `cyberdraw_create_diagram`;
- `cyberdraw_analyze_structure`.

Real Codex integration:

- Codex was restarted after installation/config update;
- CyberDraw MCP loaded from a new Codex session;
- the MCP was used successfully from Codex.

This is not only a synthetic doctor test; it includes real installer, doctor,
upgrade and Codex usage evidence on macOS. It does not claim a complete post-fix
clean install execution.

## TOML Compatibility Incident

The first real macOS validation exposed a conservative TOML parser defect: real
Codex configuration can contain quoted table segments and quoted keys.

Resolved by PR #54 / commit `04185bb`:

- quoted table segments;
- quoted keys;
- keys containing `=`;
- structural canonicalization for dotted keys;
- exact detection of managed `mcp_servers.cyberdraw`;
- fail-closed behavior retained for invalid TOML, duplicate sections and
  multiple managed CyberDraw blocks.
