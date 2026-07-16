import { build_channel } from "./tool.js";
import type { Context } from "./types.js";
import {
  CYBERDRAW_RUNTIME_SNAPSHOT_EVENT,
  findRuntimeSnapshotCapability,
  validateRuntimeSnapshot,
  type RuntimeSnapshot,
  type RuntimeSnapshotOptions,
} from "cyberdraw-runtime-contract";

export type RuntimeSnapshotRequest = RuntimeSnapshotOptions;

export type RuntimeSnapshotReply = {
  readonly success?: boolean;
  readonly result?: unknown;
  readonly error?: unknown;
};

const DEFAULT_RUNTIME_SNAPSHOT_TIMEOUT_MS = 90_000;

export function requestCyberdrawRuntimeSnapshot(
  context: Context,
  request: RuntimeSnapshotRequest,
  options: { readonly replyTimeoutMs?: number } = {},
): Promise<RuntimeSnapshot> {
  const channel = build_channel<RuntimeSnapshotRequest>(
    context,
    CYBERDRAW_RUNTIME_SNAPSHOT_EVENT,
    (reply: RuntimeSnapshotReply) => {
      if (reply?.success === false) {
        throw new Error(formatSnapshotError(reply.error));
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(reply?.result ?? reply),
          },
        ],
      };
    },
    {
      queue: true,
      log_reply: false,
      reply_timeout_ms:
        options.replyTimeoutMs ?? DEFAULT_RUNTIME_SNAPSHOT_TIMEOUT_MS,
      before_send: (resolved) => {
        const capability = findRuntimeSnapshotCapability(
          resolved.runtime_capabilities,
        );
        if (!capability) {
          context.log.log(
            "warn",
            `[cyberdraw.runtimeSnapshot] peer ${resolved.connection_id} does not advertise cyberdraw.runtimeSnapshot.v1`,
          );
          throw new Error(
            `Connected Draw.io peer for document ${resolved.document.id} does not support cyberdraw.runtimeSnapshot.v1`,
          );
        }
        context.log.debug(
          `[cyberdraw.runtimeSnapshot] starting request for document ${resolved.document.id} on peer ${resolved.connection_id}`,
        );
      },
    },
  );

  return channel(request, {} as never).then((result) => {
    const text = result.content[0]?.type === "text" ? result.content[0].text : "{}";
    const parsed = JSON.parse(text) as unknown;
    const validation = validateRuntimeSnapshot(parsed);
    if (!validation.ok) {
      context.log.log(
        "warn",
        `[cyberdraw.runtimeSnapshot] rejected malformed snapshot response: ${validation.error}`,
      );
      throw new Error(validation.error);
    }
    const snapshot = validation.snapshot;
    context.log.debug(
      `[cyberdraw.runtimeSnapshot] completed revision=${snapshot.document.revisionSignals.contentRevision} pages=${snapshot.pages.length} elements=${snapshot.pages.reduce((sum, page) => sum + page.elements.length, 0)} bytes=${snapshot.payload.measuredJsonBytes ?? snapshot.payload.approximateJsonBytes} truncated=${snapshot.truncated}`,
    );
    return snapshot;
  });
}

function formatSnapshotError(error: unknown): string {
  if (error && typeof error === "object") {
    const message = (error as { readonly message?: unknown }).message;
    if (typeof message === "string" && message.length > 0) {
      return message.slice(0, 500);
    }
  }
  if (typeof error === "string") {
    return error.slice(0, 500);
  }
  return "Runtime snapshot extraction failed";
}
