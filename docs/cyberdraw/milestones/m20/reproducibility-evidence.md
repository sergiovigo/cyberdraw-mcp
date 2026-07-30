# M20 Reproducibility Evidence

## Status

READY FOR FINAL M20 AUDIT.

## Baselines

| Area                           | Value                                      |
| ------------------------------ | ------------------------------------------ |
| Base commit                    | `2048df3cc3e1c6d11a94a627c43e1ace994bfae1` |
| Package manager                | `pnpm@10.8.1`                              |
| Node requirement               | `>=22.0.0`                                 |
| Current server package version | `2.2.0`                                    |
| Official artifact candidate    | `drawio-mcp-server` npm package            |

## Release Manifest Shape

A release manifest for the MVP should contain:

```json
{
  "productName": "CyberDraw MCP",
  "packageName": "drawio-mcp-server",
  "packageVersion": "2.2.0",
  "sourceCommit": "<release-commit>",
  "node": {
    "minimum": "22.0.0",
    "validated": ["22", "24"]
  },
  "packageManager": "pnpm@10.8.1",
  "drawioAsset": {
    "releaseTag": "v31.1.5",
    "assetName": "draw.war",
    "url": "https://github.com/jgraph/drawio/releases/download/v31.1.5/draw.war",
    "sizeBytes": 52730014,
    "sha256": "43b0437762cf25375e233726d6539792584c4bd38176e4eceae5ea4359090278",
    "sha512": "56ea7da0efd96f70aca9d0190a87adc5290660c0941291f704bb94c407f7a07f380251a61dcbed77fff25661cd990668724acd7cd21ed0b1a3c16338e3018b38"
  },
  "artifacts": [],
  "licenseInventory": "docs/cyberdraw/milestones/m20/license-inventory.md",
  "knownAdvisories": []
}
```

M20 records the current concrete manifest at
[`release-manifest.json`](release-manifest.json). It is evidence for the current
artifact candidate, not a final release declaration.

Do not include timestamps in reproducibility-critical artifact hashes unless
the build system explicitly normalizes them.

## Commands Executed During M20

Asset provenance:

```sh
curl -L https://github.com/jgraph/drawio/releases/download/v31.1.5/draw.war -o /tmp/.../draw.war
sha256sum /tmp/.../draw.war
sha512sum /tmp/.../draw.war
```

Package inspection:

```sh
npm pack --dry-run --json
corepack pnpm@10.8.1 pack --pack-destination <tmp>
corepack pnpm@10.8.1 --filter drawio-mcp-server run pack:artifact -- --out <tmp>
corepack pnpm@10.8.1 --filter drawio-mcp-server run verify:artifact -- <tmp>/drawio-mcp-server-2.2.0.tgz
```

Clean install probe:

```sh
mkdir <tmp>/install
cd <tmp>/install
npm init -y
npm install <tmp>/drawio-mcp-server-2.2.0.tgz
```

and:

```sh
HOME=<tmp>/home corepack pnpm@10.8.1 --store-dir <tmp>/store --dir <tmp>/app add <tmp>/drawio-mcp-server-2.2.0.tgz
HOME=<tmp>/home corepack pnpm@10.8.1 --dir <tmp>/app exec drawio-mcp-server --help
```

## Result

Package generation and clean installation work after M20 strategy B:

- `cyberdraw-graph-model@0.0.0` and `cyberdraw-runtime-contract@0.0.0`
  remain private workspace packages;
- the build bundles those private runtime dependencies into
  `build/vendored/`;
- `pack:artifact` writes distributed metadata without `workspace:*` or private
  `cyberdraw-*` runtime dependency declarations;
- clean install outside the monorepo succeeds;
- `drawio-mcp-server --help` runs from the clean install.

Observed artifact:

| Field         | Value                                                                                                                              |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| File          | `drawio-mcp-server-2.2.0.tgz`                                                                                                      |
| Entries       | 73                                                                                                                                 |
| SHA-256       | `57ba4e26955206079f44279ca0b552b9a32a76e794eb0dba78a8e00191793013`                                                                 |
| SHA-512       | `8b2676aa9380d220e202b0ee2e411e0a264481ef45feb03624a2bd3360aa0ffa7a1314edc652b38ac5e01117821cd8f91a5a33dd97c2417557c81d241723fe04` |
| Help smoke    | PASS                                                                                                                               |
| Clean install | PASS                                                                                                                               |

Two consecutive tarballs from the same source tree produced matching entry
lists, matching normalized per-file hashes and the same tarball SHA-256 in the
observed environment.

Artifact permission evidence:

- `package/build/index.js`: `0755`;
- regular JavaScript, metadata and notice files: `0644`;
- no symlinks, absolute paths or `..` traversal paths;
- staging package directory and temporary npm `HOME` cleanup verified for both
  successful and failing artifact generation.

## Evidence Level

| Area                              | Result                       |
| --------------------------------- | ---------------------------- |
| Source install                    | REPRODUCIBLE IN WORKSPACE    |
| Server package generation         | PROVEN FOR M20               |
| Server package content hygiene    | PROVEN FOR M20               |
| Clean user install from tarball   | PROVEN FOR M20               |
| Built-in editor asset provenance  | RESOLVED FOR PINNED DOWNLOAD |
| Cold-cache editor functional flow | M21 REQUIRED                 |
| License inventory                 | PARTIAL                      |

## Required Follow-Up

Before M21 final product acceptance:

- replay the clean install from the final release commit;
- run the full product flow from a clean MCP client configuration;
- verify cold-cache and warm-cache editor startup;
- complete draw.io WAR notice review or explicitly accept the residual
  limitation.
