import { build_channel } from "./tool.js";
import type { Context } from "./types.js";

export const CYBERDRAW_RUNTIME_SNAPSHOT_EVENT =
  "cyberdraw.runtimeSnapshot.v1";

export type RuntimeSnapshotRequest = {
  readonly target_document?: { readonly id: string };
  readonly limits?: Record<string, number>;
  readonly includeRaw?: boolean;
};

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
): Promise<unknown> {
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
      reply_timeout_ms:
        options.replyTimeoutMs ?? DEFAULT_RUNTIME_SNAPSHOT_TIMEOUT_MS,
    },
  );

  return channel(request, {} as never).then((result) => {
    const text = result.content[0]?.type === "text" ? result.content[0].text : "{}";
    return JSON.parse(text);
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
