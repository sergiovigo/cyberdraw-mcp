# RFC 0001: Internal Graph Model

## Status

Draft.

M2 spike evidence: see
`docs/cyberdraw/spikes/0001-internal-graph-readonly.md`. The RFC remains Draft;
the spike is not an acceptance ADR or stable product contract.

ADR 0003 accepts the architectural location of Alternative C: a private
independent package in the monorepo, consumed server-first, with the plugin
limited initially to plain-data snapshot extraction. That ADR does not stabilize
the RFC's illustrative schemas, identity strategy, runtime integration, public
API, persisted findings, semantic diff, change plans, WebSocket changes or new
MCP tools.

## Authors

- CyberDraw MCP maintainers.
- Codex research pass, 2026-07-15.

## Date

2026-07-15.

## Context

CyberDraw MCP currently inherits the Draw.io MCP Server architecture: MCP clients
call a Node server, the server validates tool inputs and routes requests over a
WebSocket bridge, and the browser plugin executes operations against the draw.io
runtime. The server stores connected document metadata and request state, but it
does not maintain a semantic diagram model. Most diagram facts are read from
draw.io cells in the plugin and returned through tool-specific responses.

The closest existing read surface is `list-paged-model`. It returns sanitized
cell objects from the active or target page, including IDs, value, geometry,
style, edge flag, parent/source/target references, layer metadata and tags. This
is useful for inspection, but it is still a flattened draw.io cell view. It does
not define stable semantic entities, analysis provenance, derived metadata,
validation findings or cross-snapshot comparison rules.

This RFC proposes an internal graph model for research and later implementation
planning. It is not an accepted design and does not introduce product code or
new MCP tools.

## Goals

- Represent draw.io diagrams as a generic, queryable graph without making XML or
  browser runtime objects the product intelligence boundary.
- Preserve draw.io as the editor and operational file format.
- Support incremental adoption with existing MCP tools and plugin execution.
- Preserve draw.io IDs where possible while handling imports, duplicates and
  broken references.
- Represent non-visual semantic information, analysis results and pending
  changes separately from the current diagram state.
- Keep the core model domain-neutral while allowing future profiles for C4,
  cloud, networking, BPMN, UML, threat modeling, MITRE ATT&CK, ENS, NIS2, DORA
  and ISO 27001.
- Make validation, querying, comparison and semantic analysis testable outside
  the browser where possible.

## Non-Goals

- Replacing draw.io as the editor.
- Replacing `.drawio` or mxGraph XML as the operational format.
- Adding MCP tools in this phase.
- Rewriting the server, plugin or WebSocket bridge.
- Defining a complete cybersecurity ontology.
- Persisting analysis findings by default before a security and privacy policy
  is accepted.
- Generating draw.io XML directly for every mutation path.

## Requirements

The first implementation, if approved later, should be read-first, reconstructable
from a draw.io snapshot and safe to discard. It must distinguish:

- original diagram data observed from draw.io;
- normalized graph facts;
- enriched facts supplied by users or importers;
- inferred facts produced by analyzers;
- findings, suggestions and pending change plans.

The model must be serializable, versioned and validateable. It must support
multi-page diagrams, layers, groups, edges, ports, geometry, styles, labels,
custom attributes and unknown draw.io properties without silently losing them.

## Current Limitations

The inherited model is adequate for direct editing, export and simple listing.
It is weaker for architecture intelligence:

- Diagram semantics are coupled to mxGraph cells, style strings and browser
  runtime objects.
- `list-paged-model` has no durable model version or schema beyond the tool
  response shape.
- Relationship queries require every consumer to understand parent/source/target
  conventions.
- Multi-page comparison and validation are not first-class.
- Custom attributes are stored as XML object attributes and are not separated
  from labels or visual style.
- Derived facts and findings have no provenance, confidence or lifecycle.
- Unknown shapes and styles can be observed, but not classified consistently.
- Server-side tests cannot exercise most semantic behavior without the browser.

The model would enable:

- graph queries such as neighbors, paths, connected components and orphan
  detection;
- semantic filters over labels, styles, shape references and metadata;
- snapshot comparison and semantic diff;
- rule-based validation;
- analysis provenance and accepted/rejected finding state;
- future domain profiles without changing the MCP tool surface first.

