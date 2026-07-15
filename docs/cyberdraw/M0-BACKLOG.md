# M0 Backlog

This backlog records follow-up work discovered while establishing the M0
baseline. It is not an implementation plan for M0 itself.

## P0

### M0-P0-001: Align Node version policy

- Type: Decision pending.
- Description: README requires Node 22+, package engines allow Node >=20, CI runs
  22/24 and Docker uses Node 22.
- Evidence: `README.md`, `packages/drawio-mcp-server/package.json`,
  `packages/drawio-mcp-dev-proxy/package.json`, `.github/workflows/server-ci.yml`,
  `Dockerfile`.
- Impact: Users may attempt Node 20 runs outside the documented/CI baseline;
  contributors lack a single baseline.
- Proposal: Adopt Node 22 LTS as official minimum and Node 24 as CI
  forward-compatibility lane; align docs/engines in one explicit change.
- Effort: S.
- Suggested milestone: M1.

### M0-P0-002: Replace or repair dependency audit baseline

- Type: Confirmed defect.
- Description: `pnpm audit --audit-level=moderate` fails with HTTP 410 from npm
  audit endpoint.
- Evidence: M0 audit command output.
- Impact: CI/local security baseline may become non-actionable.
- Proposal: Evaluate pnpm audit support, npm bulk advisory endpoint, GitHub
  Dependabot, OSV Scanner or another pinned audit tool.
- Effort: M.
- Suggested milestone: M1.

### M0-P0-003: Document and constrain network exposure defaults

- Type: Risk.
- Description: HTTP MCP and WebSocket endpoints are unauthenticated by design.
- Evidence: `SECURITY.md` and server config docs.
- Impact: Unsafe deployment can expose full diagram control.
- Proposal: Add CyberDraw deployment profiles and require loopback/auth proxy in
  production guidance.
- Effort: S.
- Suggested milestone: M1.

### M0-P0-004: Define `output_path` policy

- Type: Risk.
- Description: `export-diagram` writes to absolute filesystem paths with process
  privileges.
- Evidence: `packages/drawio-mcp-server/src/tools/export-diagram.ts`.
- Impact: Trusted MCP clients can overwrite writable files.
- Proposal: Document trusted-client semantics now; later consider allowlist or
  workspace-bound export configuration.
- Effort: S for docs, M for implementation.
- Suggested milestone: M1/M2.

## P1

### M0-P1-001: Complete third-party license inventory

- Type: Technical debt.
- Description: `THIRD_PARTY_NOTICES.md` is intentionally incomplete.
- Evidence: M0 third-party notices pending review list.
- Impact: Distribution risk for fork artifacts.
- Proposal: Generate and review a dependency/license inventory, then add verified
  notices only.
- Effort: M.
- Suggested milestone: M1.

### M0-P1-002: Make Playwright prerequisite explicit

- Type: Confirmed defect.
- Description: `pnpm install` does not install Chromium, but real-environment
  tests require it.
- Evidence: Initial `pnpm run test` failure and CI `playwright install` step.
- Impact: New contributors get failing tests without clear local setup.
- Proposal: Add local baseline docs and optionally a non-mutating preflight check.
- Effort: S.
- Suggested milestone: M1.

### M0-P1-003: Track draw.io asset provenance per release

- Type: Risk.
- Description: Built-in editor uses cached/downloaded draw.io assets.
- Evidence: asset downloader and compatibility docs.
- Impact: Runtime behavior can shift with upstream draw.io releases.
- Proposal: Record draw.io asset version in release notes or generated baseline.
- Effort: M.
- Suggested milestone: M1.

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

- Type: Decision pending.
- Description: `drawio-mcp-plugin` has no `test` script.
- Evidence: `packages/drawio-mcp-plugin/package.json`.
- Impact: Plugin behavior is tested indirectly through server real-environment
  tests.
- Proposal: Decide whether indirect coverage is sufficient or add plugin-local
  unit tests.
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
