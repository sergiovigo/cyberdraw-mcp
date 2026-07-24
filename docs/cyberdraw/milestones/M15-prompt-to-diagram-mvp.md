# M15 - Prompt-to-Diagram MVP

Status: COMPLETE / CLOSED

Closure verdict: PASS WITH LIMITATIONS.

M15.0-M15.3 are complete. The MVP is implemented as a narrow public wrapper
over the existing draw.io Mermaid import path and validated through automated
unit tests plus HTTP-local real-environment evidence. The remaining limitation
is that the reproducible demo and real-environment evidence are HTTP-local, not
HTTPS/Caddy.

M15 defines a small demonstrable path from a user's natural-language diagram
request to a visible draw.io diagram. It is not a general diagram generation
platform and does not reopen M13 or M14.

## Problem Statement

After M14, CyberDraw can analyze visible diagrams through the public read-only
`cyberdraw_analyze_structure` contract. The next user-facing gap is creation:
a user should be able to ask an MCP-capable agent to create a simple diagram and
see the result materialized in draw.io.

The MVP should reuse the existing draw.io Mermaid import path rather than
inventing a new graph editor, XML generator, semantic edit engine, persistence
layer or approval workflow.

## Product Goal

Enable this flow:

1. The user asks an MCP client or agent for a diagram in natural language.
2. The client or agent generates constrained Mermaid.
3. A CyberDraw public MCP tool validates a closed request.
4. The existing Mermaid import capability materializes the diagram in draw.io.
5. The result is reported with sanitized metadata and can be inspected with
   M14 read-only analysis.

## User Journey

Example user prompt:

> Create a diagram with a user, a WAF, a load balancer, two application
> servers and a database.

Expected MVP behavior:

- The MCP client or agent interprets the natural-language request.
- The agent emits a supported Mermaid diagram, preferably a bounded flowchart.
- The server receives Mermaid, optional `target_document` routing, and fixed
  `insertMode: "new-page"` creation semantics, not a natural-language prompt
  or existing-page controls.
- The server validates size, type and routing constraints.
- The server invokes the existing draw.io Mermaid conversion path.
- The diagram appears in the connected draw.io editor.
- The response reports only success, the created page identity and
  mutation/safety metadata.
- The response does not include XML, raw graph, raw snapshots, scripts, local
  paths or provider internals.

Clients that cannot generate Mermaid are outside the MVP. They may need a
future client-side or separate service integration, but M15 does not require the
server to call an LLM.

## Existing Capabilities

| Capability                 | Tool / location                                                                      | Mutates | Existing validation                                              | Output                                                  | Evidence                                                                 | M15 reuse                         |
| -------------------------- | ------------------------------------------------------------------------------------ | ------- | ---------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------- |
| Mermaid import             | `import-mermaid`, `packages/drawio-mcp-server/src/tools/import-mermaid.ts`           | Yes     | Zod input shape; `target_page` required for `add` and `replace`  | Success payload with converted mode, cell count and XML | `packages/drawio-mcp-server/src/real-environment/import-mermaid.test.ts` | Runtime materialization path      |
| Draw.io Mermaid conversion | `packages/drawio-mcp-plugin/src/tools/import-mermaid/`                               | Yes     | Plugin validates non-empty source; dispatches by draw.io version | Native or embed result                                  | `v29.test.ts`, `v30.test.ts`                                             | Conversion engine                 |
| Page/document routing      | `default_tool`, `target_document`, `target_page`                                     | N/A     | Fail-closed multiple-document routing; exact page selector       | Routed tool calls                                       | `TOOLS.md`, document targeting tests                                     | Target resolution                 |
| Page creation import mode  | `insert_mode: "new-page"`                                                            | Yes     | `target_page` optional only for new page                         | New draw.io page                                        | real-environment Mermaid test                                            | Demo-friendly insertion           |
| Existing primitives        | `add-cell-of-shape`, `add-edge`, `edit-cell`, `delete-cell-by-id`, `set-cell-parent` | Yes     | Per-tool schemas                                                 | Cell/edge results                                       | real-environment suites                                                  | Not first MVP path                |
| M14 verification           | `cyberdraw_analyze_structure`                                                        | No      | M13/M14 public contract                                          | Sanitized structural response                           | M14 closure evidence                                                     | Optional post-import verification |