Costs introduced:

- a second representation that can diverge from draw.io if snapshot discipline is
  weak;
- schema and migration maintenance;
- memory and CPU cost for indexing larger diagrams;
- ambiguity around unknown draw.io behavior;
- additional tests and fixtures.

Cases that do not justify the model:

- single direct mutations such as adding a rectangle or renaming a page;
- exporting raw XML, SVG or PNG;
- UI-bound operations such as current selection;
- trivial cell lookup where `list-paged-model` already gives enough context;
- emergency compatibility fixes where semantic interpretation is unrelated.

## Architectural Alternatives

### Alternative A: Server-Only Model

The server requests snapshots from the plugin, builds the internal model in Node
and runs all queries and analysis server-side.

| Dimension | Analysis |
| --- | --- |
| Coupling | Keeps semantic code out of the plugin but couples the server to the snapshot shape. |
| Upstream compatibility | Lower plugin churn; easier upstream sync than plugin-heavy designs. |
| Performance | Browser work is limited to snapshot extraction; server can index and query cheaply for repeated reads. Large snapshots still cross WebSocket. |
| Testability | Strong server-side unit tests; browser fixtures still needed for snapshot extraction. |
| Deployment | No new runtime beyond server package if kept in-process. |
| Serialization | Natural place to emit JSON snapshots, hashes and analysis results. |
| Complexity | Simpler deployment, but server must understand enough draw.io semantics to normalize cells. |
| Duplicate state risk | Moderate; server model can become stale after browser edits. |
| Browser impact | Low after snapshot generation. |

### Alternative B: Shared Model Between Server and Plugin

The model code is compiled into both server and browser plugin packages.

| Dimension | Analysis |
| --- | --- |
| Coupling | Highest coupling; model APIs must fit both Node and browser constraints. |
| Upstream compatibility | More plugin changes increase sync and draw.io version risk. |
| Performance | Plugin can normalize close to the runtime and avoid shipping raw details; server can still query a compact model. |
| Testability | Shared tests are possible, but browser-specific behavior still needs integration coverage. |
| Deployment | Plugin bundle size and browser compatibility become model constraints. |
| Serialization | Shared schema reduces mismatch, but both sides need migration discipline. |
| Complexity | Higher build and compatibility complexity. |
| Duplicate state risk | High if plugin and server both cache models. |
| Browser impact | Higher CPU and memory use in draw.io tabs. |

### Alternative C: Independent Internal Graph Package

Create a new monorepo package for pure model types, normalization helpers,
validation and query indexes. The server consumes it first; the plugin may later
consume only narrow snapshot helpers if justified.

| Dimension | Analysis |
| --- | --- |
| Coupling | Lowest long-term coupling if the package depends on plain data, not draw.io runtime objects. |
| Upstream compatibility | Keeps server/plugin changes narrow; package can evolve behind documented interfaces. |
| Performance | Server can index and analyze; plugin can remain mostly a snapshot provider. |
| Testability | Best unit-test surface for model invariants, malformed graphs and schema examples. |
| Deployment | Adds a package in a future implementation; no deployment change if bundled through workspace builds. |
| Serialization | Clear home for versioned JSON and schemas. |
| Complexity | Adds package ownership and API design overhead. |
| Duplicate state risk | Manageable if the package models immutable snapshots and explicit change plans. |
| Browser impact | Low initially; optional later use must be bundle-size gated. |

Recommendation: Alternative C should be the preferred design direction for a
future implementation, with server-first adoption and plugin participation kept
limited to snapshot extraction until evidence shows shared browser code is worth
the cost. ADR 0003 accepts this package-location and responsibility split as the
internal graph model architecture. The rest of this RFC remains design context
and does not by itself define product behavior or a stable public contract.

M2 read-only spike evidence supports the feasibility of Alternative C as a
private pure package for normalization, indexing and broken-reference detection.
A follow-up refactor separated the legacy `list-paged-model` shape from a
neutral internal `CanonicalDiagramInput` boundary, so the core no longer needs
to know mxCell-shaped references or the inherited tool name. The spike does not
yet prove runtime snapshot extraction completeness, large WebSocket payload
behavior, public schema stability or stable identity across page moves/imports.

