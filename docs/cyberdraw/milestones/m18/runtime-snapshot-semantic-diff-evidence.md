# M18.2 - Runtime Snapshot Semantic Diff Evidence

## Status

COMPLETE.

Evidence source:

- test file:
  `packages/drawio-mcp-server/src/real-environment/m18-runtime-semantic-diff-evidence.test.ts`;
- command:
  `NODE_OPTIONS=--experimental-vm-modules pnpm --filter drawio-mcp-server exec jest build/real-environment/m18-runtime-semantic-diff-evidence.test.js --runInBand`;
- environment classification: REAL LOCAL HTTP.

M18.2 did not close the milestone. ADR 0009 was not created or accepted by
M18.2; M18.3 records the later ADR decision and milestone closure.

## Purpose

M18.2 validates the M18.1 pure semantic diff model against normalized
`DiagramSnapshot` data derived from real draw.io runtime snapshots. The runtime
is used only as an evidence source:

```text
real draw.io document
  -> runtime snapshot
  -> existing normalization / runtime adapter
  -> diffSemanticSnapshots()
  -> observed semantic diff result
```

M18.2 does not add a public semantic diff tool, runtime API, persistence,
mutation execution, rollback, approval, transactions or incremental analysis.

## Harness

The evidence uses the existing real-environment harness:

- real Chromium;
- draw.io served by the repository over local HTTP;
- real browser plugin;
- real server runtime WebSocket path;
- InMemoryTransport for the MCP client harness;
- existing mutating draw.io tools only to set up controlled synthetic diagrams;
- `requestCyberdrawRuntimeSnapshot()` for runtime snapshot capture;
- `fromRuntimeSnapshot()` for graph-model normalization;
- `diffSemanticSnapshots()` for pure semantic diff.

This is not HTTPS/Caddy evidence.

## Test Architecture

The regression test creates one controlled synthetic page with two layers,
several nodes and one edge. It captures snapshot A, applies controlled real
draw.io mutations, captures snapshot B and feeds both snapshots into the pure
model. Runtime operations are setup/evidence actions, not a semantic-diff
production integration.

The test asserts:

- no semantic diff public surface is created;
- real runtime anchors are preserved where draw.io preserves them;
- `EXACT` continuity is not treated as semantic equality;
- dimensional changes are reported before derived classifications;
- entity-level coverage gates authoritative classifications;
- stale and revision mismatch outcomes produce no entity classifications;
- synthetic labels and IDs are used, with no raw XML or private signature
material in semantic diff output.

## Evidence Levels

The evidence matrix uses exactly these levels:

- REAL-PROVEN: observed directly with the REAL LOCAL HTTP harness and protected
  by a reproducible regression assertion.
- PARTIALLY-PROVEN: real runtime evidence exists, but part of the condition is
  synthetic, harness-limited or not a complete behavioral proof.
- UNPROVEN: the current harness/runtime does not support a defensible
  conclusion.
- CONTRADICTED: runtime evidence contradicts the M18.1 contract or hypothesis.

## Evidence Matrix

