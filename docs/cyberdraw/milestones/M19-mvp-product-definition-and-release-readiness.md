# M19 - CyberDraw MVP Product Definition And Release Readiness

## Status

READY FOR REVIEW.

M19 is a product-definition and release-readiness milestone. It does not close
the final CyberDraw MVP release. It freezes the intended MVP product boundary
and identifies the remaining work packages required before external
distribution or public beta can be claimed.

## Readiness Verdict

| Decision                         | Verdict              | Basis                                                                                                                                                                                      |
| -------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Demo ready                       | YES                  | The M15 reproducible demo proves client-generated Mermaid can create a visible draw.io page through `cyberdraw_create_diagram` in REAL LOCAL HTTP.                                         |
| Internal MVP ready               | YES WITH LIMITATIONS | The local loopback built-in editor path, public creation and public read-only analysis are implemented and tested, but installation, packaging and licensing still need release hardening. |
| External distributable MVP ready | NO                   | Clean/reproducible installation, editor asset behavior, third-party licenses, draw.io asset provenance, release versioning, packaging strategy and clean product acceptance remain open.   |
| Public beta ready                | NO                   | External deployment, final compatibility matrix, license/provenance review and final product acceptance are not complete.                                                                  |

## Objective

Define what "CyberDraw MVP" means as a product and convert the current technical
state after M18 into a bounded, auditable release-readiness assessment.

M19 must answer:

1. what user problem the MVP solves;
2. who the MVP is for;
3. which flows and tools are officially supported;
4. which inherited or internal capabilities remain compatible but not product
   centerpiece;
5. which deployment profile is the official MVP path;
6. which clients and runtimes are validated, documented or untested;
7. what blocks external distribution;
8. which follow-up milestones should finish packaging and acceptance.

## Product Definition

CyberDraw MVP is a local-first MCP workflow for creating and inspecting draw.io
diagrams with an AI-capable MCP client.

The official MVP flow is:

1. the user installs CyberDraw MCP;
2. the user configures a supported MCP client;
3. the server starts with the built-in editor on loopback;
4. the user opens the local draw.io editor;
5. the user asks the MCP client to create a diagram;
6. the client generates bounded Mermaid flowchart source;
7. `cyberdraw_create_diagram` validates and imports the Mermaid into a new
   draw.io page;
8. the user sees the page in draw.io;
9. the user can inspect the diagram and run bounded read-only structural
   analysis through `cyberdraw_analyze_structure`;
10. public responses expose sanitized metadata and reason codes, not XML,
    raw graph data, runtime snapshots or plugin internals.

The server does not interpret natural language, call an LLM, store diagrams or
execute Architecture Intelligence mutation plans.

Detailed product definition:

- [`m19/product-definition.md`](m19/product-definition.md)

## Product Surface

### Official MVP Surface

- local stdio MCP server launched by the MCP client;
- built-in editor served on loopback;
- `list-documents` for active document routing;
- page and layer discovery needed to inspect and route official flows;
- `cyberdraw_create_diagram` for bounded client-generated Mermaid flowcharts;
- `cyberdraw_analyze_structure` for bounded read-only analysis, query, count,
  summarize, non-executable planning and validation summaries under the
  existing M13/M14 contracts;
- sanitized public outputs, safety counters, limits and reason codes.

### Compatible Inherited Surface

The inherited draw.io MCP tools remain available and compatible where
documented in `TOOLS.md`, including page management, layer management, cell
editing and import/export. They are not the recommended MVP product path unless
needed by an advanced MCP client or operator.

### Internal / Advanced Surface

The following capabilities exist as internal Architecture Intelligence
foundations and are not MVP public features:

- scoped runtime snapshots;
- hierarchical snapshot planning;
- internal structural analysis;
- private structural queries;
- non-executable change planning;
- change-plan validation;
- scoped identity;
- internal semantic diff.

### Experimental Surface

- Browser extension deployment is compatible but not the default MVP path.
- Firefox extension use requires TLS/WSS.
- TLS/self-signed local deployments are advanced local setups.
- Reverse-proxy and wildcard-bind deployments require an external
  authentication boundary and are not the official MVP profile.
- draw.io desktop integration remains experimental and blocked by upstream CSP
  behavior.

## Official MVP Deployment Profile

The recommended MVP deployment is:

```text
MCP client -> stdio -> drawio-mcp-server --editor
                         |
                         v
                 loopback HTTP editor
                         |
                         v
                 loopback WebSocket bridge
```

Policy:

- bind to `127.0.0.1`;
- use the built-in editor;
- use stdio from the MCP client;
- do not expose HTTP MCP or WebSocket endpoints to a network by default;
- do not require a browser extension;
- do not require TLS unless the user intentionally chooses extension or
  non-local scenarios;
- do not require model provider API keys.

## Supported Runtime Baseline

| Area                     | MVP position                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Node.js                  | Node.js 22 LTS minimum; Node 22 and 24 CI lanes.                                                                    |
| Package manager          | `pnpm@10.8.1` for normal install/build/lint/test; pnpm 11.13.0 only through the audit script.                       |
| Server package           | `drawio-mcp-server` 2.2.0 in current manifests.                                                                     |
| Plugin/package extension | `drawio-mcp-plugin` and `drawio-mcp-extension` 2.2.0 in current manifests.                                          |
| Built-in editor assets   | Repository-served draw.io assets, but final release pinning/provenance remains a blocker for external distribution. |

## Client Support Policy