M3 runtime snapshot handler evidence is recorded in
`docs/cyberdraw/spikes/0002-runtime-snapshot-handler.md`. That spike adds a
private versioned runtime snapshot message and a runtime snapshot adapter while
preserving existing MCP tool responses. It validates visible/background page
read extraction and provisional `contentRevision`, but large payload strategy,
cross-version draw.io evidence, stable identity and public schemas remain open.

M4 runtime snapshot hardening evidence is recorded in
`docs/cyberdraw/milestones/M4-runtime-snapshot-product-hardening.md`. It adds
private capability negotiation, a shared internal contract package, soft/hard
payload policy, deterministic versioned content revision and stale-read
comparison helpers. The RFC remains Draft and no public graph-model API or MCP
tool is introduced.

M5 scoped snapshot delivery evidence is recorded in
`docs/cyberdraw/milestones/M5-scoped-snapshot-delivery.md`. It adds private
document, pages, layers and selection scopes to reduce runtime extraction and
payload size while preserving the RFC's non-goals: no public API, no public MCP
tool, no persisted model and no stable identity guarantee.

M6 runtime snapshot benchmark evidence is recorded in
`docs/cyberdraw/milestones/M6-runtime-snapshot-benchmarks.md`. It supports a
scope-first and hierarchical M7 strategy and does not accept chunking,
streaming, persistence, semantic diff, mutation planning or incremental
analysis as product behavior.

## Data Model Proposal

Use normalized entities keyed by internal ID, plus explicit references. Prefer
discriminated unions and composition over class inheritance. Avoid making every
entity inherit from a large base class; many concepts share identity and
provenance but not behavior.

Illustrative TypeScript. These snippets are not a final API and intentionally
omit implementation details such as builders, validators and indexes:

```ts
type InternalId = string;
type DrawioId = string;

type ElementKind = "node" | "edge" | "group" | "port" | "unknown";

interface Diagram {
  schemaVersion: "0.1";
  id: InternalId;
  drawioDocumentId?: string;
  pages: Record<InternalId, Page>;
  layers: Record<InternalId, Layer>;
  elements: Record<InternalId, Element>;
  indexes?: GraphIndexes;
  analysis?: AnalysisBundle[];
  provenance: Provenance;
}

interface Page {
  id: InternalId;
  drawioId?: DrawioId;
  index: number;
  name: string;
  layers: InternalId[];
  // Derived index for convenience; membership is canonical on Element.pageId.
  elementIds: InternalId[];
  source: SourceRef;
}

interface Layer {
  id: InternalId;
  drawioId?: DrawioId;
  pageId: InternalId;
  name: string;
  visible?: boolean;
  locked?: boolean;
}

type Element = Node | Edge | Group | Port | UnknownElement;

interface ElementBase {
  id: InternalId;
  drawioId?: DrawioId;
  kind: ElementKind;
  pageId: InternalId;
  layerId?: InternalId;
  parentId?: InternalId;
  // Derived inverse of parentId; omit from canonical storage if consistency
  // cannot be guaranteed by the builder.
  childIds?: InternalId[];
  label?: Label;
  style?: Style;
  metadata?: Metadata;
  shape?: ShapeReference;
  source: SourceRef;
  raw?: UnknownDrawioData;
}

interface Node extends ElementBase {
  kind: "node";
  geometry?: Geometry;
  portIds?: InternalId[];
}

interface Edge extends ElementBase {
  kind: "edge";
  sourceId?: InternalId;
  targetId?: InternalId;
  sourcePortId?: InternalId;
  targetPortId?: InternalId;
  geometry?: Geometry;
}

interface Group extends ElementBase {
  kind: "group";
  geometry?: Geometry;
}

interface Port extends ElementBase {
  kind: "port";
  ownerId: InternalId;
  geometry?: Geometry;
}

interface UnknownElement extends ElementBase {
  kind: "unknown";
}
```

Supporting value objects:

