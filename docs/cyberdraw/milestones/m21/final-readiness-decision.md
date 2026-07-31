# M21 Final Readiness Decision

## Status

COMPLETE.

## Final Decisions

| Decision                   | Result                 |
| -------------------------- | ---------------------- |
| Product acceptance         | PASS WITH LIMITATIONS  |
| Internal MVP               | ACCEPTED               |
| External distributable MVP | READY WITH LIMITATIONS |
| Public beta                | NOT READY              |

## Rationale

M21 proves that the M20 official artifact can be installed from a clean tarball,
started with a cold draw.io asset cache, connected over stdio, used to create a
visible draw.io diagram through the public product tool and inspected through
public read-only capabilities.

This is enough to close the internal MVP and mark the external distributable
artifact as ready with limitations.

It is not enough to declare public beta because public beta still needs:

- final legal review of draw.io WAR notices and bundled asset notices;
- broader documented client acceptance beyond the stdio protocol harness;
- release tag and npm publication decision;
- support policy for upgrade, uninstall, troubleshooting and external
  deployment;
- Node 22 clean acceptance replay if release sign-off requires both CI lanes as
  real product environments.

## M20 Relationship

M20 made the artifact installable and auditable. M21 confirms that artifact can
run the final MVP flow.

M21 does not retroactively change M20's technical claims:

- M20 remains the packaging and provenance milestone;
- M21 is the product acceptance and closure milestone;
- M20's license/provenance limitations remain visible in M21.

## Capabilities Accepted

The accepted MVP includes:

- local stdio server launch;
- loopback built-in editor;
- pinned draw.io asset download and cache;
- public `cyberdraw_create_diagram`;
- public read-only inspection and structural analysis;
- controlled rejection for invalid Mermaid and over-limit input;
- repeatable warm-cache operation.

## Capabilities Not Accepted

M21 does not accept or introduce:

- public MCP semantic diff tool;
- public HTTP route for semantic diff;
- public WebSocket command for semantic diff;
- plugin API expansion;
- global stable IDs;
- persistent IDs;
- persistence;
- mutation executor;
- approval workflows;
- rollback;
- transactions;
- server-side LLM/provider integration;
- prompt-to-diagram expansion beyond client-generated Mermaid;
- incremental analysis;
- watchers;
- streaming;
- chunking;
- authenticated remote deployment;
- public beta.

## Post-MVP Backlog

Recommended post-MVP work:

1. Public release legal/notices closure.
2. Node 22 clean acceptance replay if required for release sign-off.
3. Interactive Codex UX acceptance using the documented client configuration.
4. Optional acceptance passes for Claude Desktop, Claude Code, Zed and OpenCode.
5. Public beta hardening, including support policy and external deployment
   guardrails.
6. Separate Architecture Intelligence milestones for incremental analysis or
   public semantic diff, if still desired.
