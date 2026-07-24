import { build_channel } from "./tool.js";
import type { Context } from "./types.js";
import { performance } from "node:perf_hooks";
import {
  CYBERDRAW_RUNTIME_SNAPSHOT_EVENT,
  findRuntimeSnapshotCapability,
  normalizeRuntimeSnapshotScope,
  runtimeSnapshotScopeSupported,
  validateRuntimeSnapshotResponseForRequest,
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

export type MeasuredRuntimeSnapshot = {
  readonly snapshot: RuntimeSnapshot;
  readonly metrics: {
    readonly websocketRoundTripMs: number;
    readonly serverParseMs: number;
    readonly serverValidationMs: number;
  };
};

export function requestCyberdrawRuntimeSnapshot(
  context: Context,
  request: RuntimeSnapshotRequest,
  options: { readonly replyTimeoutMs?: number } = {},
): Promise<RuntimeSnapshot> {
  return requestCyberdrawRuntimeSnapshotMeasured(
    context,
    request,
    options,
  ).then((result) => result.snapshot);
}

export function requestCyberdrawRuntimeSnapshotMeasured(
  context: Context,
  request: RuntimeSnapshotRequest,
  options: { readonly replyTimeoutMs?: number } = {},
): Promise<MeasuredRuntimeSnapshot> {
  const requestedScopeResult = normalizeRuntimeSnapshotScope(request.scope);
  if (!requestedScopeResult.ok) {
    throw new Error(requestedScopeResult.error);
  }
  const requestedScope = requestedScopeResult.scope;
  const normalizedRequest = { ...request, scope: requestedScope };
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
        if (!runtimeSnapshotScopeSupported(capability, requestedScope)) {
          context.log.log(
            "warn",
            `[cyberdraw.runtimeSnapshot] peer ${resolved.connection_id} does not support requested scope kind ${requestedScope.kind}`,
          );
          throw new Error(
            `Connected Draw.io peer for document ${resolved.document.id} does not support runtime snapshot scope ${requestedScope.kind}`,
          );
        }
        context.log.debug(
          `[cyberdraw.runtimeSnapshot] starting request scope=${requestedScope.kind} for document ${resolved.document.id} on peer ${resolved.connection_id}`,
        );
      },
    },
  );

  const roundTripStarted = performance.now();
  return channel(normalizedRequest, {} as never).then((result) => {
    const websocketRoundTripMs = performance.now() - roundTripStarted;
    const text =
      result.content[0]?.type === "text" ? result.content[0].text : "{}";
    const parseStarted = performance.now();
    const parsed = JSON.parse(text) as unknown;
    const serverParseMs = performance.now() - parseStarted;
    const validationStarted = performance.now();
    const validation = validateRuntimeSnapshotResponseForRequest(
      parsed,
      requestedScope,
    );
    const serverValidationMs = performance.now() - validationStarted;
    if (!validation.ok) {
      context.log.log(
        "warn",
        `[cyberdraw.runtimeSnapshot] rejected malformed snapshot response: ${validation.error}`,
      );
      throw new Error(validation.error);
    }
    const snapshot = validation.snapshot;
    context.log.debug(
      `[cyberdraw.runtimeSnapshot] completed scope=${snapshot.scope.resolvedScope.kind} revision=${snapshot.document.revisionSignals.contentRevision} pages=${snapshot.scope.includedPages.length} layers=${snapshot.scope.includedLayers.reduce((sum, entry) => sum + entry.layerIds.length, 0)} elements=${snapshot.scope.includedElementCount} context=${snapshot.scope.contextElementCount} externalRefs=${snapshot.scope.externalReferences.length} bytes=${snapshot.payload.measuredJsonBytes ?? snapshot.payload.approximateJsonBytes} completeness=${snapshot.completeness.status}`,
    );
    return {
      snapshot,
      metrics: {
        websocketRoundTripMs,
        serverParseMs,
        serverValidationMs,
      },
    };
  });
}

function formatSnapshotError(error: unknown): string {
  if (error && typeof error === "object") {
    const message = (error as { readonly message?: unknown }).message;
    if (typeof message === "string" && message.length > 0) {
      return sanitizeSnapshotErrorMessage(message).slice(0, 500);
    }
  }
  if (typeof error === "string") {
    return sanitizeSnapshotErrorMessage(error).slice(0, 500);
  }
  return "Runtime snapshot extraction failed";
}

function sanitizeSnapshotErrorMessage(message: string): string {
  if (containsSensitiveRuntimeErrorText(message)) {
    return "Runtime snapshot extraction failed";
  }
  return message;
}

function containsSensitiveRuntimeErrorText(value: string): boolean {
  return /<\s*(?:mxGraphModel|mxfile|mxCell)\b|https?:\/\/|file:\/\/|\/home\/|[A-Za-z]:\\|(?:^|\n)\s*at\s+|\bError:/i.test(
    value,
  );
}