```ts
interface Geometry {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  relative?: boolean;
  points?: Array<{ x: number; y: number }>;
  terminalHints?: {
    source?: TerminalHint;
    target?: TerminalHint;
  };
  raw?: Record<string, unknown>;
}

interface TerminalHint {
  x?: number;
  y?: number;
  dx?: number;
  dy?: number;
  perimeter?: boolean;
}

interface Style {
  raw?: string;
  properties: Record<string, string>;
  uninterpreted?: string[];
}

interface Label {
  text?: string;
  html?: string;
  format: "plain" | "html" | "unknown";
}

interface ShapeReference {
  name?: string;
  library?: string;
  styleShape?: string;
  recognized: boolean;
}

interface Metadata {
  attributes: Record<string, JsonValue>;
  extensions?: SemanticExtension[];
}
```

Normalized entities by ID are recommended for the first version because they
make references, diffs and indexes explicit. Interfaces should describe public
contracts; plain JSON-compatible objects should be the serialized form.

Layers should remain separate from `elements` in the first version. In draw.io
they are cells under the page root, but operationally they behave as page
structure and visibility/locking controls rather than ordinary graph vertices.
If a later use case needs layers as queryable elements, it should be an explicit
schema decision.

`Group` is modeled as an element because groups and containers can participate
in parent/child hierarchy and may carry labels, geometry, style and metadata.
The model must not assume every visual container is exactly `style === "group"`;
that is only one current detection signal.

`Port` is included as a future-capable element kind, but it should be optional in
the first implementation. Current tools expose edge source/target IDs and
waypoints; they do not expose first-class ports. Port entities should only be
created when a shape/style or importer provides enough evidence. Otherwise,
edge terminal constraints such as `entryX`, `entryY`, `exitX`, `exitY`, offsets
and perimeter hints should remain in `style.properties`, `geometry.terminalHints`
or `raw`.

To reduce redundant-state risk, `Element.pageId`, `Element.layerId`,
`Element.parentId`, `Edge.sourceId` and `Edge.targetId` should be the canonical
references. `Page.elementIds`, `Element.childIds` and adjacency lists are derived
indexes generated by a model builder and should be omitted from persisted
snapshots unless the builder can prove they match the canonical references.

## Identity and References

Three ID strategies were considered:

| Strategy | Benefits | Problems |
| --- | --- | --- |
| Reuse only draw.io IDs | Simple and preserves user-visible references. | Cannot handle duplicates, missing IDs, cross-import conflicts or tombstones cleanly. |
| Create only internal IDs | Clean graph invariants and imports. | Loses compatibility with existing MCP tools that address draw.io IDs. |
| Maintain both | Preserves draw.io interoperability while allowing internal repair. | More fields and mapping logic. |

Recommendation: maintain both. `drawioId` should preserve the observed mxCell ID
when present and valid. Internal ID generation remains an open design point. A
candidate deterministic key is `{document identity, page identity, drawioId}`,
but this is not always stable: elements can move between pages, documents can be
cloned, page copies can duplicate content, imports in `add` mode can regenerate
draw.io IDs, and malformed diagrams can omit or duplicate IDs. A future
implementation should treat deterministic internal IDs as a correlation strategy
to validate with fixtures, not as an already proven invariant.

Rules:

- Source/target references use internal IDs in the model and retain original
  draw.io IDs in provenance.
- Parent/child references use internal IDs and must not form cycles except where
  malformed input is explicitly represented as a validation finding.
- Layers are represented as page-scoped entities because draw.io layers are root
  children within a page model.
- Deleted elements are represented as tombstones only in diffs or change plans,
  not in the current snapshot by default.
- Duplicate draw.io IDs receive distinct internal IDs and a validation finding.
- Broken references stay unresolved in provenance and produce findings; edges
  may exist with missing `sourceId` or `targetId`.
- Imported diagrams preserve original external IDs under `source.originalId` and
  receive internal IDs during normalization.
- Multi-page diagrams scope ID generation by page, but the model should detect
  draw.io ID reuse across pages and record whether it is acceptable for the
  operation being performed.
- Existing MCP tools address cells by draw.io IDs. Any change plan derived from
  the internal model must carry a verified internal-to-draw.io mapping and
  re-read the target snapshot before applying operations.
- Tombstones belong to snapshot diffs or change plans. They need their own
  correlation metadata because a deleted draw.io ID may later be reused.

