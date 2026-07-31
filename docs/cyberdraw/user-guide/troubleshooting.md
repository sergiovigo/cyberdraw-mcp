# CyberDraw MCP Troubleshooting

## Status

M22 DRAFT / DOCTOR NOT YET IMPLEMENTED.

M22 plans a doctor command or equivalent diagnostic script. Until that exists,
this document records observed failure modes and the evidence that a future
doctor should collect.

## Non-Self-Contained Tarball

Symptom:

- installation tries to fetch private packages such as
  `cyberdraw-graph-model@0.0.0` from npm.

Cause:

- the tarball is not the self-contained M20 distribution artifact, or its
  packaged `package.json` still contains private workspace runtime dependencies.

M22 requirement:

- installer validation must reject this before changing client configuration.

## `workspace:*` In Packaged Metadata

Symptom:

- package installation fails outside the monorepo.

Cause:

- an artifact still references pnpm workspace ranges.

M22 requirement:

- packaged metadata must be inspected and any `workspace:*` range must fail
  validation.

## macOS Paths Used On Linux

Symptom:

- install or configuration points to a path that does not exist on the target
  system.

Cause:

- an artifact, install output path or MCP client command was copied from another
  operating system without resolving it locally.

M22 requirement:

- installers must resolve paths on the target machine and record the selected
  install directory.

## `MCP_DOCKER` Configuration Confusion

Symptom:

- the wrong deployment profile is selected, or a local stdio setup behaves like
  a Docker/HTTP profile.

Cause:

- inherited configuration or environment assumptions may not match the official
  MVP profile.

M22 requirement:

- installation docs and diagnostics must distinguish local stdio, Docker and
  LAN profiles clearly.

## Codex Namespace Recognition Delay

Symptom:

- Codex does not immediately show or use the newly configured CyberDraw server
  namespace.

Possible causes:

- client configuration was edited while Codex was already running;
- the client has not reloaded MCP server configuration;
- the configured command points to the wrong artifact or path.

M22 requirement:

- installer output should state when a client restart or config reload is
  required.

## Ports And Residual Processes

Symptom:

- editor or WebSocket startup fails because a port is already in use;
- a previous server process keeps running after a test or manual session.

M22 requirement:

- doctor diagnostics should report selected ports, active CyberDraw processes
  and cleanup guidance.

## Host `0.0.0.0`

Symptom:

- the editor or WebSocket is reachable from other machines on the network.

Cause:

- the server was configured with a wildcard or LAN-reachable bind address.

Risk:

- CyberDraw's local HTTP and WebSocket surfaces are unauthenticated in this
  profile.

M22 requirement:

- `127.0.0.1` remains the default;
- LAN exposure requires explicit opt-in and warning text.
