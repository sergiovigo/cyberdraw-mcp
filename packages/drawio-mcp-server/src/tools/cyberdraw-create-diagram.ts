import type {
  CallToolResult,
  ServerNotification,
  ServerRequest,
} from "@modelcontextprotocol/sdk/types.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { z } from "zod";

import type { Context, ResolvedDocumentTarget } from "../types.js";
import { target_document_field } from "./shared.js";
import type { ToolRegistrar } from "./types.js";

export const TOOL_cyberdraw_create_diagram = "cyberdraw_create_diagram";
export const M15_PUBLIC_RESPONSE_VERSION = "m15-v1";
export const M15_MAX_MERMAID_BYTES = 64 * 1024;
const DEFAULT_REPLY_TIMEOUT_MS = 60_000;
const MAX_TITLE_LENGTH = 120;

const m15ReasonCodes = [
  "invalid-request",
  "unsupported-mermaid-type",
  "mermaid-too-large",
  "ambiguous-document",
  "mermaid-render-failed",
  "import-failed",
  "timeout",
] as const;

export type M15ReasonCode = (typeof m15ReasonCodes)[number];

type M15Safety = {
  readonly mutatesDiagram: true;
  readonly mutationAttempted: boolean;
  readonly mutationInvocations: number;
};

type M15RejectedResponse = {
  readonly version: typeof M15_PUBLIC_RESPONSE_VERSION;
  readonly outcome: "rejected";
  readonly reasonCodes: readonly M15ReasonCode[];
  readonly safety: M15Safety;
};

type M15FailedResponse = {
  readonly version: typeof M15_PUBLIC_RESPONSE_VERSION;
  readonly outcome: "failed";
  readonly reasonCodes: readonly M15ReasonCode[];
  readonly safety: M15Safety;
  readonly atomic?: "unknown";
};

type M15AcceptedResponse = {
  readonly version: typeof M15_PUBLIC_RESPONSE_VERSION;
  readonly outcome: "accepted";
  readonly created: {
    readonly pageId: string;
    readonly pageName: string;
  };
  readonly safety: M15Safety;
};

export type M15CreateDiagramResponse =
  | M15AcceptedResponse
  | M15RejectedResponse
  | M15FailedResponse;

const PublicToolInputSchema = {
  target_document: z.unknown().optional(),
  format: z.unknown().optional(),
  mermaidType: z.unknown().optional(),
  insertMode: z.unknown().optional(),
  mermaid: z.unknown().optional(),
  title: z.unknown().optional(),
  limits: z.unknown().optional(),
};

const CreateDiagramInputSchema = z
  .object({
    target_document: target_document_field().strict().optional(),
    format: z.literal("mermaid"),
    mermaidType: z.literal("flowchart"),
    insertMode: z.literal("new-page"),
    mermaid: z.string().min(1),
    title: z.string().optional(),
    limits: z
      .object({
        maxBytes: z.number().int().positive().max(M15_MAX_MERMAID_BYTES),
      })
      .strict(),
  })
  .strict();

type CreateDiagramInput = z.output<typeof CreateDiagramInputSchema>;

type PageInfo = {
  readonly id?: unknown;
  readonly name?: unknown;
  readonly is_current?: unknown;
};

type PluginReply = {
  readonly success?: unknown;
  readonly result?: unknown;
  readonly message?: unknown;
  readonly error?: unknown;
};

type ExtensionToolReply = {
  readonly sent: boolean;
  readonly timedOut: boolean;
  readonly reply: PluginReply;
};

export const registerCyberdrawCreateDiagramTool: ToolRegistrar = (
  server,
  context,
) => {
  server.tool(
    TOOL_cyberdraw_create_diagram,
    "Create a bounded draw.io flowchart from client-generated Mermaid. The tool creates a new page, uses draw.io's existing native Mermaid import path, reports explicit mutation status and never returns XML.",
    PublicToolInputSchema,
    async (rawArgs) => {
      const response = await createDiagramPublic(context, rawArgs);
      return toCallToolResult(response);
    },
  );
};

