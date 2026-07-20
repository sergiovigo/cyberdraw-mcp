# ADR 0006: WebSocket Active Document Registry

## Status

Accepted.

## Context

Draw.io editor sessions connect to the MCP server over WebSocket and report
document state. M13 default scope resolution depends on knowing the active
document for a public call that omits `target_document`.

## Problem

Before PR #20, one WebSocket connection could accumulate historical document
IDs. A later default analysis could therefore observe more than one document for
one connection even though the editor connection had exactly one active document
at that instant.

That accumulation made default routing ambiguous and could obscure the current
editor state.

## Cause

Inbound document-state updates added document IDs to the connection entry
without atomically replacing the active document set for that same connection.

## Decision

A WebSocket connection maintains exactly one active document at each instant.
When a connection reports document state, the server replaces that connection's
document map with the reported active document.

Conceptually:

```ts
entry.documents = new Map([[document.id, document]]);
```

This ADR records the invariant, not a line-level implementation contract.

## Preserved Behavior

- Multiple WebSocket connections can still represent multiple available
  documents.
- Multiple documents can still exist globally when they are owned by separate
  active connections.
- Explicit `target_document` routing is preserved.
- Default routing still fails closed when more than one legitimate active
  document is available across connections.
- Removing or closing a connection removes that connection's active document.
- Repeated updates for the same document ID replace metadata with the latest
  reported document state instead of duplicating IDs.

## Consequences

Positive:

- default M13 analysis uses the current document for a connection;
- stale historical IDs no longer make one connection appear ambiguous;
- active-document state matches the editor's latest document-state message.

Negative:

- historical document IDs are intentionally discarded for a connection;
- callers that need a previous document must use a still-active connection or an
  explicit target that is currently registered.

## Risks

- A client that incorrectly emits partial document-state updates can replace the
  active document with incomplete metadata.
- Multiconnection ambiguity remains possible and should continue to fail closed
  unless an explicit target is supplied.

## Security And Privacy Impact

Replacing per-connection document state reduces accidental analysis of stale
documents. It also supports M13's fail-closed default routing by distinguishing
one connection changing documents from multiple connections legitimately
holding separate documents.
