# Upstream Tracking

## Original Repository

Original upstream:

```text
https://github.com/lgazo/drawio-mcp-server.git
```

Configured remotes during M0:

```text
origin   https://github.com/sergiovigo/cyberdraw-mcp.git
upstream https://github.com/lgazo/drawio-mcp-server.git
```

## Fork Strategy

CyberDraw MCP starts as a conservative fork of Draw.io MCP Server. M0 does not
rename packages, change branding, add tools or change architecture. The fork
first establishes a reproducible baseline and documents inherited behavior.

## Synchronization Rules

1. Keep `upstream` pointing at the original repository.
2. Pull upstream changes into a dedicated sync branch.
3. Review upstream changes against CyberDraw documentation and security baseline.
4. Run the full reproducible baseline before merging upstream syncs.
5. Document any fork-specific divergence in this file or a dated ADR under
   `docs/cyberdraw/`.
6. Do not mix upstream syncs with CyberDraw feature work.

## Compatibility

The inherited project tracks draw.io runtime compatibility with:

- plugin-side compatibility dispatch;
- server-side compatibility logging;
- shared semver helpers;
- asset auto-refresh checks.

CyberDraw should preserve that compatibility layer until a specific later
milestone deliberately changes the draw.io support policy.

## Known Divergences at M0

No functional CyberDraw divergences were introduced during M0. M0 adds fork
documentation and governance only.

Inherited documentation/implementation differences to track:

- Node version policy differs between README, package engines, Docker and CI.
- The historical vendoring plan expected copying the whole compat source tree,
  while the current script copies only `src/index.ts`.
- CI audit command currently fails locally with an npm endpoint 410.

## Updating From Upstream

Suggested procedure:

```sh
git fetch upstream
git switch -c chore/upstream-sync-YYYY-MM-DD
git merge upstream/main
pnpm install --frozen-lockfile
pnpm run build
pnpm --filter drawio-mcp-server run lint
pnpm --filter drawio-mcp-server exec playwright install chromium
pnpm run test
```

If the lockfile changes during an upstream sync, document whether it came from
upstream or from local dependency resolution. Do not update dependencies merely
to satisfy CyberDraw docs without a separate maintenance task.