export async function createDiagramPublic(
  context: Context,
  input: unknown,
): Promise<M15CreateDiagramResponse> {
  const validation = validateCreateDiagramInput(input);
  if (!validation.accepted) {
    return rejected(validation.reasonCodes);
  }

  const { request } = validation;
  let resolved: ResolvedDocumentTarget;
  try {
    resolved = await context.document_routing.resolve_target_document(
      input as Record<string, unknown>,
    );
  } catch (error) {
    return rejected([reasonCodeFromRoutingError(error)]);
  }

  try {
    return await context.request_queue.enqueue(resolved.connection_id, () =>
      executeCreateDiagram(context, request, resolved),
    );
  } catch (error) {
    return failed([reasonCodeFromUnexpectedError(error)], false, 0);
  }
}

function validateCreateDiagramInput(input: unknown):
  | { readonly accepted: true; readonly request: CreateDiagramInput }
  | {
      readonly accepted: false;
      readonly reasonCodes: readonly M15ReasonCode[];
    } {
  const parsed = CreateDiagramInputSchema.safeParse(input);
  if (!parsed.success) {
    const unsupportedType = parsed.error.issues.some(
      (issue) =>
        issue.path.join(".") === "mermaidType" ||
        issue.path.join(".") === "format" ||
        issue.path.join(".") === "insertMode",
    );
    return {
      accepted: false,
      reasonCodes: [
        unsupportedType ? "unsupported-mermaid-type" : "invalid-request",
      ],
    };
  }

  const mermaidBytes = Buffer.byteLength(parsed.data.mermaid, "utf8");
  if (mermaidBytes > parsed.data.limits.maxBytes) {
    return { accepted: false, reasonCodes: ["mermaid-too-large"] };
  }

  if (!hasSupportedFlowchartHeader(parsed.data.mermaid)) {
    return { accepted: false, reasonCodes: ["unsupported-mermaid-type"] };
  }

  if (containsDisallowedMermaidContent(parsed.data.mermaid)) {
    return { accepted: false, reasonCodes: ["invalid-request"] };
  }

  return {
    accepted: true,
    request: {
      ...parsed.data,
      mermaid: parsed.data.mermaid.trim(),
      ...(parsed.data.title !== undefined
        ? { title: sanitizeTitle(parsed.data.title) }
        : {}),
    },
  };
}

async function executeCreateDiagram(
  context: Context,
  request: CreateDiagramInput,
  resolved: ResolvedDocumentTarget,
): Promise<M15CreateDiagramResponse> {
  const basePayload = {
    target_document: resolved.target_document,
    __target_connection_id: resolved.connection_id,
  };

  let mutationInvoked = false;
  try {
    context.log.debug("M15 create diagram runtime started", {
      mermaidBytes: Buffer.byteLength(request.mermaid, "utf8"),
      mermaidType: request.mermaidType,
      hasTargetDocument: Boolean(resolved.target_document),
      hasTitle: Boolean(request.title),
    });

    const beforePagesInvocation = await invokeExtensionTool(
      context,
      "list-pages",
      {
        ...basePayload,
      },
    );
    const beforePages = extractPages(beforePagesInvocation.reply);
    if (!beforePages) {
      return failed(
        [reasonCodeFromInvocation(beforePagesInvocation)],
        false,
        0,
      );
    }

    const importInvocation = await invokeExtensionTool(
      context,
      "import-mermaid",
      {
        ...basePayload,
        mermaid_source: request.mermaid,
        mode: "native",
        insert_mode: "new-page",
        ...(request.title ? { filename: request.title } : {}),
      },
    );
    mutationInvoked = importInvocation.sent;

    if (!importInvocation.sent) {
      return failed([reasonCodeFromInvocation(importInvocation)], false, 0);
    }

    if (!isSuccessfulImport(importInvocation.reply)) {
      return failed(
        [reasonCodeFromImportInvocation(importInvocation)],
        true,
        1,
        "unknown",
      );
    }

    const afterPagesInvocation = await invokeExtensionTool(
      context,
      "list-pages",
      {
        ...basePayload,
      },
    );
    const afterPages = extractPages(afterPagesInvocation.reply);
    const createdPage = afterPages
      ? findCreatedPage(beforePages, afterPages)
      : undefined;
    if (!createdPage) {
      return failed(
        [reasonCodeFromInvocation(afterPagesInvocation)],
        true,
        1,
        "unknown",
      );
    }

    context.log.debug("M15 create diagram runtime completed", {
      outcome: "accepted",
    });

    return {
      version: M15_PUBLIC_RESPONSE_VERSION,
      outcome: "accepted",
      created: {
        pageId: sanitizePublicIdentifier(createdPage.id),
        pageName: sanitizePublicText(createdPage.name),
      },
      safety: safety(true, 1),
    };
  } catch (error) {
    return failed(
      [reasonCodeFromUnexpectedError(error)],
      mutationInvoked,
      mutationInvoked ? 1 : 0,
      mutationInvoked ? "unknown" : undefined,
    );
  }
}

