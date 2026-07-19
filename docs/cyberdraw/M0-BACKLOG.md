# M0 Backlog

This backlog records follow-up work discovered while establishing the M0
baseline. It is not an implementation plan for M0 itself.

## P0

### M0-P0-001: Align Node version policy

- Type: Resolved in M1.
- Description: README requires Node 22+, package engines allow Node >=20, CI runs
  22/24 and Docker uses Node 22.
- Evidence: `README.md`, `packages/drawio-mcp-server/package.json`,
  `packages/drawio-mcp-dev-proxy/package.json`, `.github/workflows/server-ci.yml`,
  `Dockerfile`.
- Impact: Users may attempt Node 20 runs outside the documented/CI baseline;
  contributors lack a single baseline.
- Proposal: Adopt Node 22 LTS as official minimum and Node 24 as CI
  forward-compatibility lane; align docs/engines in one explicit change.
- M1 resolution: ADR 0002 adopts Node.js 22 LTS as the minimum supported
  runtime, keeps Node.js 22/24 CI lanes, keeps publish workflows on Node.js 24,
  and updates existing `engines.node` declarations to `>=22.0.0`.
- Effort: S.
- Suggested milestone: M1 (closed).

### M0-P0-002: Replace or repair dependency audit baseline

- Type: Resolved in M1.
- Description: `pnpm audit --audit-level=moderate` fails with HTTP 410 from npm
  audit endpoint.
- Evidence: M0 audit command output.
- Impact: CI/local security baseline may become non-actionable.
- Proposal: Evaluate pnpm audit support, npm bulk advisory endpoint, GitHub
  Dependabot, OSV Scanner or another pinned audit tool.
- M1 resolution: root `audit:dependencies` runs
  `corepack pnpm@11.13.0 --pm-on-fail=ignore audit --audit-level=moderate`.
  pnpm 10.8.1 remains the normal install/build/lint/test package manager.
  CI uses the same script. OSV Scanner was not added.
- Effort: M.
- Suggested milestone: M1 (closed).

### M0-P0-003: Document and constrain network exposure defaults

- Type: Resolved in M1.
- Description: HTTP MCP and WebSocket endpoints are unauthenticated by design.
- Evidence: `SECURITY.md` and server config docs.
- Impact: Unsafe deployment can expose full diagram control.
- Proposal: Add CyberDraw deployment profiles and require loopback/auth proxy in
  production guidance.
- M1 resolution: default host is `127.0.0.1` for HTTP MCP, editor HTTP and
  WebSocket. Wildcard hosts remain explicit, emit a logger warning, and Docker
  passes `--transport http --host 0.0.0.0` to preserve container port
  publishing.
- Effort: S.
- Suggested milestone: M1 (closed).

### M0-P0-004: Define `output_path` policy

- Type: Resolved in M1 for minimum hardening; future sandbox remains open.
- Description: `export-diagram` writes to absolute filesystem paths with process
  privileges.
- Evidence: `packages/drawio-mcp-server/src/tools/export-diagram.ts`.
- Impact: Trusted MCP clients can overwrite writable files.
- Proposal: Document trusted-client semantics now; later consider allowlist or
  workspace-bound export configuration.
- M1 resolution: `output_path` remains trusted-client functionality but now
  rejects relative paths, missing or non-directory parents, destination
  directories and destination symbolic links. Regular file overwrite remains
  supported. Sandbox/allowlist remains deferred.
- Effort: S for docs, M for implementation.
- Suggested milestone: M1 (minimum hardening closed); M2 for optional sandbox.

## P1

### M0-P1-005: Review Architecture Intelligence Foundation RFC

- Type: Architecture location resolved by ADR 0003; runtime integration remains
  open.
- Description: `docs/cyberdraw/rfc/0001-internal-graph-model.md` proposes an
  internal graph model for semantic diagram queries, validation and analysis.
- Evidence: RFC 0001, supporting example JSON and Mermaid diagrams.
- Impact: Provides a decision point for future implementation without changing
  inherited MCP tools, plugin behavior or draw.io as the operational format.
- Proposal: Review open decisions, validate the preferred package/server-first
  direction with a small read-only prototype plan, and decide whether an
  implementation ADR is warranted.
