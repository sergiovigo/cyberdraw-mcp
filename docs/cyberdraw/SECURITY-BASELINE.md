# CyberDraw MCP Security Baseline

This is a baseline inventory, not a full security audit.

## Surfaces

### MCP stdio

Local stdio is trusted by construction: any MCP client that starts the process
can call every registered tool. Stdout must contain only MCP JSON-RPC frames.
Diagnostics go to stderr or MCP logging notifications.

### MCP HTTP

The HTTP MCP endpoint is `/mcp`. It is unauthenticated by default and can be
enabled with `--transport http` or implicitly by `--editor`.

Risk: exposing it beyond loopback allows unauthenticated tool invocation.

Recommendation P0: bind to `127.0.0.1` by default in local docs and require an
authenticating reverse proxy for any non-local deployment.

### Built-in Editor HTTP

When `--editor` is enabled, the server serves draw.io assets and the plugin
script over HTTP or HTTPS. The editor does not launch a browser by itself.

Risk: browser execution surface is inherited from draw.io assets and imported
diagram content.

Recommendation P1: document asset provenance and review update policy before
publishing CyberDraw-specific releases.

### WebSocket / WSS

The plugin connects to the server WebSocket port, default `3333`. There is no
per-connection authentication. Any local or network peer able to connect can
masquerade as a plugin session.

Risk: fake plugin peers can register documents, receive tool calls and return
arbitrary responses. On exposed interfaces this becomes a control/data channel.

Recommendation P0: keep WebSocket bound to loopback unless an explicit secure
deployment model is documented.

## Authentication and Authorization

No built-in authentication or per-tool authorization exists. The surrounding MCP
host and deployment environment are trusted. All tools are available to any MCP
client connected to the server.

Recommendation P1: document a deployment profile matrix before adding
CyberDraw-specific capabilities.

## Validation

Server-side schemas use Zod for MCP tool inputs. The plugin also filters incoming
message fields against its registry before executing handlers.

Important gaps:

- draw.io style strings remain domain-specific free-form input;
- XML/SVG/PNG embedded diagram data is interpreted by draw.io/browser code;
- fake WebSocket peers are not authenticated.

## XML, HTML and Diagram Content

Diagram XML and embedded SVG/PNG XML should be treated as untrusted input.
Imported content is passed into draw.io runtime APIs. Exported SVG/XML can carry
embedded diagram data and should be treated as sensitive if diagrams contain
internal architecture or security information.

Recommendation P1: add user-facing warnings and tests for import/export safety
boundaries before accepting external diagram input sources.

## `output_path`

`export-diagram` can write exported content to an absolute path. The server
checks that the path is absolute and that the destination directory exists.

Risks:

- writes happen with the privileges of the server process;
- allowed absolute paths may overwrite files if the process has permission;
- no workspace boundary is enforced;
- output path policy is not configurable.

Recommendation P0: for CyberDraw deployments, run the server as a low-privilege
user and document that `output_path` is trusted-client functionality. Consider a
future allowlist/sandbox setting in a later milestone.

## Path Traversal

The observed `output_path` implementation does not construct paths from relative
segments; it requires an absolute path and existing directory. Static editor
asset serving uses filesystem paths under the configured asset root; this should
remain covered by tests if changed.

Recommendation P1: add explicit path traversal tests if asset serving or export
path handling is modified.

## Storage

Persistent storage surfaces:

- browser extension config in browser sync/local storage;
- TLS auto-generated CA and keys under XDG data paths;
- draw.io assets cache;
- Playwright/browser caches for tests;
- Caddy binary from dev-proxy postinstall;
- exported diagram files requested by MCP clients.

Recommendation P1: document what is inside and outside the Git workspace for
reproducible builds.

## Assets

Built-in editor mode downloads/caches draw.io assets from upstream releases.
Runtime version compatibility logic exists to detect supported windows.

Risk: upstream draw.io changes can affect plugin behavior.

Recommendation P1: keep upstream asset compatibility tests in the baseline and
record the observed draw.io version when release artifacts are produced.

## Dependencies

`pnpm install --frozen-lockfile` succeeded. `pnpm audit --audit-level=moderate`
failed because the npm audit endpoint returned HTTP 410; no advisory result was
obtained.

Recommendation P0: choose a working dependency audit command or pnpm version for
CyberDraw CI without changing dependencies ad hoc.

## Prioritized Recommendations

| Priority | Recommendation |
| --- | --- |
| P0 | Define official Node/pnpm baseline and working audit command for CI |
| P0 | Keep HTTP and WebSocket on loopback unless protected by an auth proxy |
| P0 | Document `output_path` as trusted-client filesystem write capability |
| P1 | Create third-party notices and asset provenance review |
| P1 | Add explicit deployment security profiles |
| P1 | Add path traversal regression tests before changing file/path code |
| P2 | Consider optional auth/token mechanism for HTTP/WebSocket deployments |
| P2 | Consider export path allowlist/sandbox configuration |
