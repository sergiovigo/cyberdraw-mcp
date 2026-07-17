import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import {
  createMainThreadImpactProbe,
  extract_runtime_snapshot,
} from "./runtime-snapshot.js";
import type { RuntimeSnapshot } from "cyberdraw-runtime-contract";

type TimerCallback = () => void;

describe("runtime snapshot main-thread impact probe", () => {
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  const originalWindow = (globalThis as typeof globalThis & { window?: unknown }).window;

  beforeEach(() => {
    (globalThis as { window?: any }).window = undefined;
  });

  afterEach(() => {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
    (globalThis as typeof globalThis & { window?: unknown }).window = originalWindow;
    jest.restoreAllMocks();
  });

  test("normal snapshots do not create timers, RAF callbacks, observers, or promises", () => {
    const timers = installManualTimers();
    const requestAnimationFrame = jest.fn();
    const observer = jest.fn();
    (globalThis as { window?: any }).window = {
      requestAnimationFrame,
      PerformanceObserver: observer,
    };

    const result = extract_runtime_snapshot(minimalUi(), {});

    expect(isPromise(result)).toBe(false);
    expect(timers.setTimeoutCalls()).toBe(0);
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    expect(observer).not.toHaveBeenCalled();
    expect((result as RuntimeSnapshot).performance.mainThreadTimerDriftMs).toBeUndefined();
  });

  test("opt-in snapshots collect optional fields and clean up on success", async () => {
    const timers = installManualTimers();
    const raf = installManualRaf();
    const observer = installObserver();
    (globalThis as { window?: any }).window = {
      requestAnimationFrame: raf.requestAnimationFrame,
      cancelAnimationFrame: raf.cancelAnimationFrame,
      PerformanceObserver: observer.ctor,
    };

    const result = extract_runtime_snapshot(minimalUi(), {
      measureMainThreadImpact: true,
    });

    expect(isPromise(result)).toBe(true);
    expect(timers.setTimeoutCalls()).toBe(2);
    expect(raf.requestAnimationFrame).toHaveBeenCalledTimes(1);
    timers.runAll();
    const snapshot = await result;

    expect(snapshot.performance.mainThreadTimerDriftMs).toEqual(expect.any(Number));
    expect(snapshot.performance.mainThreadRafDelayMs).toBeUndefined();
    expect(snapshot.performance.longTaskCount).toBe(0);
    expect(timers.pending()).toHaveLength(0);
    expect(timers.clearTimeoutCalls()).toBeGreaterThanOrEqual(1);
    expect(raf.cancelAnimationFrame).toHaveBeenCalledTimes(1);
    expect(observer.disconnect).toHaveBeenCalledTimes(1);
  });

  test("probe finish resolves and leaves no pending timer promise", async () => {
    const timers = installManualTimers();
    const probe = createMainThreadImpactProbe();
    const finished = probe.finish();

    expect(timers.pending()).toHaveLength(2);
    timers.runAll();
    await expect(finished).resolves.toMatchObject({
      mainThreadTimerDriftMs: expect.any(Number),
    });
    expect(timers.pending()).toHaveLength(0);
    probe.dispose();
  });

  test("probe dispose clears initial and finish timers and resolves finish", async () => {
    const timers = installManualTimers();
    const probe = createMainThreadImpactProbe();
    const finished = probe.finish();

    probe.dispose();

    await expect(finished).resolves.toMatchObject({
      mainThreadTimerDriftMs: expect.any(Number),
    });
    expect(timers.pending()).toHaveLength(0);
    expect(timers.clearTimeoutCalls()).toBeGreaterThanOrEqual(2);
  });

  test("probe cancels requestAnimationFrame and disconnects observer on explicit dispose", () => {
    installManualTimers();
    const raf = installManualRaf();
    const observer = installObserver();
    (globalThis as { window?: any }).window = {
      requestAnimationFrame: raf.requestAnimationFrame,
      cancelAnimationFrame: raf.cancelAnimationFrame,
      PerformanceObserver: observer.ctor,
    };

    const probe = createMainThreadImpactProbe();
    probe.dispose();

    expect(raf.cancelAnimationFrame).toHaveBeenCalledTimes(1);
    expect(observer.disconnect).toHaveBeenCalledTimes(1);
  });

  test("probe tolerates missing requestAnimationFrame", async () => {
    const timers = installManualTimers();
    const observer = installObserver();
    (globalThis as { window?: any }).window = {
      PerformanceObserver: observer.ctor,
    };

    const probe = createMainThreadImpactProbe();
    const finished = probe.finish();
    timers.runAll();

    await expect(finished).resolves.toMatchObject({
      mainThreadRafDelayMs: undefined,
    });
    expect(observer.disconnect).toHaveBeenCalledTimes(1);
  });

  test("probe tolerates missing PerformanceObserver", async () => {
    const timers = installManualTimers();
    const raf = installManualRaf();
    (globalThis as { window?: any }).window = {
      requestAnimationFrame: raf.requestAnimationFrame,
      cancelAnimationFrame: raf.cancelAnimationFrame,
    };

    const probe = createMainThreadImpactProbe();
    const finished = probe.finish();
    timers.runAll();

    await expect(finished).resolves.toMatchObject({
      longTaskCount: undefined,
    });
  });

  test("opt-in extraction disposes probe when synchronous extraction throws", () => {
    const timers = installManualTimers();
    const raf = installManualRaf();
    const observer = installObserver();
    (globalThis as { window?: any }).window = {
      requestAnimationFrame: raf.requestAnimationFrame,
      cancelAnimationFrame: raf.cancelAnimationFrame,
      PerformanceObserver: observer.ctor,
    };

    expect(() =>
      extract_runtime_snapshot(throwingUi(), {
        measureMainThreadImpact: true,
      }),
    ).toThrow("boom");
    expect(timers.pending()).toHaveLength(0);
    expect(raf.cancelAnimationFrame).toHaveBeenCalledTimes(1);
    expect(observer.disconnect).toHaveBeenCalledTimes(1);
  });
});

