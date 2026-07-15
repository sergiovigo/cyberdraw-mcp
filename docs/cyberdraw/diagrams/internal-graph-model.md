# Internal Graph Model Diagrams

These diagrams support RFC 0001. They describe a proposed architecture, not
accepted implementation behavior.

## Architecture Placement

```mermaid
flowchart LR
  Client[MCP client]
  Server[drawio-mcp-server]
  Model[Internal graph model package]
  Plugin[drawio-mcp-plugin]
  Drawio[draw.io runtime]
  Cache[Reconstructable snapshot cache]

  Client -->|existing MCP tools| Server
  Server -->|snapshot request| Plugin
  Plugin -->|runtime APIs| Drawio
  Plugin -->|plain snapshot data| Server
  Server -->|normalize and index| Model
  Model -->|queries, validation, diffs| Server
  Server -. optional .-> Cache
```

## Snapshot Flow

```mermaid
sequenceDiagram
  participant Server as MCP Server
  participant Plugin as Browser Plugin
  participant Drawio as draw.io Runtime
  participant Model as Graph Model

  Server->>Plugin: request bounded snapshot for document/page
  Plugin->>Drawio: read pages, layers, cells, geometry, styles, metadata
  Drawio-->>Plugin: runtime cell data
  Plugin-->>Server: plain normalized snapshot payload
  Server->>Model: normalize snapshot
  Model-->>Server: immutable model plus indexes and revision
```

## Analysis Flow

```mermaid
flowchart TD
  Snapshot[Immutable model snapshot]
  Indexes[ID, page, layer, parent and adjacency indexes]
  Queries[Core graph queries]
  Rules[Analysis rulesets]
  Findings[Findings and suggestions]
  Review[Accepted or rejected analysis state]

  Snapshot --> Indexes
  Indexes --> Queries
  Queries --> Rules
  Rules --> Findings
  Findings --> Review
```

## Applying Changes

```mermaid
sequenceDiagram
  participant Analysis as Analysis Service
  participant Model as Internal Model
  participant Server as MCP Server
  participant Plugin as Browser Plugin
  participant Drawio as draw.io Runtime

  Analysis->>Model: produce change plan from snapshot revision
  Model-->>Analysis: planned operations with target draw.io IDs
  Analysis->>Server: apply through existing MCP operation sequence
  Server->>Server: verify target document and snapshot freshness
  Server->>Plugin: existing tool calls
  Plugin->>Drawio: mutate via draw.io runtime APIs
  Drawio-->>Plugin: mutation results
  Plugin-->>Server: results
  Server->>Plugin: request refreshed snapshot
```

## Core and Extensions

```mermaid
flowchart TB
  Core[Generic graph core]
  Entities[Diagram, Page, Layer, Element]
  ElementTypes[Node, Edge, Group, optional Port, Unknown]
  Values[Geometry, Style, Label, Metadata, ShapeReference]
  Extensions[Namespaced semantic extensions]
  Arch[cyberdraw.architecture]
  Cloud[cyberdraw.cloud]
  Security[cyberdraw.security]
  Compliance[cyberdraw.compliance]
  Rules[Domain rules and analyzers]

  Core --> Entities
  Entities --> ElementTypes
  Core --> Values
  Values --> Extensions
  Extensions --> Arch
  Extensions --> Cloud
  Extensions --> Security
  Extensions --> Compliance
  Arch --> Rules
  Cloud --> Rules
  Security --> Rules
  Compliance --> Rules
```
