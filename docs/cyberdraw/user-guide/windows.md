# CyberDraw MCP Windows Guide

## Status

M22 DRAFT / INSTALLER VALIDATION PENDING.

Windows is a target operating system for M22 supported local operations. The
installer format and validation path are not yet decided.

## Open Windows Decisions

M22 must decide and validate:

- whether the supported path uses PowerShell, a batch script, an installer
  package or another mechanism;
- whether WSL is supported, optional or out of scope;
- where CyberDraw should install by default;
- where Codex or other MCP client configuration should be backed up and
  updated;
- how to detect ports and residual processes;
- how upgrade and uninstall should behave.

This guide does not assume PowerShell, WSL or MSI as accepted product decisions.

## Expected Product Profile

The intended product boundary remains:

- local stdio server launch;
- built-in editor;
- loopback HTTP and WebSocket by default;
- no remote exposure by default;
- no authentication claim for LAN or remote profiles.

## Artifact Validation Requirement

The future Windows installer must validate the same artifact contract as other
operating systems:

- expected package name and version;
- SHA-256 and SHA-512;
- no `workspace:*`;
- no private `cyberdraw-*` runtime dependencies;
- binary present;
- notices present.