## Current Mermaid Tool Audit

Current public tool: `import-mermaid`.

Input:

- `target_document`, injected into all live plugin tools by the server registry;
- `target_page`, optional only for `insert_mode: "new-page"`;
- `mermaid_source`, raw Mermaid syntax;
- `mode`, `"native"` or `"embed"`, default `"native"`;
- `insert_mode`, `"replace"`, `"add"` or `"new-page"`, default `"add"`.

Runtime behavior:

- Conversion runs inside the draw.io editor through its bundled Mermaid APIs.
- v29 uses `ui.parseMermaidDiagram` and passes an enable-parser flag for native
  conversion.
- v30 uses `ui.parseMermaidImage` for embed mode when available and
  `ui.parseMermaidDiagram` for native mode.
- Native mode converts supported Mermaid diagrams to mxGraph cells when draw.io
  supports the diagram type; unsupported native conversion can fall back to an
  embedded image cell.
- Embed mode creates one image cell carrying Mermaid data for draw.io
  re-editing.
- `replace` and `add` mutate the target page.
- `new-page` creates a page and imports into it.
- Calls are document-routed and queued.

Known MVP gaps in the current tool:

- It returns converted XML in successful responses.
- It has no explicit Mermaid byte limit in the server schema.
- It has no explicit public node/edge budget.
- It does not expose a CyberDraw-specific safety report.
- It accepts raw Mermaid directly but is not named for prompt-to-diagram usage.
- Its atomicity is whatever draw.io import provides; no rollback guarantee is
  documented.

The existing tool can demonstrate the product flow today if an agent produces
Mermaid, but it is not the recommended final M15 public contract because the
response exposes XML and the input lacks CyberDraw-specific bounds.

## Architecture Decision

M15 should keep prompt interpretation outside the server.

The MCP server should not call an LLM in the MVP because:

- MCP clients and agents already provide language understanding.
- Server-side LLM calls would add provider selection, credentials, network
  policy, prompt-injection handling, billing, rate limits and deterministic
  testing concerns.
- No repository requirement currently mandates a provider.
- The fastest demonstrable MVP is validating and importing constrained Mermaid.

Mermaid is the MVP intermediate representation because:

- draw.io already provides conversion and import support;
- flowcharts map well to simple architecture and process diagrams;
- Mermaid is compact and agent-friendly;
- it avoids model-generated draw.io XML;
- real-environment coverage already exists for import.

## Alternatives

| Option | Description                                                  | Time to MVP  | Security                                               | Determinism                     | Testability                      | Risk                            | Recommendation             |
| ------ | ------------------------------------------------------------ | ------------ | ------------------------------------------------------ | ------------------------------- | -------------------------------- | ------------------------------- | -------------------------- |
| A      | Use `import-mermaid` directly                                | Small        | Weak response sanitization because XML is returned     | Draw.io-dependent               | Already has real tests           | Public output leaks XML         | Useful immediate demo only |
| B      | Add `cyberdraw_create_diagram` wrapper over Mermaid          | Small/medium | Stronger closed schema and sanitized output            | Same runtime, narrower contract | Unit + real tests focused on MVP | Small duplication around import | Recommended                |
| C      | Server receives prompt and calls LLM                         | Large        | Adds secrets, network, provider and injection surfaces | Low without complex evals       | Harder and flaky                 | High scope creep                | Not M15 MVP                |
| D      | Structured nodes/edges with `add-cell-of-shape` + `add-edge` | Medium/large | Controllable but broad mutation surface                | Higher if layout is constrained | Many more cases                  | Becomes diagram editor platform | Later option, not MVP      |