## State and Provenance

The model should separate layers of truth:

- original: raw facts observed from draw.io cells, pages, layers and XML;
- normalized: canonical graph entities and references;
- enriched: user-supplied or imported semantic metadata;
- inferred: analyzer-produced facts;
- findings: rule violations or observations requiring attention;
- suggestions: proposed remediations;
- pendingChanges: planned operations not yet applied to draw.io.

Illustrative provenance:

```ts
interface SourceRef {
  kind: "drawio-runtime" | "xml-import" | "user" | "analyzer";
  documentId?: string;
  pageId?: string;
  drawioId?: string;
  originalId?: string;
  snapshotRevision?: string;
}

interface DerivedFact<T = JsonValue> {
  namespace: string;
  type: string;
  value: T;
  confidence?: number;
  deterministic?: boolean;
  derivedAt: string;
  analyzerVersion: string;
  ruleId?: string;
  evidence: EvidenceRef[];
}

interface Finding {
  id: InternalId;
  severity: "info" | "low" | "medium" | "high";
  status: "open" | "resolved";
  disposition?:
    | "accepted-risk"
    | "false-positive"
    | "suppressed"
    | "not-applicable";
  ruleId: string;
  message: string;
  elementIds: InternalId[];
  confidence?: number;
  deterministic?: boolean;
  derivedAt: string;
  analyzerVersion: string;
  evidence: EvidenceRef[];
}
```

Finding lifecycle should avoid ambiguous `accepted` and `rejected` states.
`accepted-risk`, `false-positive`, `suppressed` and `not-applicable` are
different review outcomes and should be represented explicitly if persistence is
introduced. Deterministic rules may omit `confidence` or set
`deterministic: true`; probabilistic or heuristic analyzers should include a
calibrated confidence. Evidence can become stale when the next snapshot deletes
or changes an element, so evidence references must include the snapshot revision
or raw-source pointer they were derived from. Sensitive inferred information
should not be embedded into draw.io by default.

## Transformation Flows

Read flow:

```text
draw.io runtime
-> normalized snapshot
-> internal model
-> indexes
-> queries and analysis
```

The plugin should produce a bounded plain-data snapshot from draw.io runtime
state. A future model package or server adapter should normalize that snapshot
into typed entities and indexes. The snapshot may be based on existing
`list-paged-model`, `list-pages` and `list-layers` behavior, but should not reuse
browser runtime objects directly.

Change flow:

```text
internal model
-> change plan
-> existing MCP operations
-> draw.io runtime
-> refreshed snapshot
```

The model should produce change plans, not direct XML patches, for normal live
editing. Existing tools such as `add-edge`, `edit-cell`, `edit-edge`,
`set-cell-data`, `set-cell-parent`, `move-cell-to-layer` and page/layer tools are
the safer application boundary. Direct XML generation may be reserved for import
or offline conversion flows with explicit validation.

Transformation concerns:

- Round trip must preserve unknown raw fields where possible.
- Style strings should be parsed into key/value properties while retaining raw
  style text.
- Unknown shapes should become `ShapeReference { recognized: false }`.
- Groups and containers must preserve hierarchy separately from visual geometry.
- Disconnected edges are valid malformed graph entities plus findings.
- Custom attributes from XML object values should be metadata, not labels.
- HTML labels require sanitization policy before rendering or analysis display.
- Relative geometry and edge waypoints need explicit representation.
- Background pages must be snapshotted without making visible-page state
  divergent.

## Source of Truth

Draw.io runtime remains authoritative for the open editable diagram. Exported
XML is authoritative for offline files. The internal model is authoritative only
for a specific immutable snapshot and its derived analysis.

Rules to avoid divergence:

- Every model should have revisions derived from signals that actually exist for
  the snapshot. Today the plugin can report document metadata including
  `file.getHash()` when draw.io exposes it, but that value may be null and is not
  sufficient by itself.
- A first implementation should compute a canonical content hash from sorted
  normalized snapshot data. Object iteration order from browser/runtime maps
  must not be used directly as hash input.
- Keep separate revision concepts if needed: a full content revision for exact
  redraw/application safety and a semantic revision that ignores purely visual
  changes for analyzers that do not depend on layout or style.
