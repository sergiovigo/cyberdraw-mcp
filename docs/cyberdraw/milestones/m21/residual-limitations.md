# M21 Residual Limitations

## Status

OPEN POST-MVP LIMITATIONS.

M21 closes the MVP with limitations. These limitations are not hidden failures;
they define the boundary between the accepted internal/distributable MVP and
future release or public beta work.

## Licensing And Notices

The server package license and `THIRD_PARTY_NOTICES.md` are present in the
artifact. Runtime dependencies and bundled first-party code are inventoried by
M20.

Remaining limitations:

- the draw.io WAR contains bundled assets whose notice review is not complete;
- icon, font, stencil and template notices inside the WAR need final public
  distribution review;
- M21 does not claim complete draw.io notices for public beta.

Impact:

- internal MVP is accepted;
- external distributable MVP is ready with limitations;
- public beta remains not ready.

## Draw.io Extraction

M20/M21 prove pinned URL download and checksum verification before extraction.

Remaining limitations:

- extraction is not claimed atomic;
- project-specific path traversal proof for the WAR extractor is not complete;
- offline cold-cache startup fails by design if the pinned WAR is unavailable;
- warm-cache startup is supported after assets have been verified and cached.

## Dependency Audit

Production dependency audit is expected to remain the blocking gate.

Known residual diagnostic advisory:

- `GHSA-mh99-v99m-4gvg` in `brace-expansion` through dev/test
  Jest/Istanbul/glob chains.

M21 does not force incompatible transitive major upgrades and does not alter CI
audit policy.

## Client Coverage

Accepted:

- stdio MCP protocol handshake against the installed artifact;
- Codex-compatible command/config shape with a temporary isolated server
  command.

Limitations:

- an interactive Codex UX acceptance pass remains post-MVP release/support work;
- Claude Desktop, Claude Code, Zed, OpenCode, oterm and other MCP clients are
  documented or compatible in principle, not accepted product clients.

## Runtime Compatibility

M21 acceptance ran in the current environment on Node `v24.18.0`.

Node 22 remains part of the supported baseline and CI lanes, but a separate
clean product acceptance replay on Node 22 should be run before a release
policy that requires both Node lanes as real product environments.

## Product Scope

The final MVP intentionally excludes:

- public semantic diff;
- incremental analysis;
- persistence;
- mutation executor;
- approval workflows;
- rollback;
- transactions;
- global identity;
- fuzzy matching;
- authenticated remote deployment;
- server-side LLM/provider integration.