Recommended M15 path: Option B.

For M15.1 this recommendation is fixed, not provisional:

- add exactly one new public tool, `cyberdraw_create_diagram`;
- implement it as a thin wrapper over the existing `import-mermaid` runtime;
- accept Mermaid input only, not a natural-language prompt;
- accept only Mermaid flowcharts;
- call `import-mermaid` internally with native mode and `insert_mode:
"new-page"`;
- return sanitized metadata only.

M15.1 does not support embed mode, `replace`, `add`, sequence diagrams, a full
Mermaid parser, server-side LLM calls or new external dependencies.

## Proposed Public Contract

Implemented public tool for M15.1:

`cyberdraw_create_diagram`

Description:

> Create a bounded draw.io diagram from client-generated Mermaid. The server
> validates a closed request, imports Mermaid through draw.io's existing Mermaid
> pipeline, returns sanitized metadata and never returns XML.

Input:

```json
{
  "target_document": { "id": "document-id-from-list-documents" },
  "format": "mermaid",
  "mermaidType": "flowchart",
  "insertMode": "new-page",
  "mermaid": "flowchart TD\n  User[User] --> WAF[WAF]",
  "title": "Web Architecture",
  "limits": {
    "maxBytes": 12000
  }
}
```

M15.1 keeps `format`, `mermaidType` and `insertMode` as explicit fields with
literal-only values. That is slightly more verbose than implicit constants, but
it keeps requests self-describing and gives later milestones an obvious
extension point without allowing the server to infer hidden behavior.

Required fields:

- `format`: exactly `"mermaid"`;
- `mermaidType`: exactly `"flowchart"`;
- `insertMode`: exactly `"new-page"`;
- `mermaid`: bounded Mermaid source beginning with a supported flowchart
  directive;
- `limits.maxBytes`: required positive integer at or below the server cap.

Optional fields:

- `target_document` is optional only when exactly one document is connected,
  following existing routing rules.
- `title`, sanitized and length-bounded;
- `limits.maxNodes` and `limits.maxEdges`, only if M15.1 can enforce them with
  a conservative line-oriented heuristic. If that heuristic is not reliable
  enough, they are deferred.

Fields explicitly deferred out of M15.1:

- `target_page`;
- `mode`;
- `response`;
- `dryRun`;
- `validateOnly`;
- `insertMode: "add"`;
- `insertMode: "replace"`;
- `mode: "embed"`;
- `mermaidType: "sequence"` or any non-flowchart type.

Implementation route:

1. validate the closed schema;
2. apply `maxBytes`;
3. call existing `import-mermaid` with native mode and `insert_mode:
"new-page"`;
4. map the result to a sanitized `m15-v1` response.

Output:

```json
{
  "version": "m15-v1",
  "outcome": "accepted",
  "created": {
    "pageId": "page-id",
    "pageName": "Web Architecture"
  },
  "safety": {
    "mutatesDiagram": true,
    "mutationAttempted": true,
    "mutationInvocations": 1
  }
}
```

Rejected output:

```json
{
  "version": "m15-v1",
  "outcome": "rejected",
  "reasonCodes": ["mermaid-too-large"],
  "safety": {
    "mutatesDiagram": true,
    "mutationAttempted": false,
    "mutationInvocations": 0
  }
}
```

Reason codes for M15.1 are limited to:

- `invalid-request`;
- `unsupported-mermaid-type`;
- `mermaid-too-large`;
- `ambiguous-document`;
- `mermaid-render-failed`;
- `import-failed`;
- `timeout`.

These are separate from M14 reason codes and should not modify `m14-v1`.

## Example Requests

### Web Architecture

```json
{
  "format": "mermaid",
  "mermaidType": "flowchart",
  "insertMode": "new-page",
  "title": "Web Architecture",
  "mermaid": "flowchart LR\n  User[User] --> WAF[WAF]\n  WAF --> LB[Load Balancer]\n  LB --> App1[App Server 1]\n  LB --> App2[App Server 2]\n  App1 --> DB[(Database)]\n  App2 --> DB",
  "limits": { "maxBytes": 12000 }
}
```

