# CyberDraw MCP macOS Guide

## Status

M22 DRAFT / INSTALLER VALIDATION PENDING.

The accepted MVP has been transferred and installed on a MacBook Pro outside
the original development environment. That real installation is useful evidence,
but M22 still needs a supported macOS installer flow with repeatable validation.

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

## Artifact Validation Requirement

The macOS installer should validate before configuration changes:

- package name and version;
- SHA-256;
- SHA-512;
- absence of `workspace:*`;
- absence of private `cyberdraw-*` runtime dependencies;
- presence of `drawio-mcp-server`;
- presence of `LICENSE.md` and `THIRD_PARTY_NOTICES.md`.

These checks are M22 requirements. This guide does not claim that the macOS
installer already implements them.
