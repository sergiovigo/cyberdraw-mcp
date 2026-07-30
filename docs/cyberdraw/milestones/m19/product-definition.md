# M19 Product Definition

## Purpose

CyberDraw MVP is a local-first MCP product for AI-assisted draw.io diagram
creation and inspection.

The MVP turns this workflow into a bounded product promise:

```text
MCP client / agent
  -> client-generated Mermaid flowchart
  -> CyberDraw MCP
  -> draw.io built-in editor
  -> visible diagram page
  -> sanitized metadata and bounded read-only analysis
```

The server does not turn natural language into Mermaid. The MCP client or agent
does that. CyberDraw validates the constrained Mermaid request, materializes it
through draw.io, and reports sanitized evidence.

## Target User

The target MVP user is a technical operator, engineer or AI-assisted developer
who:

- already uses an MCP-capable client;
- wants diagrams created or inspected in draw.io;
- can run a local Node.js server;
- accepts a trusted local client boundary;
- prefers a local built-in editor over a public hosted draw.io session;
- can tolerate explicitly documented limitations before external distribution.

M19 does not target a non-technical self-service public installer yet. That is
M20/M21 work.

## Official MVP Flow

1. Install CyberDraw MCP from the supported package source.
2. Configure a supported MCP client for stdio.
3. Start `drawio-mcp-server --editor` through the MCP client.
4. Open `http://localhost:3000/`.
5. Ask the MCP client for a diagram.
6. The client produces a Mermaid flowchart.
7. The client invokes `cyberdraw_create_diagram` with:
   - `format: "mermaid"`;
   - `mermaidType: "flowchart"`;
   - `insertMode: "new-page"`;
   - `mermaid`;
   - `limits.maxBytes`;
   - optional `title`;
   - optional `target_document` when multiple documents are connected.
8. CyberDraw validates the request and routes it to the connected draw.io
   document.
9. The import creates exactly one new page for the accepted happy path.
10. The response returns `m15-v1` sanitized page metadata and mutation reporting.
11. The user can run `cyberdraw_analyze_structure` for bounded read-only
    inspection.
12. The user can repeat the flow after restarting the local environment.

## Official MVP Public Product Surface

| Capability                                       | Tool / surface                                                      | MVP status                            | Notes                                                             |
| ------------------------------------------------ | ------------------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------- |
| Document routing                                 | `list-documents`, `target_document`                                 | Official                              | Required when multiple connected documents exist.                 |
| Page and layer inspection                        | `list-pages`, `get-current-page`, `list-layers`, `get-active-layer` | Official supporting surface           | Used for inspection and routing, not as the main creation story.  |
| Diagram creation                                 | `cyberdraw_create_diagram`                                          | Official                              | M15 `m15-v1`, Mermaid flowchart, new page only, sanitized output. |
| Structural analysis                              | `cyberdraw_analyze_structure` `mode: "analyze"`                     | Official                              | Bounded read-only M13/M14 public contract.                        |
| Structural query                                 | `cyberdraw_analyze_structure` `mode: "query"`                       | Official                              | Includes M14 `count` and `summarize` where requested.             |
| Non-executable planning and validation summaries | `cyberdraw_analyze_structure` `mode: "plan"` / `validate`           | Official read-only supporting surface | Public proposals are non-executable and sanitized.                |
| Safety reporting                                 | public response fields                                              | Official                              | Must preserve mutation/read-only counters and reason codes.       |

## Compatible Inherited Surface

The inherited draw.io MCP tools remain available for advanced users and
compatible MCP clients:

- shape discovery;
- paged model inspection;
- page management;
- layer management;
- shape and edge editing;
- import/export;
- raw `import-mermaid`.

These tools are compatible inherited surface, not the narrow official MVP flow.
In particular:

- `import-mermaid` is lower-level than `cyberdraw_create_diagram`;
- `export-diagram` can return XML/SVG/PNG and can write to trusted filesystem
  paths;
- edit/delete tools mutate existing diagram state and require higher client
  discipline.

## Internal / Advanced Surface

These capabilities exist but are not public product features:

- runtime snapshots;
- scoped and hierarchical snapshot planning;
- structural analysis internals;
- private structural query internals;
- M11 change planning;
- M12 plan validation;
- scoped identity;
- semantic diff.

They support the implemented public read-only analysis and future Architecture
Intelligence design. They are not public APIs and must not be presented as
stable external contracts.

## Experimental Surface