### Invalid Request

```json
{
  "format": "xml",
  "mermaidType": "flowchart",
  "insertMode": "new-page",
  "mermaid": "<mxGraphModel/>",
  "limits": { "maxBytes": 12000 }
}
```

Expected: rejected with `invalid-request`; no mutation attempted.

### Ambiguous Document

```json
{
  "format": "mermaid",
  "mermaidType": "flowchart",
  "insertMode": "new-page",
  "mermaid": "flowchart TD\n  A --> B",
  "limits": { "maxBytes": 12000 }
}
```

If multiple documents are connected and `target_document` is omitted, expected:
rejected with `ambiguous-document`; no mutation attempted.

### Mermaid Too Large

```json
{
  "format": "mermaid",
  "mermaidType": "flowchart",
  "insertMode": "new-page",
  "limits": { "maxBytes": 2000 },
  "mermaid": "<more than 2000 bytes of Mermaid source>"
}
```

Expected: rejected with `mermaid-too-large`; no mutation attempted.

### Deferred Examples

Process-flow diagrams can still use `mermaidType: "flowchart"` and
`insertMode: "new-page"` in M15.1. Existing-page insertion, embed mode and
sequence diagrams are deferred out of M15.1 even though the underlying
`import-mermaid` runtime may support some of them.

## Safety Controls

M15.1 should implement these controls before runtime import:

- closed input schema;
- only Mermaid, never model-generated draw.io XML;
- required maximum Mermaid bytes;
- optional conservative maximum nodes and edges for flowcharts;
- allowlisted Mermaid diagram type: flowchart only;
- reject unsupported syntax rather than passing arbitrary content as a
  successful MVP case;
- fail-closed document routing;
- explicit insertion mode: `new-page` only;
- no `target_page` in M15.1;
- no scripts, callbacks, commands, filesystem paths or network-triggering URLs
  in accepted Mermaid;
- sanitized errors;
- deterministic reason-code ordering;
- no XML, raw graph, raw snapshot or planner internals in responses;
- clear mutation report.

Already present:

- document routing and multiple-document fail-closed behavior;
- page selector schema;
- queued live mutation calls;
- draw.io Mermaid conversion and insertion;
- real-environment Mermaid import coverage;
- M14 read-only verification path.

Implemented by M15.1-M15.3:

- CyberDraw-specific closed wrapper schema;
- no-XML response mapping;
- explicit byte limit through required `limits.maxBytes`;
- precise mutation counters/reporting for the create operation;
- seven-code public M15 reason-code list;
- real HTTP-local demo evidence for the prompt-to-Mermaid-to-draw.io flow.

Not required for M15.1:

- complete Mermaid parser;
- AST;
- grammar implementation;
- server-side prompt interpretation;
- server-side LLM/provider integration;
- embed, replace or add insertion modes;
- sequence diagrams.

## Mutation And Atomicity

M15 is mutation-capable because it creates visible diagram content. This must be
explicit and must not reuse M13/M14 read-only safety wording.

Required M15 wording:

- `mutatesDiagram: true`;
- `mutationAttempted: false` for pre-runtime rejection;
- `mutationAttempted: true` once import is invoked;
- `mutationInvocations` reflects the wrapper's import invocation count;
- no claim of rollback;
- no claim of transaction semantics.

Atomicity should be described honestly:

- pre-runtime validation is all-or-nothing;
- draw.io import is invoked as one queued `import-mermaid` operation using
  native mode and `insert_mode: "new-page"`;
- if draw.io reports failure before insertion, no successful materialization is
  reported;
- if draw.io partially mutates before reporting an error, M15.1 must report
  `outcome: "failed"` or `outcome: "unknown"` with `atomic: "unknown"` unless
  real tests prove stronger behavior.
