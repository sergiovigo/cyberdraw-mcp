# M20 Draw.io Asset Provenance

## Status

RESOLVED FOR PINNING / PARTIAL FOR LICENSE NOTICE REVIEW.

## Runtime Behavior Before M20

The built-in editor downloader discovered the latest draw.io release at runtime
through:

```text
https://api.github.com/repos/jgraph/drawio/releases/latest
```

That made cold-cache installs nondeterministic because two users could obtain
different draw.io editor versions from the same CyberDraw package version.

## Pinned Asset

M20 pins the built-in editor asset to:

| Field               | Value                                                                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Upstream repository | `jgraph/drawio`                                                                                                                    |
| Release tag         | `v31.1.5`                                                                                                                          |
| Release page        | `https://github.com/jgraph/drawio/releases/tag/v31.1.5`                                                                            |
| Asset name          | `draw.war`                                                                                                                         |
| Asset URL           | `https://github.com/jgraph/drawio/releases/download/v31.1.5/draw.war`                                                              |
| Size                | `52730014` bytes                                                                                                                   |
| SHA-256             | `43b0437762cf25375e233726d6539792584c4bd38176e4eceae5ea4359090278`                                                                 |
| SHA-512             | `56ea7da0efd96f70aca9d0190a87adc5290660c0941291f704bb94c407f7a07f380251a61dcbed77fff25661cd990668724acd7cd21ed0b1a3c16338e3018b38` |

## Enforcement

`packages/drawio-mcp-server/src/assets/downloader.ts` now records the pinned
asset in `DRAWIO_ASSET_PROVENANCE`.

The downloader:

1. downloads the pinned WAR URL;
2. computes SHA-256 and SHA-512;
3. fails closed if either checksum differs;
4. extracts only after successful checksum verification;
5. removes `META-INF` and `WEB-INF` from the extracted webapp, preserving the
   existing runtime behavior.

## Cache Behavior

The editor cache remains controlled by the existing asset manager and user
asset path:

- default cache path is derived from the existing server asset logic;
- `--asset-path <path>` can override the cache root;
- existing compatibility checks can trigger a refetch;
- refetch now uses the pinned release, not upstream `latest`.

## Offline Behavior

Offline behavior is unchanged:

- warm cache: editor can use already-extracted valid assets;
- cold cache: editor cannot fetch the pinned WAR and startup must report the
  asset fetch failure.

M21 must replay the cold-cache and warm-cache user flow from a clean
installation.

## License Evidence

The pinned WAR contains license files for several bundled asset groups,
including:

- `img/LICENSE`;
- `shapes/LICENSE`;
- `stencils/LICENSE`;
- `templates/LICENSE`;
- `js/libavoid-js/LICENSE`.

M20 records their presence but does not declare the draw.io WAR notice review
complete. Full notice review remains required before external distribution.