- M2 update: `packages/cyberdraw-graph-model` and
  `docs/cyberdraw/spikes/0001-internal-graph-readonly.md` validate a pure
  read-only prototype for normalized snapshots, provisional identity and broken
  reference detection. No MCP API, WebSocket protocol or persistence change was
  introduced.
- ADR 0003 resolution: RFC 0001 Alternative C is accepted as a private,
  server-first internal package architecture. The decision does not stabilize
  identity, `CanonicalDiagramInput`, JSON Schema, persisted findings, change
  plans, semantic diff, WebSocket integration or new MCP tools. Runtime
  integration is deferred until the ADR exit criteria are met.
- M3 update: `docs/cyberdraw/spikes/0002-runtime-snapshot-handler.md` records an
  internal read-only runtime snapshot handler prototype. It adds a private
  versioned server-plugin message, runtime snapshot adapter and real
  visible/background page evidence, but still does not add public MCP tools,
  public schemas, persistence, stable identity or semantic diff.
- M4 update: `docs/cyberdraw/milestones/M4-runtime-snapshot-product-hardening.md`
  records internal capability negotiation, shared runtime contract, hard payload
  policy, deterministic versioned content revision and stale-read comparison
  helpers. Runtime snapshots remain private and no public MCP tool is added.
- M5 update: `docs/cyberdraw/milestones/M5-scoped-snapshot-delivery.md`
  records private scoped runtime snapshot delivery for document, pages, layers
  and selection scopes. It keeps the path internal, adds no public MCP tool and
  preserves document-only compatibility for older peers.
- M6 update: `docs/cyberdraw/milestones/M6-runtime-snapshot-benchmarks.md`
  records synthetic benchmark evidence for document, pages, layers and
  selection scopes. Draft ADR 0004 proposes scoped/hierarchical snapshots as the
  M7 scaling strategy, with chunking and incremental analysis deferred.
- M7 update:
  `docs/cyberdraw/milestones/M7-real-environment-snapshot-benchmarks.md`
  records real draw.io browser benchmark evidence for document, pages, layers
  and selection scopes. ADR 0004 is accepted with a scope-first/hierarchical
  strategy; chunking, streaming and incremental analysis remain deferred.
- M8 update:
  `docs/cyberdraw/milestones/M8-hierarchical-snapshot-planner.md` implements
  that accepted strategy as private internal planner/executor code.
  `docs/cyberdraw/milestones/M8.1-real-external-reference-expansion.md` closes
  the remaining M8 gap with real draw.io evidence for multi-step expansion from
  a resolvable external terminal reference. It adds no public MCP tool,
  persistence, chunking, streaming or stable identity.
- M9 update:
  `docs/cyberdraw/milestones/M9-internal-structural-analysis.md` implements the
  first private structural analysis vertical over M8 output. It adds pure graph
  analysis for broken references, cross-layer edges, conservative orphans,
  counts and coverage/completeness. It adds no public MCP tool, public schema,
  persistence, semantic diff, change plan, mutation plan or stable identity.
- M10 update:
  `docs/cyberdraw/milestones/M10-internal-structural-queries.md` implements a
  private deterministic query layer over already materialized M9 structural
  analysis results. It adds exact filters, closed ordering/grouping, pagination,
  count reuse, coverage requirements and private server reuse of the same M9
  result. It adds no public MCP tool, public schema, endpoint, persistence,
  search language, semantic diff, change plan, mutation plan or stable
  identity.
- M11 update:
  `docs/cyberdraw/milestones/M11-internal-structural-change-planning.md`
  implements a private deterministic proposal planner over M9 findings and M10
  selections. It adds closed policies, declarative abstract operations,
  preconditions, expected postconditions, deterministic plan/proposal/conflict
  IDs and private server reuse of the same M9/M10 results. It adds no public MCP
  tool, public schema, endpoint, persistence, XML editing, draw.io command
  execution, approval workflow, semantic diff, rollback executor, mutation
  application or stable identity.
- Effort: M.
- Suggested milestone: Architecture Intelligence Foundation runtime integration
  hardening and compatibility evidence.

### M0-P1-001: Complete third-party license inventory

- Type: Partially addressed in M1; full inventory remains open.
- Description: `THIRD_PARTY_NOTICES.md` is intentionally incomplete.
- Evidence: M0 third-party notices pending review list.
- Impact: Distribution risk for fork artifacts.
- Proposal: Generate and review a dependency/license inventory, then add verified
  notices only.