- M15.2 keeps this contract and hardens the runtime mapping: failures before
  the import request is dispatched report `mutationAttempted: false`; failures
  after the import request is dispatched report `mutationAttempted: true`,
  `mutationInvocations: 1` and `atomic: "unknown"` when the created page cannot
  be verified.

## Error Model

Outcomes:

- `accepted`: materialized and reported by draw.io;
- `rejected`: pre-runtime validation/routing failure, no mutation attempted;
- `failed`: runtime conversion or import failed after invocation;
- `unknown`: runtime result cannot prove whether mutation occurred.

Errors must be deterministic and sanitized. They must not include stack traces,
XML, Mermaid parser internals beyond bounded messages, local paths, hostnames,
raw browser exceptions or provider information.

M15.2 classifies runtime failures internally without expanding the public reason
code registry:

- validation and routing failures are rejected before runtime;
- initial page inventory failures occur before mutation;
- Mermaid render and plugin import failures occur after one mutating import
  invocation;
- post-import page verification failures are ambiguous and do not invent
  `created` metadata;
- reply timeouts are mapped to the existing `timeout` reason code;
- unexpected internal failures are collapsed to sanitized public reason codes.

The wrapper does not retry mutating imports. It uses the existing per-document
FIFO queue and sends at most one `import-mermaid` mutation request per accepted
M15 call.

## Testing Strategy

Unit tests:

- schema rejects unknown fields;
- required Mermaid byte limit;
- approximate node/edge limit for flowchart only if implemented;
- unsupported Mermaid type;
- rejects `insertMode` values other than `"new-page"`;
- rejects `target_page`;
- multiple documents without `target_document` fail closed;
- wrapper never returns XML from a successful import result;
- pre-runtime rejection has zero mutation invocations;
- runtime import increments mutation report exactly once;
- deterministic reason-code ordering.

Integration/server tests:

- wrapper delegates to existing `import-mermaid` path;
- delegation uses native mode and `insert_mode: "new-page"`;
- errors are sanitized;
- no M13/M14 contract changes;
- tool registration adds one M15 public creation tool without removing existing
  tools.

Real-environment tests:

- flowchart native import creates visible cells on a new page;
- invalid request does not mutate;
- too-large request does not mutate;
- ambiguous document is rejected;
- optional M14 analysis may verify created topology without exposing XML, but
  M15.1 acceptance does not depend on M14 verification.

## Demo Scenario

M15.3 demonstrates this prompt:

> Create a simple incident response flow: Alert -> Triage -> Investigate ->
> Contain -> Recover

Client/agent-generated Mermaid:

```mermaid
flowchart LR
  A[Alert] --> B[Triage]
  B --> C[Investigate]
  C --> D[Contain]
  D --> E[Recover]
```

Reproducible evidence:

- diagram visible in draw.io;
- coherent incident-response process nodes and connections;
- sanitized M15 response;
- exactly one created page;
- created page title `Incident Response Flow`;
- native draw.io vertices and edges produced by the Mermaid import;
- optional M14 read-only `count` or `summarize` verification remains
  non-blocking;
- HTTP real-environment test remains green.

Runbook:

- [`m15/reproducible-demo-m15.3.md`](m15/reproducible-demo-m15.3.md)

## Slices

### M15.0 - Design And Discovery

Status: completed.

Objective: documented the MVP route, reuse analysis, contract proposal, safety
model and slices.

Files:

- `docs/cyberdraw/milestones/M15-prompt-to-diagram-mvp.md`.

Tests:

- documentation validation only.

Acceptance:

- exact existing Mermaid capability is inventoried;
- server-side LLM is explicitly out of the MVP;
- recommended option and contract are clear.

Risk: design drift into a general generation platform.

Estimate: small.

Dependencies: M14 closure and existing Mermaid import evidence.

### M15.1 - Minimal MVP Implementation

Status: completed.

