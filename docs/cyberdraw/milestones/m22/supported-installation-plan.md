# M22 Supported Installation Plan

## Status

IN PROGRESS.

M22.1 Supported Installation Contract and M22.2 macOS Supported Installer are
complete. M22.3 Ubuntu Installer Integration is implemented and ready for real
Ubuntu validation. Windows and cross-OS closure remain pending.

## Inputs

Authoritative inputs:

- M19 product definition and readiness matrix;
- M20 self-contained `drawio-mcp-server` artifact contract;
- M21 final MVP acceptance evidence;
- the post-M21 real MacBook Pro installation feedback.

M22 treats the M21 artifact as the functional baseline. It may improve
installation and operations, but not diagramming behavior.

## Installer Contract

The installer must validate an artifact before installing or editing client
configuration.

Required checks:

| Check                | Required behavior                                                               |
| -------------------- | ------------------------------------------------------------------------------- |
| Package name         | Must be `drawio-mcp-server`.                                                    |
| Package version      | Must match the selected version.                                                |
| SHA-256              | Must match the expected artifact digest.                                        |
| SHA-512              | Must match the expected artifact digest.                                        |
| `workspace:*` ranges | Must be absent from packaged metadata.                                          |
| Private runtime deps | Packaged runtime dependencies must not include private `cyberdraw-*` packages.  |
| Binary               | `drawio-mcp-server` must be present and executable through the package manager. |
| License files        | `LICENSE.md` and `THIRD_PARTY_NOTICES.md` must be present.                      |
| Node baseline        | Installed Node.js must satisfy the accepted baseline.                           |
| Host profile         | `localhost` is default; LAN requires explicit opt-in.                           |

Failure before configuration should leave no modified MCP client configuration.
Failure after a configuration backup should leave the backup path visible in the
error output.

Implemented contract details:

- [`supported-installation-contract.md`](supported-installation-contract.md)
- [`macos-installer.md`](macos-installer.md)
- [`ubuntu-installer.md`](ubuntu-installer.md)

## Supported Profiles

### Localhost

The default supported profile uses:

- stdio MCP server launch;
- `drawio-mcp-server --editor`;
- HTTP editor on `127.0.0.1`;
- WebSocket bridge on `127.0.0.1`;
- explicit ports or installer-selected free ports;
- no browser extension requirement;
- no remote bind.

### LAN

LAN is an opt-in local operations profile. It may bind to a user-selected LAN
address or wildcard host only after an explicit acknowledgement.

The installer and documentation must state that this profile exposes
unauthenticated local HTTP and WebSocket control surfaces to the reachable
network.

### Unsupported

M22 does not support:

- public internet exposure;
- reverse-proxy product deployment;
- authenticated remote operation;
- multi-user hosting;
- cloud execution;
- server-side LLM/provider operation.

## Doctor Contract

The doctor command or script should be read-only by default and report:

- operating system and architecture;
- Node version;
- package manager availability;
- selected CyberDraw artifact name, version and checksum;
- installed binary path;
- MCP client configuration entry;
- backup path, if one exists;
- editor host and port;
- WebSocket host and port;
- port availability;
- active CyberDraw processes;
- controlled MCP initialize handshake;
- `tools/list` result;
- observed tool count;
- presence of `cyberdraw_create_diagram`;
- presence of `cyberdraw_analyze_structure`;
- draw.io asset cache state;
- known dev/test advisory status if dependency diagnostics are included.

The doctor should not start mutating operations unless explicitly requested. If
it starts the server for MCP probing, it must stop that process and report
whether any managed process remains.

## Upgrade Contract

Upgrade means selecting a different `drawio-mcp-server` artifact version and
updating client configuration to point to it.

Upgrade does not mean:

- rollback of diagrams;
- migration of persisted CyberDraw state;
- Architecture Intelligence plan execution;
- mutation replay;
- cache compatibility guarantee beyond documented editor assets.

The upgrade path must preserve a backup of the prior client configuration and
the prior managed install. The replacement must be validated before touching
the existing install. If the post-upgrade doctor fails, the supported behavior
is safe restoration when available, or an explicit FAILED/PARTIAL state with
the backup location and manual recovery instructions. M22 does not claim full
rollback of diagrams or product state.

## Uninstall Contract

Uninstall must be scoped and user-confirmed.

It may remove:

- CyberDraw-managed MCP client entries;
- CyberDraw-managed install directory;
- CyberDraw-managed logs;
- CyberDraw-managed draw.io asset cache if selected;
- temporary installer files.

It must not remove:

- user diagrams;
- unrelated MCP servers;
- unrelated npm/pnpm cache entries unless the user explicitly requests broad
  package-manager cleanup;
- the user's entire client configuration.

## OS Acceptance Matrix

