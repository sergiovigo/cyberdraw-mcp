# M17.2 - Runtime Snapshot Identity Evidence

## Status

COMPLETE WITH LIMITATIONS.

This document records M17.2 runtime evidence for the internal M17 identity
model. It does not expose identity through MCP, does not change runtime
contracts, does not implement semantic diff and does not accept ADR 0008.

## Environment

Classification: REAL LOCAL HTTP.

Evidence command:

```bash
NODE_OPTIONS=--experimental-vm-modules pnpm --filter drawio-mcp-server exec jest build/real-environment/m17-runtime-identity-evidence.test.js --runInBand
```

Observed result:

- 1 suite passed;
- 1 test passed;
- test file:
  `packages/drawio-mcp-server/src/real-environment/m17-runtime-identity-evidence.test.ts`.

The harness uses:

- real Chromium through Playwright;
- draw.io served by the repository HTTP harness;
- the real browser plugin;
- the real server runtime WebSocket;
- `InMemoryTransport` only for the MCP client side;
- real runtime snapshot extraction through `cyberdraw.runtimeSnapshot.v1`.

This is not HTTPS/Caddy evidence.

## Runtime To Identity Mapping

M17.2 uses a test-local mapper from `RuntimeSnapshot` entities to
`StableIdentityEvidence`. The mapper is intentionally not production API.

| Entity type | Runtime source | Identity evidence |
| --- | --- | --- |
| Document | `snapshot.document.id` or `snapshot.document.revisionSignals.documentId` | `documentId` context. Missing document context fails the test because `EXACT` requires document context. |
| Page | `RuntimeSnapshotPage.id`, `index`, `name` | `entityType: "page"`, `rawAnchor: page.id`, document context and private page signature. |
| Layer | `RuntimeSnapshotLayer.id`, `pageId`, `index`, `name` | `entityType: "layer"`, `rawAnchor: layer.id`, owning page context and private layer signature. |
| Element / node | `RuntimeSnapshotElement.id`, `pageId`, `layerId`, `type`, bounded label/style/geometry material | `entityType: "element"`, `rawAnchor: element.id`, page context, optional layer context and private signature. |
| Edge | `RuntimeSnapshotElement` with `type: "edge"`, `sourceId`, `targetId` | `entityType: "edge"`, `rawAnchor: edge.id`, endpoint material only inside private signature evidence. |
| External reference | `snapshot.scope.externalReferences[]` | `entityType: "external-reference"`, scoped raw anchor built from page, element, reference type and referenced target fields. |

Fields deliberately not exposed:

- raw XML;
- raw graph/cells;
- runtime snapshot payloads;
- public MCP identity fields;
- raw signature material.

Labels used in the real test are controlled fixture labels. The mapper hashes
signature material and does not log or return it.

## Evidence Matrix

| Case | Classification | Observed behavior | Matcher outcome |
| --- | --- | --- | --- |
| Unchanged entity across consecutive snapshots | REAL-PROVEN | draw.io preserved document, page, layer, node and edge raw IDs in consecutive snapshots. | `EXACT`, `exact-raw-anchor` |
| Reordered extraction | REAL-PROVEN | Reordered candidate list did not change the selected source node match. | `EXACT`, `exact-raw-anchor` |
| Node geometry move | REAL-PROVEN | `edit-cell` changed geometry while preserving node raw ID and page context. | `EXACT`, `exact-raw-anchor` |
| Node move within same layer | REAL-PROVEN by geometry move | Position changed inside the same layer without changing raw ID. | `EXACT`, `exact-raw-anchor` |
| Node move across layers | REAL-PROVEN | `move-cell-to-layer` changed layer context while preserving node raw ID and page context. | `EXACT`, `exact-raw-anchor`, `layer-context-changed` |
| Rename layer | REAL-PROVEN | Layer cell value changed while layer raw ID and owning page context remained stable. | `EXACT`, `exact-raw-anchor` |
| Edit node label/content | REAL-PROVEN | Label changed while node raw ID and page context remained stable. | `EXACT`, `exact-raw-anchor` |
| Clone / copied visual object | PARTIALLY-PROVEN | `copy-page` produced a copied page containing the same controlled visual label. The copied entity was not treated as exact continuity of the source entity. | Not `EXACT`; current outcome depends on draw.io copy ID behavior. |
| Copy/paste node | UNPROVEN | The current harness does not provide a clean user copy/paste cell operation with controlled before/after runtime evidence. | Not asserted. |
| Delete and recreate node | REAL-PROVEN | Recreated visual node with same controlled content received a different raw anchor. | `NO_MATCH` |
| Edge unchanged | REAL-PROVEN | Edge raw ID remained stable between consecutive snapshots. | `EXACT`, `exact-raw-anchor` |
| Edge endpoint change | REAL-PROVEN | `edit-edge` changed the target terminal while preserving edge raw ID and page context. | `EXACT`, `exact-raw-anchor` |
| Duplicate page | PARTIALLY-PROVEN | `copy-page` creates a new page and a copied visual entity; evidence proves no exact source-entity continuity for the copied entity. Broader duplicated-page ambiguity remains pure/unit evidence. | Not `EXACT` for copied visual entity. |
| Move/copy entity between pages | PARTIALLY-PROVEN | Copy via duplicated page is covered. A true move between pages is not cleanly supported by current public/harness tools. | Not fully asserted. |
| Document edit in same runtime lifecycle | REAL-PROVEN | Multiple edits in one connected document lifecycle preserved document context while content revision changed. | Entity anchors remained matchable where raw IDs were preserved. |
| Reload/reopen document | UNPROVEN | The harness does not currently provide a deterministic reopen/reload cycle that preserves fixture identity evidence. | Not asserted. |
| Import/reimport with rewritten IDs | UNIT-ONLY | M17.1 pure fixtures cover rewritten raw anchors; M17.2 did not add real import/reimport evidence. | Not asserted. |
| External-reference expansion evidence | REAL-PROVEN | A layer-scoped snapshot emitted target external-reference metadata for an edge crossing to another layer. Repeated layer snapshots preserved the scoped external-reference anchor. | `EXACT`, `exact-raw-anchor` |