Objective: implemented `cyberdraw_create_diagram` as the minimal end-to-end MVP:
closed schema, simple limits, delegation to existing `import-mermaid` and a
sanitized `m15-v1` response.

Probable files:

- `packages/drawio-mcp-server/src/tools/cyberdraw-create-diagram.ts`;
- server tool registration;
- unit tests for schema, limits, delegation, safety and sanitized output.

Tests:

- server unit tests for closed schema, pre-runtime rejection and no XML output;
- delegation test proving native mode and `insert_mode: "new-page"`;
- no regression in M13/M14 public tool tests.

Acceptance:

- Mermaid-only input;
- `format: "mermaid"`, `mermaidType: "flowchart"` and `insertMode:
"new-page"` are the only accepted values;
- `target_page`, embed mode, `add`, `replace`, sequence diagrams and server-side
  prompt interpretation are rejected or absent from the schema;
- `limits.maxBytes` is required and enforced before runtime;
- `maxNodes` and `maxEdges` remain deferred;
- no XML output;
- reason codes are limited to the initial seven-code list;
- mutation report.

Risk: duplicating too much of `import-mermaid` instead of wrapping it narrowly.

Estimate: medium.

Dependencies: M15.0.

### M15.2 - Focused Runtime Hardening

Status: completed.

Objective: implemented focused hardening for the M15.1 wrapper with runtime edge
cases only after the minimal flow exists.

Probable files:

- M15 wrapper tool;
- focused helpers for sanitized import errors, reply classification and page
  verification.

Tests:

- draw.io Mermaid render failure mapping;
- import failure mapping;
- malformed plugin reply mapping;
- malformed initial and post-import page inventory mapping;
- timeout mapping and listener cleanup;
- no retry after mutating import rejection;
- no XML, stack trace, local path or raw browser exception leakage.

Acceptance:

- no broadening beyond M15.1;
- no new Mermaid types or insertion modes;
- failure responses remain sanitized and deterministic;
- ambiguous post-import results do not invent `created` metadata;
- mutation reporting distinguishes pre-dispatch failure from post-dispatch
  ambiguity;
- HTTP real-environment suite remains green.

Risk: draw.io Mermaid conversion can be version-sensitive.

Estimate: small.

Dependencies: M15.1.

### M15.3 - Real-Environment Demo And Closure

Status: completed.

Objective: validated and closed the MVP with reproducible evidence.

Files:

- `packages/drawio-mcp-server/src/real-environment/cyberdraw-create-diagram.test.ts`;
- [`m15/reproducible-demo-m15.3.md`](m15/reproducible-demo-m15.3.md);
- milestone and inventory documentation updates.

Tests:

- HTTP-local incident-response flowchart demo;
- invalid and too-large request coverage from M15.1/M15.2 unit tests;
- ambiguous document rejection coverage from M15.1/M15.2 unit tests;
- optional non-blocking M14 analysis verification remains outside the closure
  gate.

Acceptance:

- demo creates a visible process diagram from client-generated Mermaid;
- evidence records environment, commands and sanitized responses;
- residual limitations are documented honestly;
- the roadmap explicitly returns to the pre-M15 CyberDraw sequence after the
  narrow creation MVP closes.

Risk: HTTPS/Caddy harness limitation remains separate from the HTTP MVP.

Estimate: small.

Dependencies: M15.2.

## MVP Acceptance Criteria

1. A user provides a natural-language diagram request to an MCP-capable agent.
2. The agent generates supported bounded Mermaid.
3. The public CyberDraw create tool materializes a flowchart on a new page in a
   connected draw.io document.
4. The diagram appears visually in draw.io.
5. Nodes and connections are coherent with the user prompt.
6. Invalid requests are rejected before mutation.
7. Too-large requests are rejected by limits.
8. Responses do not expose XML or internal objects.
9. Mutation semantics are explicit.
10. Unit or integration tests cover validation, delegation and response mapping.
11. Real-environment tests cover materialization.
12. A reproducible prompt-to-Mermaid-to-draw.io demo exists.
13. M13 and M14 contracts do not regress, but M15 acceptance does not depend on
    M14 verification.
