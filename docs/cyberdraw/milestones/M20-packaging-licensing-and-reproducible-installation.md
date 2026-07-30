# M20 - Packaging, Licensing And Reproducible Installation

## Status

IN PROGRESS / READY FOR FINAL M20 AUDIT.

M20 converts the M19 internal MVP definition into a packaging, licensing and
installation plan with concrete release evidence. It does not close final
product acceptance; M21 remains responsible for clean end-to-end acceptance.

## Verdict

READY FOR FINAL M20 AUDIT.

M20 resolved draw.io asset provenance for the built-in editor by pinning the
downloaded WAR and verifying SHA-256/SHA-512 before extraction. It also
identified the official MVP artifact, improved package-content hygiene and
implemented the M20 packaging decision:

- `cyberdraw-graph-model@0.0.0` remains a private workspace implementation
  detail;
- `cyberdraw-runtime-contract@0.0.0` remains a private workspace
  implementation detail;
- both first-party runtime packages are bundled into the distributable
  `drawio-mcp-server` artifact;
- the distributed package metadata no longer declares private `cyberdraw-*`
  runtime dependencies or `workspace:*` ranges.

The resulting tarball installs in a clean directory with a temporary `HOME` and
passes a bounded CLI smoke check. M20 still does not close final end-to-end
product acceptance; M21 remains responsible for replaying the full Codex ->
CyberDraw MCP -> draw.io flow from a clean installation.

## Scope

M20 covers:

- official MVP artifact identification;
- package content inspection;
- draw.io asset version/provenance pinning;
- release metadata shape;
- license and notice inventory state;
- user and source installation policy;
- upgrade and uninstall guidance;
- dependency-audit state;
- blocker register for M21.

M20 does not add MCP tools, public schemas, runtime commands, persistence,
mutation execution, semantic diff exposure, incremental analysis, rollback,
transactions, authentication or provider integration.

## Official MVP Artifact

The intended official MVP artifact remains the local stdio server with built-in
editor:

```text
MCP client -> stdio -> drawio-mcp-server --editor
                         |
                         v
                 loopback HTTP editor
                         |
                         v
                 loopback WebSocket bridge
```

Artifact classification:

| Artifact                        | MVP status                     | Notes                                                                                                                     |
| ------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `drawio-mcp-server` npm package | OFFICIAL MVP ARTIFACT          | Current package name and binary. Private first-party runtime packages are bundled into the distributable server artifact. |
| Source release                  | OPTIONAL COMPATIBLE ARTIFACT   | Reproducible for developers through `pnpm@10.8.1`; not the preferred user install path.                                   |
| Chrome extension zip            | OPTIONAL COMPATIBLE ARTIFACT   | Built by extension workflows, not required for the official local stdio MVP.                                              |
| Firefox extension zip           | OPTIONAL COMPATIBLE ARTIFACT   | Requires TLS/WSS; not the MVP default.                                                                                    |
| Docker image                    | EXPERIMENTAL / NOT MVP DEFAULT | Useful for HTTP deployments, outside the official local stdio MVP profile.                                                |
| Built-in editor draw.io assets  | RUNTIME ASSET                  | Downloaded from a pinned upstream release and cached locally.                                                             |

Detailed strategy:

- [`m20/artifact-strategy.md`](m20/artifact-strategy.md)

## Release Metadata

Current development manifests remain at version `2.2.0`.

M20 does not increment versions or create tags. The next release version remains
a release-management decision. A release manifest must record at minimum:

- product name: CyberDraw MCP;
- package name: `drawio-mcp-server`;
- package version;
- source commit;
- Node baseline: Node.js 22 minimum, Node 22/24 CI lanes;
- package manager baseline: `pnpm@10.8.1`;
- draw.io asset version and checksums;
- package tarball checksum;
- license inventory reference;
- production and dev audit state;
- known limitations.

Detailed manifest shape:

- [`m20/reproducibility-evidence.md`](m20/reproducibility-evidence.md)
- [`m20/release-manifest.json`](m20/release-manifest.json)

## Draw.io Asset Provenance

M20 pins built-in editor assets to:

| Field            | Value                                                                                                                              |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Upstream project | `jgraph/drawio`                                                                                                                    |
| Release tag      | `v31.1.5`                                                                                                                          |
| Asset            | `draw.war`                                                                                                                         |
| URL              | `https://github.com/jgraph/drawio/releases/download/v31.1.5/draw.war`                                                              |
| Size             | `52730014` bytes                                                                                                                   |
| SHA-256          | `43b0437762cf25375e233726d6539792584c4bd38176e4eceae5ea4359090278`                                                                 |
| SHA-512          | `56ea7da0efd96f70aca9d0190a87adc5290660c0941291f704bb94c407f7a07f380251a61dcbed77fff25661cd990668724acd7cd21ed0b1a3c16338e3018b38` |

The downloader fails closed if either checksum differs before extraction.

Detailed evidence:

- [`m20/drawio-asset-provenance.md`](m20/drawio-asset-provenance.md)

## Installation, Upgrade And Cleanup

User installation remains the intended release path:

```sh
npx -y drawio-mcp-server@<version> --editor
```

This path is now technically packageable as a single server tarball. M21 must
still validate the full user workflow from a clean installation before any final
external MVP readiness claim.

Source installation remains reproducible for developers:

```sh
corepack pnpm@10.8.1 install --frozen-lockfile
corepack pnpm@10.8.1 --filter drawio-mcp-server run build
corepack pnpm@10.8.1 --filter drawio-mcp-server run start -- --editor
```

Detailed guidance:

- [`m20/installation-upgrade-uninstall.md`](m20/installation-upgrade-uninstall.md)

## License Inventory

M20 records an updated license inventory for the official artifact candidate
and runtime asset. The inventory is not yet complete enough for external
distribution because draw.io WAR bundled notices require final review. The
first-party package distribution question is resolved by bundling the private
runtime implementation into the server artifact without publishing those
packages as public APIs.

Detailed inventory:

- [`m20/license-inventory.md`](m20/license-inventory.md)

## Dependency Audit State

Expected audit policy after the M19 CI governance split:

- production audit is blocking;
- dev/full audit remains visible diagnostic;
- residual dev/test advisory may remain:
  `GHSA-mh99-v99m-4gvg` in `brace-expansion` chains through Jest/Istanbul/glob
  tooling.

M20 does not remediate dev/test transitive chains by forcing incompatible major
versions.

## Blocker Register

| M19 blocker                                     | M20 state          | Evidence                                                                                                  | Owner          |
| ----------------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------- | -------------- |
| Clean/reproducible installation                 | RESOLVED FOR M20   | Self-contained server tarball installs in a clean temp app with temporary `HOME`; CLI help smoke passes.  | M21 acceptance |
| Deterministic editor startup and asset behavior | PARTIALLY RESOLVED | draw.io WAR is pinned and checksum verified; cold-cache functional editor flow remains for M21.           | M21            |
| Complete licenses/notices                       | PARTIALLY RESOLVED | Server runtime inventory exists; draw.io WAR notice review remains incomplete.                            | M21/release    |
| draw.io asset provenance/pinning                | RESOLVED           | `v31.1.5` URL, size, SHA-256 and SHA-512 recorded and enforced.                                           | M20            |
| Release versioning policy                       | PARTIALLY RESOLVED | Release manifest fields and current version are documented; final version/tag not selected.               | M21/release    |
| Accepted packaging strategy                     | RESOLVED           | Private first-party runtime packages are bundled into the `drawio-mcp-server` artifact and not published. | M20            |
| Clean real product acceptance                   | NOT M20            | Remains M21 responsibility.                                                                               | M21            |

## M21 Readiness

READY FOR M21 AFTER FINAL M20 AUDIT.

M21 can start after the final M20 audit confirms the artifact, license and
provenance evidence. M21 must still perform clean real product acceptance and
must not inherit M20's bounded CLI smoke as product acceptance.

## Explicit Non-Goals

- no public semantic diff MCP tool;
- no public graph identity;
- no new public DTO;
- no mutation executor;
- no persistence;
- no approval workflow;
- no rollback or transactions;
- no incremental analysis implementation;
- no LLM/provider integration;
- no prompt-to-diagram expansion;
- no remote deployment product claim;
- no clean-machine product acceptance claim.