## Before / After Observations

The test uses dynamic draw.io IDs and does not record full IDs in this document.
Observed identity behavior is summarized below.

| Observation | Before | After | Outcome |
| --- | --- | --- | --- |
| Source node repeated snapshot | same document, page, layer, raw node ID | same document, page, layer, raw node ID | `EXACT` |
| Source node geometry move | same document, page, layer, raw node ID | same document, page, layer, raw node ID; geometry changed | `EXACT` |
| Source node label edit | same document, page, layer, raw node ID | same document, page, layer, raw node ID; label changed | `EXACT` |
| Source node layer move | same document, same page, focus layer, raw node ID | same document, same page, context layer, raw node ID | `EXACT` with `layer-context-changed` |
| Context layer rename | same document, same page, raw layer ID | same document, same page, raw layer ID; name changed | `EXACT` |
| Edge endpoint change | same document, page, layer, raw edge ID | same document, page, layer, raw edge ID; target changed | `EXACT` |
| Copied page visual entity | source page entity | copied page entity with same controlled visual label | not `EXACT` |
| Deleted/recreated node | raw node ID A | raw node ID B with same controlled content | `NO_MATCH` |
| External reference repeat | layer-scope edge target reference | same layer-scope edge target reference | `EXACT` |

## Deviations From M17.1

No pure-model rule required changes.

Runtime evidence supports the M17.1 rule that layer context changes for
elements are evidence, not an automatic identity break. Runtime evidence also
supports the conservative rule that deleted/recreated visual objects must not be
silently correlated by content alone.

M17.2 does not prove import/reimport, reload/reopen or true page-move behavior.
Those remain outside the real-proven subset.

## Security And Privacy Findings

- Identity evidence remains internal to the test and graph-model package.
- No MCP response exposes `StableIdentityEvidence`, private signatures or
  identity match results.
- The regression call to `cyberdraw_analyze_structure` still returns
  `m13-v1` and does not contain identity fields.
- Private signatures are bounded and do not return raw source material.
- No XML, raw graph, raw cells or runtime snapshots are included in public
  output.
- No identity material is persisted.

## Defensible Guarantees After M17.2

The project can now defend this narrower identity statement:

Within one REAL LOCAL HTTP draw.io runtime lifecycle, for entities whose draw.io
raw anchor and required document/page context are preserved, the M17.1 matcher
can produce deterministic `EXACT` continuity evidence across repeated runtime
snapshots, geometry edits, label edits, layer moves, layer renames, unchanged
edges, endpoint changes and repeated external-reference metadata.

## Non-Guarantees

M17.2 still does not guarantee:

- stable global identity;
- persistence keys;
- public graph identity;
- semantic diff identity;
- mutation target identity;
- rollback or transaction semantics;
- identity across arbitrary import/reimport cycles;
- identity across runtime reload/reopen cycles;
- exact continuity for copied, cloned or visually similar entities;
- complete evidence for true moves between pages.

## ADR 0008 Readiness

Status: READY FOR DRAFT.

The pure model plus REAL LOCAL HTTP evidence are enough to draft ADR 0008 around
a narrow internal policy:

- exact identity by preserved raw anchor plus compatible document/page context;
- layer as auxiliary context for movable elements;
- private signatures as probable evidence only;
- ambiguity represented explicitly.

The evidence is not yet broad enough for an accepted durable ADR covering
imports, reloads, true page moves, clone/copy behavior or global identity.

## Remaining Work For M17.3

M17.3 should decide whether to:

- accept the narrow internal policy with explicit limitations;
- keep ADR 0008 as a draft pending import/reload/page-move evidence;
- defer clone/copy/import behavior to later semantic diff or persistence
  milestones.