async function invokeExtensionTool(
  context: Context,
  eventName: string,
  payload: Record<string, unknown>,
): Promise<ExtensionToolReply> {
  const requestId = context.id_generator.generate();
  const replyName = `${eventName}.${requestId}`;
  try {
    context.bus.send_to_extension({
      __event: eventName,
      __request_id: requestId,
      ...payload,
    });
  } catch {
    return {
      sent: false,
      timedOut: false,
      reply: { success: false, message: "send failed" },
    };
  }

  context.log.debug("M15 create diagram extension request emitted", {
    operation: eventName,
  });

  return new Promise<ExtensionToolReply>((resolve) => {
    let settled = false;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    let cleanup: (() => void) | undefined;

    const finish = (finalize: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      cleanup?.();
      finalize();
    };

    timeoutHandle = setTimeout(() => {
      finish(() =>
        resolve({
          sent: true,
          timedOut: true,
          reply: { success: false, message: "timeout" },
        }),
      );
    }, DEFAULT_REPLY_TIMEOUT_MS);

    cleanup = context.bus.on_reply_from_extension(
      replyName,
      (reply: Record<string, unknown>) => {
        finish(() =>
          resolve({
            sent: true,
            timedOut: false,
            reply: reply as PluginReply,
          }),
        );
      },
    );
  });
}

function hasSupportedFlowchartHeader(source: string): boolean {
  const firstLine = source.trimStart().split(/\r?\n/, 1)[0]?.trim() ?? "";
  return /^flowchart\s+(LR|RL|TB|BT|TD)\b/.test(firstLine);
}

