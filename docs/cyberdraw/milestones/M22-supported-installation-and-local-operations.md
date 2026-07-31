# M22 - Supported Installation And Local Operations

## Status

PROPOSED / NOT STARTED.

## Purpose

M22 converts the accepted CyberDraw MVP artifact into a supported local
installation and operations flow without expanding the functional product
contract.

M21 proved that the packaged `drawio-mcp-server-2.2.0.tgz` can be installed and
used from a clean environment. A later real MacBook Pro installation also showed
that the product can move to another machine, but exposed operational gaps that
belong outside the M21 acceptance milestone:

- users must distinguish the self-contained distribution artifact from an
  ordinary workspace tarball;
- a wrong tarball can try to resolve private `cyberdraw-*` packages from npm;
- installation paths differ across Linux and macOS;
- Codex configuration remains manual;
- users need explicit host, port and editor URL guidance;
- `0.0.0.0` exposes local HTTP and WebSocket surfaces and must never become the
  silent default;
- there is no integrated doctor, upgrade or uninstall workflow.

M22 answers:

> Can CyberDraw be installed, configured, diagnosed, upgraded and removed as a
> supported local product on the target operating systems, using the accepted M20
> artifact contract and M21 product boundary?

## Product Boundary

The official M22 product profile remains:

```text
MCP client
  -> stdio
  -> drawio-mcp-server --editor
  -> loopback HTTP editor
  -> loopback WebSocket bridge
  -> visible draw.io diagram
```

M22 may add installation and operations scripts, docs and validation evidence.
It must not add new diagramming features, MCP tools, public DTOs, runtime
contracts, persistence, Architecture Intelligence mutation execution, public
semantic diff, global identity, approval, rollback, transactions, watchers,
streaming, chunking or provider integration.

## Scope

M22 covers:

- versioned local installer strategy for macOS, Ubuntu and Windows;
- explicit safe `localhost` profile;
- explicit opt-in LAN profile with risk acknowledgement;
- selected installation directory support;
- validation of the self-contained tarball before installation;
- SHA-256 and SHA-512 verification of the artifact;
- rejection of `workspace:*` ranges and private `cyberdraw-*` runtime
  dependencies in the packaged `package.json`;
- automatic Codex MCP configuration where the platform allows it;
- backup and restore policy for existing client configuration;
- port detection and conflict reporting;
- Node version validation;
- built-in editor URL reporting;
- process cleanup and residual-process checks;
- upgrade behavior for a pinned artifact version;
- uninstall/cleanup behavior that does not delete user diagrams;
- `doctor` diagnostics or an equivalent supported diagnostic script;
- consolidated troubleshooting guidance;
- real manual evidence on each supported operating system.

## Non-Goals

M22 does not:

- publish npm;
- create a GitHub Release;
- create a public beta;
- change the accepted `drawio-mcp-server` MCP contract;
- add new CyberDraw tools;
- expose internal semantic diff;
- implement incremental analysis;
- implement persistence;
- implement authentication or remote deployment as a product feature;
- change M17 scoped identity or M18 semantic diff semantics;
- close M23 or any later roadmap direction;
- perform complete legal sign-off for draw.io WAR notices.

## Installation Contract

An M22 installer must fail closed before modifying a user configuration when:

- the artifact checksum does not match the expected SHA-256 or SHA-512;
- the artifact `package/package.json` contains `workspace:*`;
- the artifact declares private runtime dependencies named `cyberdraw-*`;
- the artifact name or version does not match the selected release;
- the `drawio-mcp-server` binary is missing;
- `LICENSE.md` or `THIRD_PARTY_NOTICES.md` is missing;
- Node.js is below the supported baseline.

The installer must report what it will write before touching client
configuration. Existing configuration must be backed up before modification.

## Network Profiles

| Profile     | Status                   | Binding                             | Requirement                                                                |
| ----------- | ------------------------ | ----------------------------------- | -------------------------------------------------------------------------- |
| `localhost` | Official default         | `127.0.0.1`                         | No extra consent. This is the safe supported MVP profile.                  |
| `lan`       | Explicit opt-in          | User-selected LAN host or `0.0.0.0` | Requires an explicit warning and acknowledgement before configuration.     |
| Remote      | Out of M22 product scope | Reverse proxy or non-local exposure | Must not be documented as supported without a separate security milestone. |