| Client            | M19 status                                                | Rationale                                                                                                                                                                          |
| ----------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Codex             | Manually validated in the current development environment | The current project context records MCP client/Codex -> CyberDraw MCP -> draw.io visible result as manually validated. M21 must repeat this from a clean and reproducible install. |
| Claude Desktop    | Documented configuration                                  | README and CONFIG include config snippets, but M19 does not treat it as product-accepted without a clean acceptance run.                                                           |
| Claude Code       | Documented configuration                                  | README and CONFIG include stdio and HTTP snippets, but M19 requires M21 acceptance before validation claim.                                                                        |
| Zed               | Documented configuration                                  | README and CONFIG include snippets; not product-accepted in M19.                                                                                                                   |
| OpenCode          | Documented configuration                                  | README and CONFIG include snippets; not product-accepted in M19.                                                                                                                   |
| oterm             | Documented configuration                                  | CONFIG includes snippets; not product-accepted in M19.                                                                                                                             |
| Other MCP clients | Compatible in principle                                   | Must support MCP stdio and process launch; not validated.                                                                                                                          |

## Security And Trust Boundary

MVP deployments are trusted-client local deployments.

Security posture:

- stdio is trusted by construction because the MCP client owns the process;
- HTTP MCP and WebSocket endpoints are unauthenticated and must remain
  loopback-only for the official MVP profile;
- wildcard binding requires an external auth boundary and is outside official
  MVP deployment;
- diagram XML, Mermaid and imported content are untrusted inputs interpreted by
  draw.io in the browser;
- public CyberDraw responses must stay sanitized and must not expose raw XML,
  raw runtime snapshots, graph dumps, plugin payloads, stacks, local paths,
  private identity signatures or semantic diff internals;
- `export-diagram` `output_path` remains trusted-client functionality and is
  not part of the recommended MVP happy path.

## Readiness Matrix

Detailed readiness assessment:

- [`m19/release-readiness-matrix.md`](m19/release-readiness-matrix.md)

Summary:

| Gap class   | Meaning                                                               | Current count |
| ----------- | --------------------------------------------------------------------- | ------------- |
| BLOCKER     | Must be resolved before external distributable MVP.                   | 7             |
| REQUIRED    | Must be resolved before final MVP closure or acceptance.              | 13            |
| RECOMMENDED | Should be improved before public beta, not required for internal MVP. | 9             |
| DEFERRED    | Explicitly out of MVP scope or future Architecture Intelligence work. | 8             |

## M19 Findings

### Blockers For External MVP

1. clean/reproducible installation;
2. deterministic editor startup and asset behavior;
3. complete licenses/notices;
4. draw.io asset provenance/pinning;
5. release versioning policy;
6. accepted packaging strategy;
7. clean real product acceptance.

### Required Before Final MVP Closure

- documented official installation command and supported package source;
- clean-machine Node 22 and Node 24 acceptance;
- Codex setup replay from clean install;
- editor startup and restart/recovery acceptance;
- diagram creation through `cyberdraw_create_diagram`;
- post-create inspection through public analysis/query;
- controlled failure and sanitized error acceptance;
- multi-page and multi-document product scenario;
- explicit known limitations in final release notes.

### Deferred Beyond MVP

- server-side LLM/provider integration;
- public semantic diff;
- incremental analysis implementation;
- persistence;
- Architecture Intelligence mutation executor;
- approval workflows;
- rollback or transactions;
- global stable identity or cross-document continuity.

## Proposed Follow-Up Roadmap

M19 recommends two bounded follow-up milestones:

1. M20 - Packaging, Licensing And Reproducible Installation.
2. M21 - Final MVP Product Acceptance And Closure.

Detailed roadmap:

- [`m19/final-mvp-roadmap.md`](m19/final-mvp-roadmap.md)

M19 does not start, implement, close or pre-approve M20 or M21.

## Acceptance Criteria For M19

| Criterion                                                                      | Status   | Evidence                                      |
| ------------------------------------------------------------------------------ | -------- | --------------------------------------------- |
| MVP problem, user and flow defined                                             | PASS     | `m19/product-definition.md`                   |
| Public product surface separated from inherited/internal/experimental surfaces | PASS     | This document and `m19/product-definition.md` |
| Official deployment profile proposed                                           | PASS     | This document and `m19/product-definition.md` |
| Supported clients classified by evidence                                       | PASS     | This document                                 |
| Release-readiness matrix created                                               | PASS     | `m19/release-readiness-matrix.md`             |
| Blockers and required gaps classified                                          | PASS     | `m19/release-readiness-matrix.md`             |
| M20/M21 roadmap proposed without closing future work                           | PASS     | `m19/final-mvp-roadmap.md`                    |
| No production code, public API, dependency or workflow change                  | Expected | Confirm through final diff audit              |

## Non-Goals

M19 does not include:

- production code changes;
- MCP tool additions;
- public schema or DTO changes;
- runtime contract changes;
- dependency updates;
- workflow changes;
- packaging implementation;
- license inventory completion;
- release publication;
- clean-machine product acceptance execution;
- public semantic diff;
- incremental analysis;
- persistence;
- mutation execution;
- approval, rollback or transactions.

## Decision

M19 classifies CyberDraw MCP as:

- DEMO READY;
- INTERNAL MVP READY WITH LIMITATIONS;
- EXTERNAL DISTRIBUTABLE MVP NOT READY;
- PUBLIC BETA NOT READY.

The next recommended milestone is M20 - Packaging, Licensing And Reproducible
Installation.