function containsDisallowedMermaidContent(source: string): boolean {
  return [
    /<\s*script\b/i,
    /\bjavascript\s*:/i,
    /\bcallback\b/i,
    /\bhttps?:\/\//i,
    /\bfile:\/\//i,
    /(^|\s)(?:\/[A-Za-z0-9._-]+){2,}/,
    /[A-Za-z]:\\[^\s]+/,
    /`/,
    /\$\(/,
    /\b(?:curl|wget|bash|sh|powershell|cmd\.exe|rm\s+-rf)\b/i,
  ].some((pattern) => pattern.test(source));
}

function sanitizeTitle(title: string): string | undefined {
  const trimmed = title.trim().replace(/[\u0000-\u001f\u007f]/g, " ");
  if (!trimmed) {
    return undefined;
  }
  return sanitizePublicText(trimmed).slice(0, MAX_TITLE_LENGTH);
}

function extractPages(reply: PluginReply): readonly PageInfo[] | undefined {
  if (reply.success !== true || !Array.isArray(reply.result)) {
    return undefined;
  }
  if (
    !reply.result.every(
      (page) =>
        page &&
        typeof page === "object" &&
        typeof (page as PageInfo).id === "string" &&
        ((page as PageInfo).name === undefined ||
          typeof (page as PageInfo).name === "string") &&
        ((page as PageInfo).is_current === undefined ||
          typeof (page as PageInfo).is_current === "boolean"),
    )
  ) {
    return undefined;
  }
  return reply.result as readonly PageInfo[];
}

function isSuccessfulImport(reply: PluginReply): boolean {
  if (reply.success !== true) {
    return false;
  }
  const result = reply.result;
  if (!result || typeof result !== "object") {
    return false;
  }
  return (result as { success?: unknown }).success !== false;
}

function findCreatedPage(
  beforePages: readonly PageInfo[],
  afterPages: readonly PageInfo[],
): PageInfo | undefined {
  const beforeIds = new Set(
    beforePages
      .map((page) => (typeof page.id === "string" ? page.id : undefined))
      .filter((id): id is string => id !== undefined),
  );
  const created = afterPages.filter(
    (page) => typeof page.id === "string" && !beforeIds.has(page.id),
  );
  if (created.length === 1) {
    return created[0];
  }
  return undefined;
}

function reasonCodeFromRoutingError(error: unknown): M15ReasonCode {
  const message = error instanceof Error ? error.message : String(error);
  if (/multiple draw\.io documents|ambiguous/i.test(message)) {
    return "ambiguous-document";
  }
  if (/timed out|timeout/i.test(message)) {
    return "timeout";
  }
  return "import-failed";
}

function reasonCodeFromImportInvocation(
  invocation: ExtensionToolReply,
): M15ReasonCode {
  const genericReason = reasonCodeFromInvocation(invocation);
  if (genericReason === "timeout") {
    return genericReason;
  }
  const { reply } = invocation;
  const message =
    typeof reply.message === "string"
      ? reply.message
      : typeof (reply.result as { message?: unknown } | undefined)?.message ===
          "string"
        ? String((reply.result as { message: string }).message)
        : typeof reply.error === "string"
          ? reply.error
          : "";
  if (/timeout/i.test(message)) {
    return "timeout";
  }
  if (
    /mermaid (?:render|parser)|parsemermaid|parser returned empty/i.test(
      message,
    )
  ) {
    return "mermaid-render-failed";
  }
  return "import-failed";
}

function reasonCodeFromInvocation(
  invocation: ExtensionToolReply,
): M15ReasonCode {
  if (invocation.timedOut) {
    return "timeout";
  }
  const { reply } = invocation;
  const message =
    typeof reply.message === "string"
      ? reply.message
      : typeof reply.error === "string"
        ? reply.error
        : "";
  return /timeout|timed out/i.test(message) ? "timeout" : "import-failed";
}

function reasonCodeFromUnexpectedError(error: unknown): M15ReasonCode {
  return isTimeoutError(error) ? "timeout" : "import-failed";
}

function sanitizePublicIdentifier(value: unknown): string {
  return sanitizePublicText(value).slice(0, 256);
}

function sanitizePublicText(value: unknown): string {
  const text =
    typeof value === "string" && !containsSensitiveToken(value) ? value : "";
  return text.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
}

function containsSensitiveToken(value: string): boolean {
  return /<\s*mxGraphModel\b|<\s*mxfile\b|<\s*mxCell\b|https?:\/\/|file:\/\/|\/home\/|[A-Za-z]:\\/i.test(
    value,
  );
}

function rejected(reasonCodes: readonly M15ReasonCode[]): M15RejectedResponse {
  return {
    version: M15_PUBLIC_RESPONSE_VERSION,
    outcome: "rejected",
    reasonCodes: sortReasonCodes(reasonCodes),
    safety: safety(false, 0),
  };
}

function failed(
  reasonCodes: readonly M15ReasonCode[],
  mutationAttempted: boolean,
  mutationInvocations: number,
  atomic?: "unknown",
): M15FailedResponse {
  return {
    version: M15_PUBLIC_RESPONSE_VERSION,
    outcome: "failed",
    reasonCodes: sortReasonCodes(reasonCodes),
    safety: safety(mutationAttempted, mutationInvocations),
    ...(atomic ? { atomic } : {}),
  };
}

function safety(
  mutationAttempted: boolean,
  mutationInvocations: number,
): M15Safety {
  return {
    mutatesDiagram: true,
    mutationAttempted,
    mutationInvocations,
  };
}

function sortReasonCodes(
  reasonCodes: readonly M15ReasonCode[],
): readonly M15ReasonCode[] {
  const order = new Map<M15ReasonCode, number>(
    m15ReasonCodes.map((code, index) => [code, index]),
  );
  return [...new Set(reasonCodes)].sort(
    (left, right) => (order.get(left) ?? 0) - (order.get(right) ?? 0),
  );
}

function toCallToolResult(response: M15CreateDiagramResponse): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(response),
      },
    ],
  };
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && /timeout|timed out/i.test(error.message);
}

export type CyberdrawCreateDiagramInput = z.output<
  typeof CreateDiagramInputSchema
>;
