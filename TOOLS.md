# Tools Reference

The Draw.io MCP server provides the following MCP tools for programmatic diagram interaction.

## Document Targeting

All live Draw.io tools operate on a connected Draw.io browser tab. Use `list-documents` to inspect the currently connected document instances.

Each document instance exposes:

- `id`
- `title`
- `mode`
- `hash`
- `file_url`
- `page_count`
- `current_page`

Routing rules:

- If no Draw.io documents are connected, live tools fail with `No connected Draw.io documents`.
- If exactly one Draw.io document is connected, `target_document` is optional and the server auto-targets it.
- If multiple Draw.io documents are connected, every live tool must include `target_document: { "id": "..." }` from `list-documents`.
- Document IDs are instance IDs for the currently connected browser tabs, not filesystem paths.
- Opening the same underlying `.drawio` file in two tabs yields two different document instances.
- The server only signals existing Draw.io tabs. It does not open files, open tabs, or switch tabs for you.

## Page Targeting

Page-scoped tools additionally require a `target_page` selector so multiple agents can safely work on different pages inside the selected Draw.io document.

Use exactly one of:

- `{ "index": 0 }`
- `{ "id": "page-id-from-list-pages" }`

Notes:

- Page indices are zero-based and come from `list-pages`.
- Page IDs are stable within the selected document and are recommended for agent workflows.
- Live tool calls are serialized per connected document in FIFO order, so concurrent agents do not interleave page switches and writes inside the same browser tab.
- Most page model tools mutate or inspect off-page content without switching the visible browser page.
- UI-bound tools such as `get-selected-cell`, `set-active-layer`, `get-active-layer`, `import-diagram`, selection-only `export-diagram`, and PNG `export-diagram` with `embed_xml=true` still operate through the visible page and may switch it.
- Shape library tools (`get-shape-categories`, `get-shapes-in-category`, `get-shape-by-name`) do not require `target_page`, but they still resolve against a single connected document and therefore use `target_document` when multiple documents are connected.

## Document Tools

### `list-documents`

Lists all currently connected Draw.io document instances.

_Returns_: Array of document objects with `id`, `title`, `mode`, `hash`, `file_url`, `page_count`, and `current_page`

## Diagram Inspection Tools

### `cyberdraw_analyze_structure`

Runs bounded CyberDraw structural analysis over the currently open diagram
without modifying draw.io. The tool uses private runtime snapshots and internal
M8-M12 analysis flows, then returns a filtered public response. The public
contract is request-versioned: M13-compatible requests return `m13-v1`, while
requests using M14-only scope, coverage, limit or aggregate query controls
return `m14-v1`.

_Modes_:

- `analyze`: structural findings
- `query`: filtered/paginated findings, or M14 aggregate `count`/`summarize`
  operations through `query.operation`
- `plan`: non-executable structural proposals
- `validate`: validates the non-executable plan

_Parameters_:

- `mode`: `analyze`, `query`, `plan`, or `validate` (default `analyze`)
- `scope`: optional M13-compatible `{ pageId, layerId }`; `layerId` requires
  `pageId`. M14 also accepts bounded `pageIds` and page-qualified
  `layerTargets`. `scope.document` is rejected with
  `document-scope-not-supported`.
- `expansion`: optional bounded expansion controls
- `query`: optional closed filters, pagination, and M14 `operation: "count"` or
  `operation: "summarize"` under `mode: "query"`
- `coverageRequirements`: optional M14 coverage requirements such as
  `nonStale` or `completeTargetScopes`
- `limits`: optional M14 requested limits that can only narrow server-side caps
- `planning`: optional public policy and exact selected finding IDs
- `validation`: optional validation mode for `validate`
- `response`: optional include flags

_Safety_: Read-only. The response includes
`safety.readOnly: true`, `mutationAttempted: false`, and
`mutationInvocations: 0`. Public proposals include `executable: false` and do
not contain XML, commands, scripts, callbacks, patches, filesystem paths, graph
dumps, labels, styles, raw snapshots, planner internals or raw internal
objects. M14 does not execute complete-document scope and never silently
broadens an invalid explicit target.

