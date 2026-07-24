import { EventEmitter } from "node:events";
import { Bus, bus_reply_stream, bus_request_stream, Logger } from "./types.js";

export function create_bus(log: Logger) {
  return function (emitter: EventEmitter): Bus {
    const bus: Bus = {
      send_to_extension: (request) => {
        safeDebug(log, `[bus] sending to Extension`, request);
        emitter.emit(bus_request_stream, request);
      },
      on_reply_from_extension: (event_name, reply) => {
        const listener = (emitter_data: any) => {
          safeDebug(log, `[bus] received from Extension`, emitter_data);
          if (emitter_data && emitter_data.__event === event_name) {
            emitter.off(bus_reply_stream, listener);
            reply(emitter_data);
          }
        };
        emitter.on(bus_reply_stream, listener);
        return () => {
          emitter.off(bus_reply_stream, listener);
        };
      },
    };
    return bus;
  };
}

function safeDebug(log: Logger, message: string, payload: unknown): void {
  try {
    log.debug(message, redactBusPayload(payload));
  } catch {
    try {
      log.debug(message, "[REDACTION_FAILED]");
    } catch {
      // Diagnostics must never block request dispatch.
    }
  }
}

function redactBusPayload(value: unknown): unknown {
  if (!value || typeof value !== "object") {
    return value;
  }

  const seen = new WeakSet<object>();
  const payload = value as Record<string, unknown>;
  const redacted: Record<string, unknown> = {};
  seen.add(payload);

  for (const [key, fieldValue] of Object.entries(payload)) {
    if (key === "mermaid_source") {
      redacted[key] = "[REDACTED]";
      redacted.mermaid_source_bytes =
        typeof fieldValue === "string"
          ? Buffer.byteLength(fieldValue, "utf8")
          : 0;
      continue;
    }
    if (isSensitivePayloadKey(key)) {
      redacted.sensitive_fields_redacted =
        Number(redacted.sensitive_fields_redacted ?? 0) + 1;
      continue;
    }
    redacted[key] = redactNestedValue(fieldValue, seen);
  }

  return redacted;
}

function redactNestedValue(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === "string") {
    if (containsSensitiveText(value) || value.length > 512) {
      return "[REDACTED]";
    }
    return value;
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  if (seen.has(value)) {
    return "[CIRCULAR]";
  }
  seen.add(value);
  if (Array.isArray(value)) {
    return value.length > 20
      ? `[REDACTED_ARRAY:${value.length}]`
      : value.map((item) => redactNestedValue(item, seen));
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactNestedValue(value.message, seen),
    };
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !isSensitivePayloadKey(key))
      .map(([key, fieldValue]) => [key, redactNestedValue(fieldValue, seen)]),
  );
}

function isSensitivePayloadKey(key: string): boolean {
  return /^(?:xml|data|rawResponse|pluginResponse|stack|stackTrace)$/i.test(
    key,
  );
}

function containsSensitiveText(value: string): boolean {
  return /<\s*(?:mxGraphModel|mxfile|mxCell)\b|https?:\/\/|file:\/\/|\/home\/|[A-Za-z]:\\|Error:/i.test(
    value,
  );
}
