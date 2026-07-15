# ADR 0002: Runtime and Baseline Policy

## Status

Accepted.

## Context

M0 recorded an inherited runtime mismatch:

- user-facing documentation required Node.js 22 or newer;
- `drawio-mcp-server` and `drawio-mcp-dev-proxy` allowed Node.js 20 or newer;
- CI tested Node.js 22 and 24;
- release workflows used Node.js 24;
- Docker used `node:22-slim`;
- dependency auditing through pnpm 10.8.1 failed because that pnpm line used an
  npm audit endpoint that now returns HTTP 410.

CyberDraw MCP needs a single baseline policy without adding new diagramming
capabilities or changing the normal development package manager during M1.

## Decision

CyberDraw MCP adopts Node.js 22 LTS as the minimum supported runtime for M1.
Packages that already declare an engine must declare:

```json
{
  "engines": {
    "node": ">=22.0.0"
  }
}
```

Packages without an existing `engines` field are not changed in M1.

Normal development remains on the pinned root package manager:

```text
pnpm@10.8.1
```

This applies to installation, build, lint and tests.

Dependency auditing uses a separate exact pnpm version because pnpm 10.8.1 no
longer produces an actionable audit result:

```sh
corepack pnpm@11.13.0 --pm-on-fail=ignore audit --audit-level=moderate
```

The repository exposes this through the root `audit:dependencies` script. A
successful audit means the selected audit tool reported no advisories at or
above the configured threshold for the resolved dependency graph it inspected;
it does not prove the absence of vulnerabilities.

CI keeps Node.js 22 and 24 test lanes. Publishing workflows remain on Node.js
24. Docker remains based on Node.js 22.

## Consequences

- Node.js 20 is outside the supported CyberDraw MCP baseline.
- Upstream compatibility is preserved for Node.js 22 users and observed in a
  Node.js 24 forward-compatibility lane.
- The fork carries a small audit-specific pnpm divergence while retaining
  pnpm 10.8.1 for normal development.
- The audit command depends on Corepack being able to invoke pnpm 11.13.0 with
  `--pm-on-fail=ignore`. If GitHub Actions cannot execute that stable command,
  M1 must stop and document the blocker before introducing another scanner.

## Alternatives Considered

### Node.js 20 Minimum

Rejected because Node.js 20 is outside the supported CyberDraw policy and was
not part of the observed CI baseline.

### Node.js 24 Minimum

Rejected for M1 because Node.js 22 is still an LTS line and already covered by
CI and Docker. Raising the minimum to Node.js 24 would create unnecessary
compatibility churn during baseline hardening.

### Upgrade the Project Package Manager to pnpm 11

Rejected for M1. pnpm 10.8.1 remains the normal development package manager to
avoid changing install/build/test behavior and lockfile semantics in the same
milestone as baseline hardening.

### Add OSV Scanner

Rejected for M1. It would add a new external tool and maintenance surface while
the pnpm 11 audit command is sufficient to restore a reproducible automated
audit baseline for this milestone.
