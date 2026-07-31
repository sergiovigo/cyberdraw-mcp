# CyberDraw MCP Ubuntu Guide

## Status

M22 DRAFT / INSTALLER VALIDATION PENDING.

Ubuntu is a target operating system for M22 supported local operations. Formal
Ubuntu installer validation has not yet been completed in this guide.

## Expected Product Profile

The expected Ubuntu profile should match the accepted MVP boundary:

- stdio MCP server;
- `drawio-mcp-server --editor`;
- editor bound to `127.0.0.1` by default;
- WebSocket bound to `127.0.0.1` by default;
- Codex or another supported MCP client launches the installed server;
- no public network exposure by default.

## What M22 Must Decide

M22 still needs evidence for:

- the supported Ubuntu installation command or script;
- artifact checksum verification;
- rejection of non-self-contained tarballs;
- client configuration backup;
- port detection;
- process cleanup;
- doctor diagnostics;
- upgrade;
- uninstall.

This guide intentionally does not invent final Ubuntu commands before M22
validation exists.

## Network Warning

Binding to `0.0.0.0` or another LAN-reachable address is not the safe default.
That profile exposes unauthenticated HTTP and WebSocket surfaces and must be
explicitly selected.
