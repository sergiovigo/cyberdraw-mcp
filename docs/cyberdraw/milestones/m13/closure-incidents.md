# M13 Closure Incident Register

## Status

COMPLETE / CLOSED.

This register separates operational validation issues from product defects.

## A. Codex Session With Stale MCP Inventory

| Field       | Record                                                                                       |
| ----------- | -------------------------------------------------------------------------------------------- |
| Symptom     | The Codex session did not initially expose the new public tool inventory.                    |
| Diagnosis   | The MCP client session had stale tool metadata after the server-side M13 change.             |
| Cause       | Operational session state, not an M13 product defect.                                        |
| Resolution  | Refreshing the MCP session made `cyberdraw_analyze_structure` available for real invocation. |
| Impact      | Delayed validation; no diagram data was modified.                                            |
| State final | CLOSED as an operational session issue.                                                      |

## B. WebSocket Port 3333 Conflict

| Field       | Record                                                                            |
| ----------- | --------------------------------------------------------------------------------- |
| Symptom     | Local validation could not bind or use the expected WebSocket port `3333`.        |
| Diagnosis   | Another process already occupied the port.                                        |
| Cause       | Operational process conflict, not an M13 product defect.                          |
| Resolution  | The conflicting process condition was cleared before final validation.            |
| Impact      | Delayed local validation; no code or diagram mutation resulted from the conflict. |
| State final | CLOSED as an operational process issue.                                           |

## C. Historical Document IDs Accumulated In One Connection

| Field       | Record                                                                                                                                                         |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Symptom     | A single WebSocket connection could retain historical document IDs after the active document changed.                                                          |
| Diagnosis   | Default M13 routing could see more than one document for one connection and treat default analysis as ambiguous or stale relative to the current editor state. |
| Cause       | Product defect in document registry lifecycle: inbound document state accumulated IDs instead of replacing the active document for that connection.            |
| Resolution  | PR #20 replaced the per-connection document set atomically with the current document. Conceptually: `entry.documents = new Map([[document.id, document]])`.    |
| Impact      | Affected default active-document resolution before the fix. Explicit multiconnection and `target_document` cases still needed to remain valid.                 |
| State final | CLOSED as a product defect fixed in code by PR #20.                                                                                                            |

## Classification Summary

| Incident | Classification            | Code correction |
| -------- | ------------------------- | --------------- |
| A        | Operational session issue | No              |
| B        | Operational process issue | No              |
| C        | Product defect            | Yes, PR #20     |