14. HTTP real-environment validation remains green.
15. Demo instructions are documented enough for another agent to repeat.

## Non-Goals

M15 does not include:

- server-side LLM/provider integration;
- API keys;
- model-generated draw.io XML;
- semantic diff;
- advanced semantic editing;
- persistence;
- sessions;
- rollback;
- transactions;
- complex approval workflows;
- complete-document structural execution;
- changes to `m13-v1` or `m14-v1`;
- changes to M14 closure status.

## Risks And Open Decisions

- Existing `import-mermaid` returns XML; the M15 wrapper does not.
- Mermaid support is draw.io-version-sensitive.
- Native support for non-flowchart Mermaid types is deferred until after M15.
- M15 did not introduce a full Mermaid parser. Node/edge counting remains
  deferred; M15 relies on required `limits.maxBytes`.
- Atomicity is not guaranteed; ambiguous post-dispatch results report
  `atomic: "unknown"` without invented `created` metadata.
- Real-environment evidence is HTTP-local. HTTPS/Caddy is not claimed as M15.3
  closure evidence.
- After M15.3 closes, work should return to CyberDraw's broader architecture
  intelligence roadmap instead of expanding prompt-to-diagram into a general
  generation platform.

## Final Architecture And Guarantees

Natural-language interpretation belongs to the MCP client or agent. The server
receives constrained Mermaid only and does not call an LLM.

Supported MVP:

- Mermaid flowchart only;
- `insertMode: "new-page"` only;
- internal native `import-mermaid` path;
- optional `target_document`;
- optional `title`;
- required `limits.maxBytes`.

Runtime guarantees:

- one public create tool, `cyberdraw_create_diagram`;
- closed public schema with no `target_page`;
- single FIFO mutation queue per resolved document connection;
- at most one mutating `import-mermaid` request per accepted M15 call;
- no mutating retry;
- before/after page verification;
- success requires exactly one newly-created page;
- explicit mutation reporting with `mutatesDiagram: true`;
- pre-runtime rejection reports `mutationAttempted: false` and
  `mutationInvocations: 0`;
- post-dispatch failures report `mutationAttempted: true`,
  `mutationInvocations: 1` and `atomic: "unknown"` when created-page evidence
  is ambiguous;
- public `import-mermaid` does not expose or accept `filename`; `title` is
  converted to internal `filename` only through the M15 wrapper path;
- bus logging redacts Mermaid, XML, stack traces and raw plugin payloads and is
  cycle-safe.

Non-guarantees:

- no rollback;
- no transaction semantics;
- no arbitrary Mermaid types;
- no target-page insertion from the wrapper;
- no server-side natural-language parser or LLM;
- no HTTPS/Caddy validation claim for M15.3.

## Closure

M15 closes with PASS WITH LIMITATIONS.

The implemented MVP demonstrates the intended product path: an MCP-capable
client or agent translates natural language into bounded Mermaid, the public
`cyberdraw_create_diagram` tool validates and imports it through the existing
draw.io Mermaid runtime, a new page is created in a real draw.io editor, and the
sanitized `m15-v1` response reports created page metadata and mutation counters
without XML or raw internals.

The limitation is environmental rather than contractual: M15.3 evidence is
HTTP-local real-environment evidence. HTTPS/Caddy is not part of the M15.3
closure claim.

## References

- Root tool reference: `../../../TOOLS.md`
- CyberDraw tool inventory: `../TOOLS-INVENTORY.md`
- Governance security policy: `../GOVERNANCE.md`
- M14 closure: `m14/formal-closure-m14.md`
- Existing server Mermaid tool:
  `../../../packages/drawio-mcp-server/src/tools/import-mermaid.ts`
- Existing real-environment Mermaid test:
  `../../../packages/drawio-mcp-server/src/real-environment/import-mermaid.test.ts`