- M1 update: `THIRD_PARTY_NOTICES.md` now records the reproducible
  `pnpm licenses list --recursive --json` command, Caddy 2.8.4 SHA512
  verification behavior, and draw.io asset download behavior. Full per-dependency
  notice review remains pending.
- Effort: M.
- Suggested milestone: M2.

### M0-P1-002: Make Playwright prerequisite explicit

- Type: Resolved in M1.
- Description: `pnpm install` does not install Chromium, but real-environment
  tests require it.
- Evidence: Initial `pnpm run test` failure and CI `playwright install` step.
- Impact: New contributors get failing tests without clear local setup.
- Proposal: Add local baseline docs and optionally a non-mutating preflight check.
- M1 resolution: baseline, development and AI onboarding docs explicitly require
  `pnpm --filter drawio-mcp-server exec playwright install chromium`. No
  Playwright postinstall hook was added.
- Effort: S.
- Suggested milestone: M1 (closed).

### M0-P1-003: Track draw.io asset provenance per release

- Type: Partially addressed in M1; release pinning remains open.
- Description: Built-in editor uses cached/downloaded draw.io assets.
- Evidence: asset downloader and compatibility docs.
- Impact: Runtime behavior can shift with upstream draw.io releases.
- Proposal: Record draw.io asset version in release notes or generated baseline.
- M1 update: third-party notices now document the latest-release `draw.war`
  download behavior and state that CyberDraw releases do not yet pin a specific
  draw.io asset version.
- Effort: M.
- Suggested milestone: M2.

### M0-P1-004: Add explicit path traversal tests before path handling changes

- Type: Risk.
- Description: Asset serving and `output_path` are path-sensitive.
- Evidence: server editor routes and export tool code.
- Impact: Future edits can introduce traversal or unsafe writes.
- Proposal: Add regression tests only when path-handling code is touched.
- Effort: M.
- Suggested milestone: M2.

## P2

### M0-P2-001: Consider authenticated deployment mode

- Type: Future idea.
- Description: Auth is delegated to the environment.
- Evidence: `SECURITY.md`.
- Impact: Non-local deployments need custom reverse proxy setup.
- Proposal: Evaluate optional token/mTLS guidance or server-side auth hooks.
- Effort: L.
- Suggested milestone: M2.

### M0-P2-002: Decide plugin test strategy

- Type: Partially addressed by real-environment coverage; decision pending.
- Description: `drawio-mcp-plugin` has no `test` script.
- Evidence: `packages/drawio-mcp-plugin/package.json`.
- Impact: Plugin behavior is tested indirectly through server real-environment
  tests.
- Proposal: Decide whether indirect coverage is sufficient or add plugin-local
  unit tests.
- M3 update: runtime snapshot behavior is covered through server
  real-environment tests because the plugin still has no package-local `test`
  script. A formal plugin-local unit test strategy remains open.
- M4 update: the shared contract has unit tests, but plugin extraction remains
  covered indirectly through server real-environment tests.
- Effort: M.
- Suggested milestone: M2.

### M0-P2-003: Normalize vendored compat process

- Type: Technical debt.
- Description: Historical plan and current script differ on copying one file vs.
  the whole compat source tree.
- Evidence: `docs/superpowers/plans/2026-07-02-vendor-compat-into-server.md`
  and `packages/drawio-mcp-server/package.json`.
- Impact: Future compat expansion may break server vendoring assumptions.
- Proposal: Document current one-file contract or update plan/scripts in a
  focused maintenance task.
- Effort: S.
- Suggested milestone: M1/M2.

## P3

### M0-P3-001: Clean up obsolete planning docs

- Type: Technical debt.
- Description: `docs/superpowers/plans/*` contain historical implementation
  plans with unchecked steps.
- Evidence: existing plan files.
- Impact: Contributors can confuse historical plans with current backlog.
- Proposal: Add an index marking them historical; do not delete.
- Effort: S.
- Suggested milestone: M2.

### M0-P3-002: Improve local command wrappers

- Type: Confirmed defect.
- Description: `AGENTS.md` requires `rtk` and `roam`, but they were unavailable
  in this environment.
- Evidence: command lookup during M0.
- Impact: Agents need a documented fallback to avoid blocking baseline work.
- Proposal: Keep preferred tools, document fallback procedure.
- Effort: S.
- Suggested milestone: M0/M1.