| OS      | Status                                  | Required evidence                                                                                                                                                  |
| ------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| macOS   | COMPLETE / REAL-PROVEN                  | Managed install/upgrade, Codex config, localhost profile, real doctor and Codex use.                                                                               |
| Ubuntu  | IMPLEMENTED / READY FOR REAL VALIDATION | Automated Linux/XDG wrapper, fixture install, Codex config, doctor with MCP initialize and tools/list, upgrade, uninstall. Real Ubuntu host and Codex use pending. |
| Windows | PENDING / NOT IMPLEMENTED               | Clean install, Codex config, localhost editor, create/analyze smoke, doctor, uninstall.                                                                            |

Each OS row must record:

- OS version;
- shell used;
- Node version;
- artifact checksum;
- install path;
- client config path;
- editor URL;
- cleanup result;
- known limitations.

macOS recorded evidence:

- OS: macOS / `darwin`;
- Node.js: `24.2.0`;
- artifact: `drawio-mcp-server-2.2.0.tgz`;
- SHA-256:
  `57ba4e26955206079f44279ca0b552b9a32a76e794eb0dba78a8e00191793013`;
- SHA-512:
  `8b2676aa9380d220e202b0ee2e411e0a264481ef45feb03624a2bd3360aa0ffa7a1314edc652b38ac5e01117821cd8f91a5a33dd97c2417557c81d241723fe04`;
- managed install:
  `/Users/sergiovigo/Library/Application Support/CyberDraw MCP`;
- first install attempt: managed installation created, then fail-closed before
  Codex `config.toml` update due to the TOML compatibility incident;
- profile: `localhost`, `127.0.0.1`, HTTP `3000`, WebSocket `3333`,
  transport `stdio`, editor enabled, unauthenticated, LAN disabled;
- upgrade: PASS with valid manifest, config backup, previous install backup
  and `doctor.ok = true`;
- doctor: PASS for OS, Node, manifest, binary, Codex config, profile, ports,
  residual processes, MCP initialize, `tools/list`, required CyberDraw tools
  and process cleanup;
- observed tools: `30`, including `cyberdraw_create_diagram` and
  `cyberdraw_analyze_structure`;
- real Codex integration/use: PASS from a new Codex session after restart.

The real macOS trial exposed a TOML compatibility incident in the conservative
Codex config parser. PR #54 / commit `04185bb` resolved quoted table segments,
quoted keys, keys containing `=`, structural dotted-key canonicalization and
exact managed CyberDraw section detection while retaining fail-closed handling
for invalid or ambiguous TOML. A complete post-fix clean install run is not
recorded as REAL-PROVEN.

Ubuntu implementation evidence:

- default install path:
  `${XDG_DATA_HOME:-$HOME/.local/share}/CyberDraw MCP`;
- Codex config path: `$HOME/.codex/config.toml`;
- wrapper:
  `packages/drawio-mcp-server/installers/ubuntu/cyberdraw-ubuntu-installer.sh`;
- entrypoint:
  `packages/drawio-mcp-server/scripts/installation/ubuntu-installer.mjs`;
- automated validation: PASS for local tarball fixture install, localhost
  profile, Codex config generation, doctor/check, MCP initialize, `tools/list`,
  required CyberDraw tools, upgrade, uninstall and process cleanup;
- real Ubuntu host validation: PENDING;
- real Ubuntu Codex integration/use: PENDING.

## M22 Evidence Levels

| Level       | Meaning                                                                        |
| ----------- | ------------------------------------------------------------------------------ |
| REAL-PROVEN | Observed on the named OS with the packaged artifact and isolated config.       |
| PARTIAL     | A real part was observed, but another part depends on docs or harness control. |
| UNPROVEN    | Not tested or not supported by current installer evidence.                     |
| BLOCKED     | Attempted and failed for a product reason that must be fixed before closure.   |

## Handoff To Product Direction

M22 should not decide whether CyberDraw becomes a generic diagramming utility,
a public beta, an Architecture Intelligence platform or a cybersecurity
diagramming product. It should produce enough operational evidence for that
decision to be made in `CyberDraw Product Direction v1`.

## User-Guide Artifact Policy

M22 documentation uses Markdown as the authoritative source. The user guide
lives under `docs/cyberdraw/user-guide/`.

DOCX and PDF manuals are derived artifacts. Existing generated files matching
`docs/Manual_instalacion_y_guia_uso_CyberDraw_MCP_*.docx` and
`docs/Manual_instalacion_y_guia_uso_CyberDraw_MCP_*.pdf` are local distribution
outputs, not source documents.

Future M22 automation may generate those formats reproducibly, but it must
record:

- Markdown source files;
- source commit;
- generator command;
- generated artifact paths;
- SHA-256 and SHA-512;
- version or release candidate identity.

Until that automation exists, do not edit DOCX/PDF outputs as the source of
truth and do not treat their presence as evidence that M22 installation support
is complete.
