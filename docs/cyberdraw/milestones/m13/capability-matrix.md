# M13 Capability Matrix

## Status

COMPLETE / CLOSED.

This matrix records the public M13 capability surface. All capabilities are
exposed only through `cyberdraw_analyze_structure`.

| Capability                 | Public exposure       | Mode                         | Scope                                                        | Read or mutation | Output                                                  | Limits                                                        | Test evidence                                                |
| -------------------------- | --------------------- | ---------------------------- | ------------------------------------------------------------ | ---------------- | ------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------ |
| Analyze                    | Public                | `analyze`                    | Default, page or layer                                       | Read             | `m13-v1` summary and public findings                    | Public response caps and snapshot caps                        | `cyberdraw-analyze-structure.test.ts`; real M13 MCP test     |
| Query                      | Public                | `query`                      | Default, page or layer                                       | Read             | Public query counts and filtered finding IDs            | Query limit and ID-array caps                                 | `cyberdraw-analyze-structure.test.ts`; real M13 MCP test     |
| Plan                       | Public                | `plan`                       | Default, page or layer                                       | Read             | Non-executable public proposals                         | Proposal caps and closed policies                             | `cyberdraw-analyze-structure.test.ts`; real M13 MCP test     |
| Validate                   | Public                | `validate`                   | Default, page or layer                                       | Read             | Public validation status and summary                    | Validation mode and response caps                             | `cyberdraw-analyze-structure.test.ts`; real M13 MCP test     |
| Default scope              | Public default        | All modes                    | Active document, active page, visible layer or page fallback | Read             | `scope.requested.defaulted: true`                       | Fails closed when active page or document is ambiguous        | Default-scope unit tests; real default-scope MCP test        |
| Explicit page scope        | Public input          | All modes                    | Requested page                                               | Read             | Inspected page in public scope                          | Missing page is controlled failure                            | Explicit scope unit tests                                    |
| Explicit layer scope       | Public input          | All modes                    | Requested page and layer                                     | Read             | Inspected layer target in public scope                  | `layerId` requires `pageId`; missing layer is limited outcome | Explicit scope unit tests                                    |
| Bounded expansion          | Public input          | All modes                    | Scope-derived expansion                                      | Read             | Expanded scope and limitations                          | `maxScopes`, `maxDepth`, `maxBytes` caps                      | Mode and expansion unit tests; real external-reference tests |
| Revision compatibility     | Public output         | All modes                    | Inspected scope                                              | Read             | `revision.compatible` and revision counts               | Stale or incompatible revision returns controlled status      | M12 validation tests; real M13 MCP test                      |
| Limitations                | Public output         | All modes                    | Inspected scope                                              | Read             | Closed limitation codes                                 | Public limitation count cap                                   | Public mapper and real validation evidence                   |
| Safety counters            | Public output         | All modes                    | Any accepted scope                                           | Read             | `readOnly`, `mutationAttempted`, `mutationInvocations`  | Mutation counter must remain zero                             | Mutation invariant unit tests; real M13 MCP test             |
| Determinism                | Public behavior       | All modes                    | Any accepted scope                                           | Read             | Canonical ordering and stable public IDs                | Array and response caps                                       | Deterministic ordering unit test                             |
| UI preservation            | Test-covered behavior | Real MCP flow                | Scoped runtime snapshots                                     | Read             | UI state remains preserved by harness assertions        | Runtime harness cleanup and preservation checks               | `hierarchical-snapshot.test.ts`                              |
| Multiple-document handling | Server behavior       | Default and explicit routing | Active document per connection; explicit target document     | Read             | Latest active document is used for default M13 analysis | Ambiguous defaults fail closed                                | `documents-changed-broadcast.test.ts`                        |

## Notes

M13 exposes no mutation capability. Public plans describe candidate operations
but always remain non-executable through this tool.