The LAN profile must clearly state that CyberDraw's local HTTP and WebSocket
surfaces are unauthenticated and intended for trusted local networks only.

## Proposed Sub-Milestones

| Sub-milestone | Name                                    | Scope                                                                                        |
| ------------- | --------------------------------------- | -------------------------------------------------------------------------------------------- |
| M22.0         | Installer Contract And Profile Policy   | Freeze artifact validation, host profiles, config backup and supported OS acceptance policy. |
| M22.1         | macOS Installer Integration             | Versioned macOS install, Codex config, doctor, upgrade and uninstall evidence.               |
| M22.2         | Ubuntu Installer Integration            | Versioned Ubuntu install, Codex config, doctor, upgrade and uninstall evidence.              |
| M22.3         | Windows Installer Integration           | Versioned Windows install, Codex config, doctor, upgrade and uninstall evidence.             |
| M22.4         | Doctor, Upgrade And Uninstall Hardening | Shared diagnostics, port/process checks, cleanup safety and rollback of config edits.        |
| M22.5         | Cross-OS Local Operations Closure       | Consolidated OS matrix, residual risks, release-readiness decision and closure evidence.     |

The exact split can change during M22.0 if implementation evidence shows a
smaller structure is safer.

## Acceptance Criteria

M22 can close only when:

- the official install command is defined for each supported operating system;
- the installer validates the accepted artifact contract before installation;
- checksum mismatch is rejected before configuration changes;
- ordinary workspace tarballs that contain private runtime dependencies are
  rejected;
- safe localhost setup works without manual path edits on each supported OS;
- LAN setup requires explicit opt-in and records its risk;
- Codex configuration can be installed with a backup and restored or removed;
- `doctor` or equivalent diagnostics reports Node, artifact, config, ports,
  editor URL and process state;
- upgrade to a pinned artifact version is documented and tested;
- uninstall removes only CyberDraw-managed configuration and local caches
  selected by the user;
- no user diagrams are deleted automatically;
- macOS, Ubuntu and Windows evidence is recorded separately;
- public MCP tools and contracts remain unchanged;
- M21 acceptance is not reinterpreted as public beta readiness.

## Risks

- Codex configuration file layout may change across client releases.
- Windows path, shell and process handling may need different installer
  behavior from Unix-like systems.
- Firewall prompts can make LAN behavior hard to validate deterministically.
- Users may run from stale tarballs unless the installer verifies both metadata
  and checksums.
- Node installation and shell startup differences can dominate first-run
  failures.
- LAN exposure is unauthenticated and can only be supported as an explicit
  trusted-network profile without a separate security milestone.

## M22 Output

Expected M22 outputs:

- installer/profile contract;
- platform-specific installer scripts or packages;
- doctor diagnostics;
- upgrade and uninstall paths;
- authoritative Markdown user-guide source and reproducible derived manual
  generation policy;
- cross-OS support matrix;
- real manual evidence per operating system;
- updated troubleshooting;
- closure verdict for supported local operations.

## Documentation Source Policy

M22 adopts Markdown as the authoritative, versioned source for installation and
user guidance:

- [`../user-guide/installation-and-user-guide.md`](../user-guide/installation-and-user-guide.md)
- [`../user-guide/macos.md`](../user-guide/macos.md)
- [`../user-guide/ubuntu.md`](../user-guide/ubuntu.md)
- [`../user-guide/windows.md`](../user-guide/windows.md)
- [`../user-guide/troubleshooting.md`](../user-guide/troubleshooting.md)

DOCX and PDF manuals are derived release or distribution artifacts. They must
not be used as source documents and should not normally be versioned in Git.

M22 may later add reproducible DOCX/PDF generation from the Markdown source,
including source commit, command, output path and checksums as release evidence.
That generation is planned, not implemented by this milestone draft.

M22 should end with one of:

- PASS;
- PASS WITH LIMITATIONS;
- BLOCKED.

It must not declare public beta readiness.