| # | Case | Runtime operation | Observed raw-anchor behavior | Identity outcome | Diff dimensions | Derived classifications | Coverage evidence | Revision evidence | Evidence level | Limitations | Regression-test status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Identical real snapshot | Capture A, capture B without semantic mutation | Same node and edge anchors | `EXACT` | compared dimensions unchanged | `UNCHANGED` | default complete comparable graph evidence | runtime content revision captured | REAL-PROVEN | no reload/reopen covered | asserted |
| 2 | Node geometry change | `edit-cell` x/y | Node anchor preserved | `EXACT` | `geometry: changed` | `MOVED` | complete comparable graph evidence | runtime revision evidence captured | REAL-PROVEN | movement is geometry only | asserted |
| 3 | Node label change | `edit-cell` text | Node anchor preserved | `EXACT` | `content: changed` | `MODIFIED` | complete comparable graph evidence | runtime revision evidence captured | REAL-PROVEN | synthetic label only | asserted |
| 4 | Node style/metadata change | `edit-cell` style | Node anchor preserved | `EXACT` | `metadata: changed` | `MODIFIED` | complete comparable graph evidence | runtime revision evidence captured | REAL-PROVEN | style field only | asserted |
| 5 | Node layer move | `move-cell-to-layer` compared against the immediately previous snapshot | Node anchor preserved | `EXACT` | `container: changed`, `geometry: unchanged` | `MOVED` | complete comparable graph evidence | runtime revision evidence captured | REAL-PROVEN | same page only; isolated from geometry change | asserted |
| 6 | Page move / cross-page move | Not executed | Not observed | not established | not established | none | no real comparable evidence | none | UNPROVEN | current harness does not expose a clean entity move across pages in this test | documented |
| 7 | Edge unchanged | Capture A/B before edge mutation | Edge anchor preserved | `EXACT` | unchanged | `UNCHANGED` | complete comparable graph evidence | runtime revision evidence captured | REAL-PROVEN | no endpoint mutation in this case | asserted |
| 8 | Edge endpoint change | `edit-edge` target endpoint | Edge anchor preserved | `EXACT` | `connectivity: changed` | `REWIRED` | complete comparable graph evidence | runtime revision evidence captured | REAL-PROVEN | one endpoint changed | asserted |
| 9 | Edge label/style change | `edit-edge` text/style compared against the immediately previous endpoint snapshot | Edge anchor preserved | `EXACT` | `content: changed`, `metadata: changed`, `connectivity: unchanged` | `MODIFIED` | complete comparable graph evidence | runtime revision evidence captured | REAL-PROVEN | isolated from endpoint change | asserted |
| 10 | Real delete | `delete-cell-by-id` | Base anchor absent in target | `NO_MATCH` | `existence: changed` | `REMOVED` | complete comparable graph evidence proves absence | runtime revision evidence captured | REAL-PROVEN | only one controlled node deleted | asserted |
| 11 | Delete + recreate visually identical | Delete node, add same synthetic label | Original anchor absent; new anchor present | `NO_MATCH` for original and new entity | existence changes | original not `UNCHANGED`; new `ADDED` | complete comparable graph evidence | runtime revision evidence captured | PARTIALLY-PROVEN | does not prove arbitrary import/copy rewrite behavior | asserted |
| 12 | Real add | `add-rectangle` | New target anchor present | `NO_MATCH` | `existence: changed` | `ADDED` | complete comparable graph evidence proves absence in base | runtime revision evidence captured | REAL-PROVEN | controlled add only | asserted |
| 13 | Duplicate / clone / copy | `copy-page` | Copied page contains a similarly labeled entity with non-exact continuity | not `EXACT` for copied entity | page/entity existence evidence | not treated as same unchanged entity | real copy-page operation | runtime revision evidence captured | PARTIALLY-PROVEN | copy-page is not true node copy/paste or arbitrary clone | asserted |
| 14 | Import / ID rewrite | Not executed | Not observed | not established | not established | none | no real import/reimport evidence | none | UNPROVEN | current M18.2 does not run import/reimport rewrite workflow | documented |
| 15 | Partial coverage | Runtime snapshots plus layer-scoped coverage supplied to pure diff | Entity outside base scoped coverage has anchor but is out of comparable scope | no authoritative classification | `coverage: not-compared` | none | layer coverage blocks classification | runtime revision evidence captured | REAL-PROVEN | coverage control is supplied to pure model over real snapshots | asserted |
| 16 | Complete target scope absence | Runtime snapshots plus same-layer complete-target-scopes coverage | Entity absent inside covered layer | `NO_MATCH` | `existence: changed` | `REMOVED` | entity-scoped absence proven only inside covered layer | runtime revision evidence captured | REAL-PROVEN | proves layer-scoped absence, not whole-document absence | asserted |
| 17 | Stale base | Real snapshots with base revision compatibility set false | Anchors not evaluated | no entity correlation | no dimensions derived | none | not applicable after stale outcome | synthetic stale flag over real snapshots | PARTIALLY-PROVEN | stale signal is injected, not produced by live race | asserted |
| 18 | Stale target | Real snapshots with target revision compatibility set false | Anchors not evaluated | no entity correlation | no dimensions derived | none | not applicable after stale outcome | synthetic stale flag over real snapshots | PARTIALLY-PROVEN | stale signal is injected, not produced by live race | asserted |
| 19 | Revision mismatch | Real snapshots with mismatched document revisions supplied | Anchors not evaluated | no entity correlation | no dimensions derived | none | not applicable after incomparable outcome | synthetic document revisions over real snapshots | PARTIALLY-PROVEN | runtime did not naturally produce mismatch | asserted |
| 20 | Snapshot ordering | Runtime snapshots reordered in memory before normalization | Same raw anchors, different extraction-order suffixes in internal refs | classifications stable | dimensional statuses stable | summaries stable | complete comparable graph evidence | runtime revision evidence captured | PARTIALLY-PROVEN | full JSON equality is not claimed because internal snapshot-scoped refs include order-derived disambiguators | asserted with classification-shape comparison |

## Observed Runtime Behavior

The real runtime preserves raw anchors for same-page geometry, label, style,
layer and edge endpoint edits. This is sufficient for `EXACT` identity
continuity inside the ADR 0008 supported domain. The semantic diff then reports
semantic changes through dimensions:

- geometry changes derive `MOVED`;
- label/content changes derive `MODIFIED`;
- style/metadata changes derive `MODIFIED`;
- same edge raw anchor plus changed endpoint derives `REWIRED`;
- `EXACT` unchanged entities derive `UNCHANGED`.

The edge endpoint case confirms the M17/M18 rule that identity continuity is
not semantic equality:

```text
same edge raw anchor + changed endpoints
= EXACT identity continuity + REWIRED semantic structure
```

## Coverage Evidence

The runtime snapshots are complete enough for the controlled document page, but
M18.2 also supplies scoped coverage to the pure model to prove M18.1
entity-level coverage semantics:

- entities outside comparable observed coverage receive no authoritative
  `UNCHANGED`, `MODIFIED`, `MOVED`, `REWIRED`, `ADDED` or `REMOVED`
  classification;
- `REMOVED` is asserted only when the base entity is observed, the corresponding
  target comparison domain is observed and no unresolved `PROBABLE` or
  `AMBIGUOUS` candidate blocks absence;
- complete target scope absence is scoped to the covered layer/page and does
  not become whole-document absence.

## Revision And Stale Evidence

The stale and revision mismatch paths are tested with real runtime snapshots
and explicit revision evidence passed to the pure model:

- stale base -> `outcome: "stale"`, `revisionStatus: "stale-base"`,
  `entityResults: []`;
- stale target -> `outcome: "stale"`, `revisionStatus: "stale-target"`,
  `entityResults: []`;
- revision mismatch -> `outcome: "incomparable"`,
  `revisionStatus: "revision-mismatch"`, `entityResults: []`.

This is PARTIALLY-PROVEN because the current harness does not force a natural
live stale race or real document revision mismatch.

## Pure-Vs-Runtime Divergences

No material semantic contradiction was found.

One limitation was observed for artificial snapshot ordering: after manually
reordering runtime snapshot arrays in memory, semantic outcomes,
classifications, dimensions and reason codes remain stable, but full JSON
identity refs are not byte-for-byte identical because internal
snapshot-scoped refs include extraction-order disambiguators. M18.2 therefore
records ordering as PARTIALLY-PROVEN for runtime-derived data and does not claim
full reference invariance for artificially reordered runtime payloads.

## REAL-PROVEN Cases

- identical real snapshots;
- node geometry change -> `MOVED`;
- node label change -> `MODIFIED`;
- node style/metadata change -> `MODIFIED`;
- node layer move within a page -> `MOVED`;
- edge unchanged -> `UNCHANGED`;
- edge endpoint change -> `REWIRED`;
- edge label/style change -> `MODIFIED` with unchanged connectivity when
  compared to the immediately previous endpoint snapshot;
- real delete -> `REMOVED` with absence proof;
- real add -> `ADDED` with absence proof;
- partial coverage blocks authoritative classification;
- complete target scope absence is scoped to the covered layer.

## PARTIALLY-PROVEN Cases

- delete + recreate visually identical is not `UNCHANGED`, but arbitrary
  import/copy rewrite semantics remain unproven;
- copy-page evidence shows copied entities are not silently treated as exact
  unchanged entities, but true node copy/paste and clone remain harness-limited;
- stale base/target and revision mismatch are proven at the pure model boundary
  over real snapshots, but the stale/mismatch signal is synthetic;
- ordering is stable for semantic classifications and dimensions, but not for
  every internal snapshot-scoped reference byte.

## UNPROVEN Cases

- page move / cross-page move;
- import/reimport with rewritten IDs;
- runtime reload/reopen identity behavior;
- true node copy/paste behavior independent of copy-page;
- arbitrary clone behavior outside the copy-page case.

## CONTRADICTED Cases

None.

## Privacy Notes

The test uses synthetic labels only and asserts that semantic diff output does
not contain raw XML markers, `mxCell`, private signature names or private
fingerprint material. The evidence document records sanitized facts, IDs,
dimensions, classifications and reason codes rather than raw runtime snapshots.

M18.2 does not add identity or semantic diff material to public MCP responses.

## Limitations

- Evidence is REAL LOCAL HTTP, not HTTPS/Caddy.
- The MCP client harness uses InMemoryTransport.
- Page move, import/reimport, reload/reopen, true copy/paste and arbitrary clone
  behavior remain unproven.
- Stale and revision mismatch use synthetic revision evidence over real
  snapshots.
- Ordering evidence does not prove byte-identical internal refs after artificial
  runtime payload reorder.
- No semantic equality engine is introduced.

## ADR 0009 Readiness

ADR 0009 - Architecture Intelligence Semantic Diff Policy is READY FOR
ACCEPTANCE CANDIDATE after M18.2, with the limitations above. M18.2 does not
create or accept the ADR; that remains M18.3 scope.

The acceptance candidate must preserve these boundaries:

- semantic diff remains internal unless a later milestone explicitly exposes it;
- dimensions are authoritative and classifications are deterministic summaries;
- `EXACT` identity continuity is not semantic equality;
- `PROBABLE` never authoritatively derives `MOVED`;
- `ADDED`/`REMOVED` require entity-scoped absence proof;
- incomplete, stale or incomparable inputs cannot produce fake entity
  classifications.

## M18.3 Entry Criteria

M18.3 may proceed to ADR decision and milestone closure if it:

- audits M18.0/M18.1/M18.2 evidence together;
- records the runtime limitations without upgrading them into guarantees;
- accepts or downgrades ADR 0009 readiness based on the evidence above;
- leaves public MCP contracts unchanged;
- keeps persistence, mutation execution, rollback, approval, transactions and
  incremental analysis out of M18.