- Analysis records the snapshot revision it used.
- Change plans include the base snapshot revision.
- Before applying changes, re-read or verify the target document/page revision.
- If the revision changed, either rebase the plan or reject with a stale snapshot
  error.
- After applying changes through MCP operations, refresh the snapshot and compare
  expected semantic changes.
- Cache entries are invalidated on document-state changes, page switches that
  affect target state, imports, deletes and any mutating tool result.

Optimistic concurrency is the likely starting point, not a proven guarantee. The
current architecture serializes many MCP mutations through the server queue, but
manual browser edits and draw.io internal updates can happen outside MCP. Change
application must therefore re-read or verify the target snapshot immediately
before mutating and refresh again afterward.

## Initial Internal Operations

These are model/library operations, not MCP tools:

| Operation | Scope |
| --- | --- |
| `getElement(id)` | Model lookup by internal or mapped draw.io ID. |
| `incoming(id)` / `outgoing(id)` | Edge adjacency indexes. |
| `neighbors(id)` | Combined graph neighborhood. |
| `paths(source, target, options)` | Bounded traversal with max depth and page/layer filters. |
| `connectedComponents(pageId?)` | Component analysis over nodes and edges. |
| `filterByMetadata(predicate)` | Semantic metadata filtering. |
| `orphans()` | Nodes with no parent/layer or edges with no terminals, depending on rule mode. |
| `brokenReferences()` | Missing source/target/parent/layer references. |
| `crossLayerEdges()` | Edges crossing layers or future zones. |
| `compareSnapshots(a, b)` | Structural comparison. |
| `semanticDiff(a, b)` | Domain-aware diff using labels, metadata and shape references. |
| `validate(ruleset)` | Rule engine entrypoint producing findings. |

An analysis service may orchestrate these operations and produce findings. A
future MCP tool would be a separate transport-facing wrapper with schemas,
permissions and response limits.

Initial query semantics should be explicit:

- Direction follows `Edge.sourceId -> Edge.targetId`; self-loops are legal and
  must not create infinite traversal.
- Multiple edges between the same pair of nodes are legal and should be
  preserved, not collapsed, unless a specific analysis asks for simplification.
- Edges that cross pages should be represented as broken or external references
  until a supported draw.io fixture proves cross-page terminals are meaningful.
- Traversals must accept page/layer filters, max depth and max result limits.
- Results should be deterministic by sorting IDs or preserving a documented
  canonical order after normalization.
- Containment (`parentId`) is a hierarchy relation, not automatically a graph
  adjacency relation unless the caller requests containment traversal.

## Semantic Extensibility

Options:

| Approach | Fit |
| --- | --- |
| Optional fields on core entities | Simple for universal facts, poor for many domains. |
| Free metadata | Flexible, hard to validate. |
| Typed extensions | Good balance of validation and isolation. |
| Profiles/namespaces | Best for versioned domain semantics. |
| ECS components | Powerful but likely too abstract for first version. |
| Domain plugins | Future option after core model stabilizes. |

Recommendation: core entities stay generic and support namespaced typed
extensions under `metadata.extensions` only for observed or deliberately enriched
metadata. Analyzer-produced facts should live in `DerivedFact` collections, and
rule results should live in findings. Profiles may define JSON Schema or Zod
validators later.

Generic example:

```json
{
  "namespace": "cyberdraw.architecture",
  "type": "bounded-context",
  "version": "1.0",
  "data": {
    "domain": "billing",
    "criticality": "high"
  }
}
```

Cybersecurity example:

```json
{
  "namespace": "cyberdraw.security",
  "type": "security-zone",
  "version": "1.0",
  "data": {
    "trustLevel": "untrusted"
  }
}
```

The core must not import security concepts directly. Security rules should read
extensions and produce findings without changing generic graph invariants.
Extension namespaces need ownership rules before broad adoption: use reverse-DNS
or `cyberdraw.*` namespaces for first-party profiles, preserve unknown
extensions as opaque bounded JSON, reject oversized extension payloads, and
require versioned migration rules before mutating extension data.

## Persistence and Serialization

Options:

- JSON: recommended serialized representation for snapshots and examples.
- JSON Schema: recommended once the first implementation stabilizes.
- Zod: useful for TypeScript runtime validation, but should not be the only
  public contract if non-TypeScript consumers are expected.
- In-memory only: recommended for first shadow implementation.
- Sidecar next to `.drawio`: useful for accepted/rejected findings and enriched
  metadata, but requires privacy and merge policy.
- Embedded draw.io metadata: useful for portable user-authored metadata, risky
  for sensitive findings and noisy for upstream compatibility.
- Database: defer.
- Reconstructable cache: recommended for performance once snapshot hashing
  exists.

First implementation should provide in-memory immutable snapshots, JSON
serialization for debug/golden tests and a documented schema draft. Sidecars and
embedded persistence should be postponed until governance accepts what data may
be persisted.

The companion `0001-internal-graph-model.schema.example.json` is illustrative
only. It is valid JSON for discussion and golden-test planning, but it is not a
published schema and must not be treated as a compatibility contract.

## Performance and Limits

Proposed size categories:

- small: up to 100 elements;
- medium: 100 to 2,000 elements;
- large: 2,000 to 20,000 elements;
- very large: above 20,000 elements, requiring explicit limits or streaming.

Targets to validate in a later implementation:

- Build indexes in O(V + E) over normalized elements.
- Lookup by ID in O(1).
- Incoming/outgoing neighbors in O(degree).
- Connected components in O(V + E).
- Snapshot JSON size bounded by page and element limits.
- Default operations complete comfortably for medium diagrams on Node.js 22.
- Snapshot extraction can run per page, and callers can request partial analysis
  when full-document analysis would exceed limits.
- Long-running analysis supports timeout/cancellation in the service layer.

Indexes should cover internal ID, draw.io ID, kind, page, layer, parent/child,
source/target and extension namespace/type. Full snapshots are acceptable for a
first read-only shadow model. Incremental snapshots should wait until revision
tracking and invalidation are proven.

Browser work should be limited to extracting bounded plain data. Query and
analysis should run server-side by default to avoid adding heavy CPU work to the
draw.io tab.

Large snapshots crossing the WebSocket are a design risk. A later implementation
should measure payload size, evaluate page-level pagination, consider optional
compression only if it does not complicate MCP transport behavior, and enforce
configurable element, byte and time limits.

## Security

Trust boundaries:

- MCP clients are trusted by current deployment assumptions, but responses may
  contain sensitive diagram content.
- WebSocket plugin peers are unauthenticated in the inherited baseline.
- draw.io XML, SVG, PNG embedded XML and Mermaid input are untrusted content.
- Internal analyzers and future rule packs must be treated as code or policy
  with injection risk.

Risks and controls:

- Untrusted XML: parse with bounded size/depth and avoid entity expansion
  hazards in any future server-side parser.
- HTML labels: preserve as data; sanitize before display; never execute.
- Prototype pollution: parse metadata into null-prototype or validated plain
  records; reject `__proto__`, `constructor` and `prototype` keys.
- Arbitrary keys: namespace metadata and cap key/value lengths.
- Oversized metadata: enforce per-element and per-snapshot limits.
- Recursion/cycles: normalize parent graphs with cycle detection and max depth.
- Malformed graphs: represent safely and emit findings rather than throwing
  where possible.
- Denial of service: cap pages, elements, style length, label length, metadata
  size, traversal depth and result size.
- WebSocket payloads: cap snapshot request/response size and fail closed on
  oversized plugin messages.
- Deserialization: validate JSON snapshots with a bounded schema; reject unknown
  top-level fields unless explicitly preserved under `raw`.
- Regular expressions: future rule engines must reject or sandbox expensive
  patterns and avoid unbounded backtracking.
- Graph algorithms: path search and validation rules must have depth, edge-count,
  time and result limits.
- Sensitive inferred data: do not persist findings by default; mark export
  boundaries clearly.
- Finding persistence: sidecars or embedded data need explicit user action and
  redaction policy.
- Rule injection: future user-authored rules should run in a constrained engine,
  not arbitrary eval.

## Compatibility and Migration

Incremental strategy:

1. Add a read-only snapshot adapter behind existing behavior. No MCP response
   changes.