| Surface                        | Status                                | MVP decision                                                                                       |
| ------------------------------ | ------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Browser extension              | Compatible / optional                 | Not official default. Useful for users who prefer app.diagrams.net or browser extension workflows. |
| Firefox extension              | Optional with TLS                     | Requires WSS/TLS; not part of the simplest MVP path.                                               |
| Built-in TLS/self-signed local | Advanced local setup                  | Supported by server docs, but not required for official MVP.                                       |
| Reverse proxy                  | Advanced deployment                   | Requires external auth; not product-accepted by M19.                                               |
| Wildcard bind                  | Explicit unsafe mode without boundary | Outside official MVP; must be behind trusted network/auth proxy.                                   |
| draw.io desktop                | Experimental / blocked                | Not MVP supported because desktop CSP blocks the plugin WebSocket.                                 |

## Deployment Profiles

| Profile                              | M19 classification      | Notes                                                                               |
| ------------------------------------ | ----------------------- | ----------------------------------------------------------------------------------- |
| Local stdio + built-in editor        | Official MVP profile    | Loopback editor, stdio MCP, no extension required.                                  |
| Local HTTP MCP + built-in editor     | Documented / diagnostic | Useful for clients with HTTP support; unauthenticated and loopback-only by default. |
| Browser extension + external draw.io | Compatible optional     | Requires extension install and WebSocket connectivity.                              |
| TLS/self-signed local                | Advanced local          | Required for Firefox extension; trust setup remains user-managed.                   |
| Reverse proxy                        | Not MVP official        | Must provide auth and transport policy externally.                                  |
| Wildcard bind                        | Not MVP official        | Exposes unauthenticated endpoints unless protected.                                 |
| draw.io desktop                      | Unsupported for MVP     | Upstream CSP blocks end-to-end WebSocket integration.                               |

## Supported Clients

| Client                   | Status                                                    | Product implication                                                                           |
| ------------------------ | --------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Codex                    | Manually validated in the current development environment | M21 must repeat clean-machine setup from a reproducible installation before final acceptance. |
| Claude Desktop           | Documented                                                | Needs acceptance run before product-validated status.                                         |
| Claude Code              | Documented                                                | Needs acceptance run before product-validated status.                                         |
| Zed                      | Documented                                                | Needs acceptance run before product-validated status.                                         |
| OpenCode                 | Documented                                                | Needs acceptance run before product-validated status.                                         |
| oterm                    | Documented                                                | Needs acceptance run before product-validated status.                                         |
| Generic MCP stdio client | Compatible in principle                                   | Not validated without a named acceptance run.                                                 |

## Runtime And Package Baseline

- Node.js 22 LTS is the minimum supported runtime.
- Node.js 22 and 24 are CI lanes.
- Normal install/build/lint/test uses `pnpm@10.8.1`.
- Dependency audit uses pnpm 11.13.0 only through the existing audit script.
- Server, plugin and extension package manifests are at 2.2.0.
- Browser-extension builds support Chrome and Firefox artifacts through WXT.

## Security Boundary

The MVP assumes a trusted local MCP client.

Data intentionally exposed through official MVP public responses:

- connected document metadata needed for routing;
- page/layer metadata;
- sanitized created page metadata;
- structural counts, classifications and reason codes;
- safety counters and mutation/read-only reporting;
- bounded limitations and coverage evidence.

Data not exposed by official MVP CyberDraw responses:

- raw XML;
- raw `mxGraphModel` or `mxCell` payloads;
- raw runtime snapshots;
- graph-model dumps;
- raw plugin responses;
- private identity signatures;
- semantic diff internals;
- stack traces;
- local filesystem paths;
- Mermaid source in logger output;
- provider secrets or LLM internals.

## Known Limits

- Only client-generated Mermaid flowcharts are supported by
  `cyberdraw_create_diagram`.
- The server does not call an LLM or parse natural language.
- The creation wrapper inserts a new page only.
- M15 mutation reporting can return `atomic: "unknown"` after ambiguous
  post-dispatch failures.
- Public structural analysis remains bounded and read-only.
- Complete-document public execution is not part of M14/M19.
- Architecture Intelligence semantic diff remains internal.
- No CyberDraw persistence or review session exists.
- No rollback, transaction or approval workflow exists.
- Browser extension and TLS deployments need separate acceptance before they
  can become official MVP paths.
- draw.io asset version/provenance is not yet release-pinned.
- Third-party license inventory is incomplete.

## Product Acceptance Scenario

M21 should execute the final acceptance scenario from a clean environment:

1. install with the official command;
2. configure Codex stdio;
3. launch the built-in editor;
4. create a Mermaid flowchart with `cyberdraw_create_diagram`;
5. verify the page appears in draw.io;
6. run public structural analysis/query;
7. trigger a controlled failure and verify sanitized error output;
8. restart the environment and repeat the creation/inspection flow;
9. record Node 22 and Node 24 behavior;
10. record final limitations and release verdict.
