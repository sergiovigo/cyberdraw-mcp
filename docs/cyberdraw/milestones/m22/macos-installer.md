# M22 macOS Installer

## Status

IMPLEMENTED / READY FOR MACOS MANUAL AUDIT.

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

## Manual macOS Audit Pending

M22.2 still needs a real macOS audit using the accepted artifact:

- clean macOS install directory;
- temporary or backed-up Codex config;
- local tarball with known SHA-256/SHA-512;
- localhost install;
- Codex restart or reload if required;
- doctor output;
- editor launch;
- safe uninstall;
- LAN profile warning review without declaring LAN secure.