2. Build a shadow model in memory from existing page/layer/model reads.
3. Compare shadow model summaries against current `list-paged-model`,
   `list-pages` and `list-layers` responses in tests.
4. Adopt one internal vertical operation without adding an MCP tool initially.
   Recommended first vertical: broken reference detection, because it exercises
   ID mapping, source/target/parent/layer validation and malformed graph handling
   while remaining read-only and explainable. A snapshot summary or simple
   adjacency query is lower risk but validates less of the architectural model.
5. Add a feature flag only when runtime behavior or response payloads change.
6. Roll back by disabling the shadow model and returning to existing direct
   plugin tool behavior.
7. Keep upstream sync compatibility by avoiding broad plugin rewrites and by
   isolating model code in a new package if Alternative C is accepted.

Reusable inherited code:

- page and document selectors;
- background page execution helpers;
- cell serialization ideas from `list-paged-model`;
- layer and tag extraction;
- import/export fixtures and real-environment tests.

Code not to touch initially:

- MCP tool registration surface;
- WebSocket protocol shape except for an explicitly scoped snapshot response;
- import/export XML mutation logic;
- draw.io compatibility matrix;
- package manifests and workflows until an implementation ADR exists.

## Testing Strategy

- Unit tests for entity normalization, style parsing and ID mapping.
- Invariant tests for parent acyclicity, source/target consistency and page/layer
  membership.
- Fixture tests using representative draw.io XML and `list-paged-model` payloads.
- Round-trip tests for snapshot -> model -> JSON -> model.
- Property-based tests for malformed IDs, broken references, duplicate IDs and
  cyclic parent graphs.
- Version compatibility tests using draw.io runtime fixtures for supported
  versions.
- Plugin integration tests for visible and background pages.
- Regression tests ensuring draw.io IDs are preserved where valid.
- Performance tests for generated small, medium and large graphs.
- Golden files for serialized snapshots and semantic diffs.
- Security tests for HTML labels, prototype pollution keys, huge metadata,
  malformed XML-derived shapes and traversal depth limits.

## Risks

- A stale model could mislead analysis if invalidation is incomplete.
- A too-rich first schema could slow implementation and upstream sync.
- A security-heavy extension could contaminate the generic core.
- Persisting findings could leak sensitive architecture or risk data.
- Server-only normalization may miss browser-only draw.io semantics.
- Plugin-side normalization may increase bundle and runtime risk.

## Open Decisions

| Decision | Alternatives | Recommendation | Confidence | Evidence pending |
| --- | --- | --- | --- | --- |
| Model location | Server-only; shared server/plugin; independent package | Independent package, server-first | Medium | Prototype package size, build impact and snapshot adapter complexity |
| First persistence mode | In-memory; sidecar; embedded metadata; database | In-memory plus JSON debug serialization | High | Privacy policy for findings and sidecar merge behavior |
| ID strategy | draw.io only; internal only; both | Maintain both, but keep internal ID derivation open | Medium | Fixtures with duplicate IDs, moves across pages, cloned documents and imports |
| Snapshot source | `list-paged-model`; new plugin snapshot handler; XML export parse | New bounded snapshot handler based on existing extraction ideas | Medium | M3 validates visible/background behavior; large payload and cross-version evidence remain pending |
| Schema technology | TypeScript only; Zod; JSON Schema; both Zod and JSON Schema | Start with TS/Zod internally, publish JSON Schema when stable | Medium | Consumer needs outside TypeScript |
| Change application | Direct XML; existing MCP operations; hybrid | Existing MCP operations by default | High | Coverage of operations needed by first vertical use case |
| Domain extension mechanism | Optional fields; free metadata; typed extensions; ECS; plugins | Namespaced typed extensions | Medium | Validation ergonomics and examples from two domains |
| Feature flag | Always shadow; opt-in flag; config flag only for behavior change | No flag for tests, flag before user-visible behavior | Medium | Implementation plan and runtime cost evidence |
| Finding persistence | Never; sidecar; embedded; external store | Defer; no default persistence | High | Security/privacy review |
| Incremental snapshots | Full snapshot; page snapshot; delta stream | Full/page snapshot first | Medium | Large diagram performance data |
