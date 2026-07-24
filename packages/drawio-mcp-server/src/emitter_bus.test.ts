import { describe, it, expect, jest } from "@jest/globals";
import { EventEmitter } from "node:events";
import { create_bus } from "./emitter_bus.js";
import { bus_request_stream, bus_reply_stream, Bus } from "./types.js";
import { create_logger } from "./standard_console_logger.js";

describe("create_bus", () => {
  let emitter: EventEmitter;
  let bus: Bus;
  const log = create_logger();

  beforeEach(() => {
    emitter = new EventEmitter();
    bus = create_bus(log)(emitter);
  });

  it("should send requests to extension via emitter", () => {
    const mockRequest = { type: "test_request", data: "test" };
    const emitSpy = jest.spyOn(emitter, "emit");

    bus.send_to_extension(mockRequest);

    expect(emitSpy).toHaveBeenCalledWith(bus_request_stream, mockRequest);
  });

  it("should register reply handlers and call them when matching events arrive", () => {
    const mockReply1 = jest.fn();
    const mockReply2 = jest.fn();
    const eventName1 = "event1";
    const eventName2 = "event2";
    const matchingEvent1 = { __event: eventName1, data: "test1" };
    const matchingEvent2 = { __event: eventName2, data: "test2" };
    const nonMatchingEvent = { __event: "other_event", data: "test3" };

    bus.on_reply_from_extension(eventName1, mockReply1);
    bus.on_reply_from_extension(eventName2, mockReply2);

    emitter.emit(bus_reply_stream, matchingEvent1);
    emitter.emit(bus_reply_stream, matchingEvent2);
    emitter.emit(bus_reply_stream, nonMatchingEvent);

    expect(mockReply1).toHaveBeenCalledWith(matchingEvent1);
    expect(mockReply2).toHaveBeenCalledWith(matchingEvent2);
    expect(mockReply1).not.toHaveBeenCalledWith(nonMatchingEvent);
    expect(mockReply2).not.toHaveBeenCalledWith(nonMatchingEvent);
  });

  it("should track all registered listeners", () => {
    // This test assumes the listeners array is accessible or there's a way to verify listeners
    // Since the original code doesn't expose the listeners array, we'll test indirectly
    const mockReply1 = jest.fn();
    const mockReply2 = jest.fn();

    bus.on_reply_from_extension("event1", mockReply1);
    bus.on_reply_from_extension("event2", mockReply2);

    // Verify listeners are working by emitting events
    const event1 = { __event: "event1", data: "test" };
    const event2 = { __event: "event2", data: "test" };

    emitter.emit(bus_reply_stream, event1);
    emitter.emit(bus_reply_stream, event2);

    expect(mockReply1).toHaveBeenCalledWith(event1);
    expect(mockReply2).toHaveBeenCalledWith(event2);
  });

  it("should only call the correct reply handler for each event", () => {
    const mockReply1 = jest.fn();
    const mockReply2 = jest.fn();
    const eventName1 = "event1";
    const eventName2 = "event2";
    const matchingEvent = { __event: eventName1, data: "test" };

    bus.on_reply_from_extension(eventName1, mockReply1);
    bus.on_reply_from_extension(eventName2, mockReply2);

    emitter.emit(bus_reply_stream, matchingEvent);

    expect(mockReply1).toHaveBeenCalledWith(matchingEvent);
    expect(mockReply2).not.toHaveBeenCalled();
  });

  it("should allow callers to unsubscribe pending reply handlers", () => {
    const mockReply = jest.fn();
    const unsubscribe = bus.on_reply_from_extension("event1", mockReply);

    unsubscribe();
    emitter.emit(bus_reply_stream, { __event: "event1", data: "late" });

    expect(mockReply).not.toHaveBeenCalled();
  });

  it("redacts Mermaid source from request logs without changing emitted payload", () => {
    const entries: unknown[][] = [];
    const redactingBus = create_bus({
      debug: (...args: unknown[]) => entries.push(args),
      log: () => {},
    })(emitter);
    const mermaid = "flowchart LR\n  Secret --> Database";
    const request = {
      __event: "import-mermaid",
      mermaid_source: mermaid,
      mode: "native",
      insert_mode: "new-page",
    };
    const emitSpy = jest.spyOn(emitter, "emit");

    redactingBus.send_to_extension(request);

    expect(emitSpy).toHaveBeenCalledWith(bus_request_stream, request);
    const serializedLogs = JSON.stringify(entries);
    expect(serializedLogs).toContain('"mermaid_source":"[REDACTED]"');
    expect(serializedLogs).toContain(
      `"mermaid_source_bytes":${Buffer.byteLength(mermaid, "utf8")}`,
    );
    expect(serializedLogs).toContain('"mode":"native"');
    expect(serializedLogs).not.toContain("Secret --> Database");
  });

  it("redacts nested raw payloads and XML from bus logs", () => {
    const entries: unknown[][] = [];
    const redactingBus = create_bus({
      debug: (...args: unknown[]) => entries.push(args),
      log: () => {},
    })(emitter);

    redactingBus.send_to_extension({
      __event: "test",
      error: {
        stack: "Error: failed at /home/user/project/file.ts",
        xml: "<mxGraphModel><mxCell /></mxGraphModel>",
        rawResponse: { value: "<mxCell />" },
      },
    });

    const serializedLogs = JSON.stringify(entries);
    expect(serializedLogs).not.toContain("mxGraphModel");
    expect(serializedLogs).not.toContain("mxCell");
    expect(serializedLogs).not.toContain("/home/user/project");
    expect(serializedLogs).not.toContain("rawResponse");
  });

  it("handles circular objects without blocking dispatch or mutating payload", () => {
    const entries: unknown[][] = [];
    const redactingBus = create_bus({
      debug: (...args: unknown[]) => entries.push(args),
      log: () => {},
    })(emitter);
    const payload: Record<string, unknown> = { __event: "test" };
    payload.self = payload;
    const originalKeys = Object.keys(payload);
    const emitSpy = jest.spyOn(emitter, "emit");

    expect(() => redactingBus.send_to_extension(payload)).not.toThrow();

    expect(emitSpy).toHaveBeenCalledWith(bus_request_stream, payload);
    expect(payload.self).toBe(payload);
    expect(Object.keys(payload)).toEqual(originalKeys);
    expect(JSON.stringify(entries)).toContain('"self":"[CIRCULAR]"');
  });

  it("handles circular arrays in payloads", () => {
    const entries: unknown[][] = [];
    const redactingBus = create_bus({
      debug: (...args: unknown[]) => entries.push(args),
      log: () => {},
    })(emitter);
    const circularArray: unknown[] = [];
    circularArray.push(circularArray);
    const payload = {
      __event: "test",
      values: circularArray,
    };
    const emitSpy = jest.spyOn(emitter, "emit");

    expect(() => redactingBus.send_to_extension(payload)).not.toThrow();

    expect(emitSpy).toHaveBeenCalledWith(bus_request_stream, payload);
    expect(circularArray[0]).toBe(circularArray);
    expect(JSON.stringify(entries)).toContain('"values":["[CIRCULAR]"]');
  });

  it("handles nested circular payloads while redacting Mermaid source", () => {
    const entries: unknown[][] = [];
    const redactingBus = create_bus({
      debug: (...args: unknown[]) => entries.push(args),
      log: () => {},
    })(emitter);
    const nested: Record<string, unknown> = { name: "nested" };
    nested.parent = { child: nested };
    const payload = {
      __event: "import-mermaid",
      mermaid_source: "flowchart LR\n  Secret --> Database",
      nested,
    };
    const emitSpy = jest.spyOn(emitter, "emit");

    expect(() => redactingBus.send_to_extension(payload)).not.toThrow();

    expect(emitSpy).toHaveBeenCalledWith(bus_request_stream, payload);
    const serializedLogs = JSON.stringify(entries);
    expect(serializedLogs).toContain('"mermaid_source":"[REDACTED]"');
    expect(serializedLogs).toContain('"child":"[CIRCULAR]"');
    expect(serializedLogs).not.toContain("Secret --> Database");
  });

  it("redacts Error objects without leaking stack or sensitive message content", () => {
    const entries: unknown[][] = [];
    const redactingBus = create_bus({
      debug: (...args: unknown[]) => entries.push(args),
      log: () => {},
    })(emitter);
    const payload = {
      __event: "test",
      error: new Error(
        "Error: failed at /home/user/project/file.ts <mxGraphModel />",
      ),
    };

    expect(() => redactingBus.send_to_extension(payload)).not.toThrow();

    const serializedLogs = JSON.stringify(entries);
    expect(serializedLogs).toContain('"name":"Error"');
    expect(serializedLogs).toContain('"message":"[REDACTED]"');
    expect(serializedLogs).not.toContain("stack");
    expect(serializedLogs).not.toContain("/home/user/project");
    expect(serializedLogs).not.toContain("mxGraphModel");
  });

  it("continues dispatch if payload redaction throws unexpectedly", () => {
    const redactingBus = create_bus({
      debug: () => {},
      log: () => {},
    })(emitter);
    const payload: Record<string, unknown> = { __event: "test" };
    Object.defineProperty(payload, "explosive", {
      enumerable: true,
      get() {
        throw new Error("redaction failed");
      },
    });
    const emitSpy = jest.spyOn(emitter, "emit");

    expect(() => redactingBus.send_to_extension(payload)).not.toThrow();

    expect(emitSpy).toHaveBeenCalledWith(bus_request_stream, payload);
  });

  it("continues dispatch if the logger throws", () => {
    const redactingBus = create_bus({
      debug: () => {
        throw new Error("logger failed");
      },
      log: () => {},
    })(emitter);
    const payload = { __event: "test", message: "safe metadata" };
    const emitSpy = jest.spyOn(emitter, "emit");

    expect(() => redactingBus.send_to_extension(payload)).not.toThrow();

    expect(emitSpy).toHaveBeenCalledWith(bus_request_stream, payload);
  });
});