function minimalUi() {
  return {
    pages: [],
    editor: {
      graph: {
        getSelectionCells: () => [],
        setSelectionCells: () => undefined,
        getModel: () => ({ getCell: () => undefined }),
      },
    },
  };
}

function throwingUi() {
  return {
    get pages(): unknown[] {
      throw new Error("boom");
    },
    editor: { graph: {} },
  };
}

function installManualTimers() {
  let nextId = 1;
  const pending = new Map<number, TimerCallback>();
  const clearTimeoutMock = jest.fn((id: number) => {
    pending.delete(id);
  });
  const setTimeoutMock = jest.fn((callback: TimerCallback) => {
    const id = nextId;
    nextId += 1;
    pending.set(id, callback);
    return id;
  });
  globalThis.setTimeout = setTimeoutMock as unknown as typeof setTimeout;
  globalThis.clearTimeout = clearTimeoutMock as unknown as typeof clearTimeout;
  return {
    pending: () => [...pending.keys()],
    runAll: () => {
      while (pending.size > 0) {
        const [id, callback] = pending.entries().next().value as [
          number,
          TimerCallback,
        ];
        pending.delete(id);
        callback();
      }
    },
    setTimeoutCalls: () => setTimeoutMock.mock.calls.length,
    clearTimeoutCalls: () => clearTimeoutMock.mock.calls.length,
  };
}

function installManualRaf() {
  let nextId = 1;
  const requestAnimationFrame = jest.fn(() => {
    const id = nextId;
    nextId += 1;
    return id;
  });
  const cancelAnimationFrame = jest.fn();
  return { requestAnimationFrame, cancelAnimationFrame };
}

function installObserver() {
  const disconnect = jest.fn();
  const observe = jest.fn();
  const ctor = jest.fn().mockImplementation(() => ({
    observe,
    disconnect,
  }));
  return { ctor, observe, disconnect };
}

function isPromise(value: unknown): value is Promise<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { then?: unknown }).then === "function"
  );
}