### `get-selected-cell`

Retrieves the currently selected cell on the target page.

_Parameters_:

- `target_page`: Page selector for the page to inspect

_Returns_: JSON object containing cell properties (ID, geometry, style, value, etc.)

### `get-shape-categories`

Retrieves available shape categories from the diagram's library. Categories cover the curated `general` set plus every vendor palette drawio ships — AWS (`mxgraph.aws4.*`), GCP (`mxgraph.gcp2.*`), Azure (`mxgraph.azure2.*`), Cisco19 (`mxgraph.cisco19.*`), and CiscoSafe (`mxgraph.cisco_safe.*`) — discovered at runtime from drawio's loaded sidebar, so the catalog always matches the editor version in use.

_Returns_: Array of category objects with their IDs and names

### `get-shapes-in-category`

Retrieves all shapes in a specified category from the diagram's library.

_Parameters_:

- `category_id`: Identifier of the category to retrieve shapes from

_Returns_: Array of shape objects with their properties and styles

### `get-shape-by-name`

Retrieves a specific shape by its name from all available shapes (general + AWS / GCP / Azure / Cisco19 / CiscoSafe vendors discovered at runtime).

_Parameters_:

- `shape_name`: Name of the shape to retrieve (e.g. `mxgraph.gcp2.cloud_functions`, `mxgraph.cisco19.router`, `mxgraph.cisco_safe.capability`)

_Returns_: Shape object including its category and style information

### `list-paged-model`

Retrieves a paginated view of all cells (vertices and edges) on the target page. This tool provides access to the complete model data with essential fields only, sanitized to remove circular dependencies and excessive data. Allows filtering based on multiple criteria and attribute boolean logic.

_Parameters_:

- `target_page`: Page selector for the page to inspect
- `page`: Zero-based result page for pagination
- `page_size`: Maximum number of returned cells
- `filter`: Optional filter criteria

## Diagram Modification Tools

### `add-rectangle`

Creates a new rectangle shape on the target page with customizable properties:

- `target_page`: Page selector for the page to modify
- Position (`x`, `y` coordinates)
- Dimensions (`width`, `height`)
- Text content
- Visual style (fill color, stroke, etc. using Draw.io style syntax)
- Parent cell (`parent_id`) to create as a child of another shape

### `add-edge`

Creates a connection between two cells (vertices). When source and target are the same shape (self-connector), a loop edge style is automatically applied so the line is visible and selectable.

_Parameters_:

- `target_page`: Page selector for the page to modify
- `source_id`: ID of the source cell
- `target_id`: ID of the target cell
- `text`: Optional text label for the edge
- `style`: Optional style properties for the edge
- `points`: Optional array of `{x, y}` waypoints to control edge routing (useful for custom paths or self-connectors)
- `parent_id`: Optional ID of parent cell (creates as child instead of at diagram root)

### `delete-cell-by-id`

Removes a specified cell from the diagram.

_Parameters_:

- `target_page`: Page selector for the page to modify
- `cell_id`: ID of the cell to delete

### `add-cell-of-shape`

Adds a new cell of a specific shape type from the diagram's library.

_Parameters_:

- `target_page`: Page selector for the page to modify
- `shape_name`: Name of the shape to create
- `x`, `y`: Position coordinates (optional)
- `width`, `height`: Dimensions (optional)
- `text`: Optional text content
- `style`: Optional additional style properties
- `parent_id`: Optional ID of parent cell (creates as child instead of at diagram root)

### `set-cell-shape`

Applies a library shape's style to an existing cell.

_Parameters_:

- `target_page`: Page selector for the page to modify
- `cell_id`: ID of the cell whose appearance should change
- `shape_name`: Name of the library shape whose style should be applied

### `set-cell-data`

Stores or updates a custom attribute on a cell.

_Parameters_:

- `target_page`: Page selector for the page to modify
- `cell_id`: ID of the cell to update
- `key`: Attribute name to set
- `value`: Attribute value (stored as a string internally)

### `edit-cell`

Updates an existing vertex/shape cell in place by ID.

_Parameters_:

- `target_page`: Page selector for the page to modify
- `cell_id`: ID of the cell whose properties should change (required)
- `text`, `x`, `y`, `width`, `height`, `style`: Optional fields to update on the cell; omitted properties stay as-is

### `edit-edge`

Updates an existing edge connection between cells by ID.

_Parameters_:

- `target_page`: Page selector for the page to modify
- `cell_id`: ID of the edge cell to update (required)
- `text`: Optional edge label text
- `source_id`, `target_id`: Optional IDs of new source/target cells
- `style`: Optional replacement style string
- `points`: Optional array of `{x, y}` waypoints to set edge geometry control points (replaces existing waypoints; use empty array to clear)

### `set-cell-parent`

Sets the parent of a cell, making it a child of the specified parent cell. This allows creating hierarchical relationships where moving the parent also moves its children.

_Parameters_:

- `target_page`: Page selector for the page to modify
- `cell_id`: ID of the cell to reparent
- `parent_id`: ID of the new parent cell

_Returns_: Confirmation with cell_id and parent_id

## Page Management Tools

### `list-pages`

Lists all pages in the target/current Draw.io document.

_Returns_: Array of page objects with `index`, `id`, `name`, and `is_current`

### `get-current-page`

Returns metadata for the currently visible page in the target/current Draw.io document.

_Returns_: Page object with `index`, `id`, `name`, and `is_current`

### `create-page`

Creates a new blank page and appends it to the target/current document. On supported draw.io runtimes, this does not switch the visible page.

_Parameters_:

- `name`: Name for the new page

_Returns_: Metadata for the created page

### `copy-page`

Creates a copy of an existing page in the target/current document and appends the copy to the end of the page list. When possible, the previously visible page is restored after the copy is created.

_Parameters_:

- `page`: Source page selector for the page to copy. Use exactly one of `{ index }` or `{ id }`
- `name`: Optional name for the copied page

_Returns_: Metadata for the copied page

### `rename-page`

Renames a page in the target/current document without switching the visible page.

_Parameters_:

- `page`: Page selector for the page to rename. Use exactly one of `{ index }` or `{ id }`
- `name`: New page name

_Returns_: Metadata for the renamed page

## Layer Management Tools

_Available since v1.7.0_

### `list-layers`

Lists all available layers on the target page with their IDs and names.

_Parameters_:

- `target_page`: Page selector for the page to inspect

_Returns_: Array of layer objects with properties (ID, name, visibility, locked status)

### `set-active-layer`

Sets the active layer for creating new elements. All subsequent element creation will happen in this layer.

_Parameters_:

- `target_page`: Page selector for the page to modify
- `layer_id`: ID of the layer to set as active

_Returns_: Information about the newly active layer

### `move-cell-to-layer`

Moves a cell from its current layer to a target layer.

_Parameters_:

- `target_page`: Page selector for the page to modify
- `cell_id`: ID of the cell to move
- `target_layer_id`: ID of the target layer where the cell will be moved

_Returns_: Confirmation of the move operation

### `get-active-layer`

Gets the currently active layer information for the target page.

_Parameters_:

- `target_page`: Page selector for the page to inspect

_Returns_: Information about the current active layer (ID and name)

### `create-layer`

Creates a new layer on the target page.

_Parameters_:

- `target_page`: Page selector for the page to modify
- `name`: Name for the new layer

_Returns_: Information about the newly created layer

## Diagram Import/Export Tools

### `export-diagram`

Export the target page or current diagram as SVG, PNG, or XML. Returns the diagram data as base64 (PNG) or text (SVG/XML). Optionally saves to a file.

Notes:

- Page and diagram exports for off-page targets run without switching the visible browser page.
- Selection-only exports still use the visible page because selection is a UI-bound concept in Draw.io.
- PNG exports with `embed_xml=true` also use the visible page because Draw.io's embedded PNG export path is still UI-bound.

_Parameters_:

- `target_page`: Page selector for the page context used by the export
- `format`: Export format: svg for vector graphics, png for raster image, xml for raw diagram data
- `scale`: Zoom factor for the export (1 = 100%, default: 1)
- `border`: Border width in pixels around the diagram (default: 0)
- `background`: Background color in hex format (e.g., #ffffff, default: #ffffff)
- `shadow`: Include shadow effects in the export (default: false)
- `crop`: Crop the export to diagram bounds (true) or full page (false, default: true)
- `selection_only`: Export only the currently selected cells (default: false)
- `transparent`: Use transparent background (overrides background color, default: false)
- `dpi`: DPI for PNG export (affects quality, default: 96)
- `embed_xml`: Embed the diagram XML data in SVG/PNG so it can be reopened in draw.io (default: false)
- `size`: What to export: 'selection' for selected cells only, 'page' for the target page, 'diagram' for the entire model (default: diagram)
- `output_path`: Trusted-client absolute file path to save the exported file. The parent must exist and be a directory. Existing destination directories and symbolic links are rejected; existing regular files may be overwritten with the server process permissions.

_Returns_: Export result with format, mimeType, data (base64 for PNG, text for SVG/XML), dimensions, and optional warning

### `import-diagram`

Import a diagram from XML, SVG with embedded XML, or PNG with embedded XML into the current Draw.io instance.

_Parameters_:

- `target_page`: Required for `replace` and `add`; optional for `new-page`
- `data`: The diagram data: raw XML string, or base64-encoded SVG/PNG with embedded XML
- `format`: Input format: xml for raw Draw.io XML, svg for SVG with embedded XML, png for PNG with embedded XML
- `mode`: Import mode: replace clears current diagram and loads new one, add merges imported cells into current diagram, new-page creates a new page with imported diagram (default: replace)
- `filename`: Optional original filename for context

_Returns_: Import result with success status, message, and optional page/cell counts

### `import-mermaid`

Import a Mermaid diagram into a Draw.io page. The conversion runs inside the Draw.io editor using its bundled Mermaid pipeline. Native mode converts supported Mermaid diagrams into mxGraph cells; embed mode creates a single image cell with Mermaid source preserved for Draw.io re-editing.

_Parameters_:

- `target_page`: Required for `replace` and `add`; optional for `new-page`
- `mermaid_source`: Raw Mermaid syntax
- `mode`: Import mode: native converts to mxGraph cells when supported, embed preserves Mermaid source in an image cell (default: native)
- `insert_mode`: How to merge the converted XML: replace, add, or new-page (default: add)

_Returns_: Import result with success status, message, converted mode, optional cell count, and converted XML

### `cyberdraw_create_diagram`

Create a bounded draw.io flowchart from client-generated Mermaid. This M15
wrapper validates a narrow request, creates a new page through the existing
native Mermaid import path, and returns sanitized `m15-v1` metadata without XML.

_Parameters_:

- `format`: Required literal `mermaid`
- `mermaidType`: Required literal `flowchart`
- `insertMode`: Required literal `new-page`
- `mermaid`: Required Mermaid source beginning with a supported `flowchart`
  directive
- `limits.maxBytes`: Required positive byte limit, capped by the server
- `target_document`: Optional document selector, required when multiple draw.io
  documents are connected
- `title`: Optional new page title

_Returns_: `m15-v1` response with `outcome`, created page metadata on success,
structured reason codes on rejection/failure, and explicit mutation safety
counters. The response never includes XML, raw cells, raw graph data, snapshots
or stack traces. Runtime hardening maps ambiguous post-import verification to
`atomic: "unknown"` and never retries the mutating import.

_M15.3 demo_: The reproducible HTTP-local demo is documented in
`docs/cyberdraw/milestones/m15/reproducible-demo-m15.3.md`.
