// Dev-only in-page leak probe. Reports a small metrics snapshot to the dev server
// (/api/dev/leak-probe -> dev stdout) every 5s so an operator can see WHICH in-page
// structure grows before a renderer OOM that can't be reproduced synthetically.
// No-op in production and during SSR.

const ENABLED = process.env.NODE_ENV !== "production";

let renderCount = 0;
let maxDepthCount = 0;
let started = false;
let startedAt = 0;

// Mutated by OfficeScreen each render so the probe can report live structure sizes.
export const leakProbeState = {
  agents: 0,
  feedEvents: 0,
  logEntries: 0,
  cards: 0,
};

export const bumpOfficeRender = (): void => {
  if (ENABLED) renderCount += 1;
};

// Diagnostic: count how often each tracked value's REFERENCE changes between
// renders. Whichever counter climbs at the render rate is the loop's driver.
const refPrev = new Map<string, unknown>();
const refChangeCount: Record<string, number> = {};
export const recordRefChange = (name: string, value: unknown): void => {
  if (!ENABLED) return;
  if (refPrev.has(name) && refPrev.get(name) !== value) {
    refChangeCount[name] = (refChangeCount[name] ?? 0) + 1;
  }
  refPrev.set(name, value);
};

type MaybeMemory = {
  memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number };
};

export const startLeakProbe = (): (() => void) => {
  if (!ENABLED || started || typeof window === "undefined") {
    return () => {};
  }
  started = true;
  startedAt = Date.now();

  // Count tight-loop signatures without swallowing them.
  const originalError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    try {
      const text = args
        .map((a) => (typeof a === "string" ? a : a instanceof Error ? a.message : ""))
        .join(" ");
      if (/Maximum update depth|update depth exceeded/i.test(text)) {
        maxDepthCount += 1;
      }
    } catch {
      // ignore
    }
    return originalError(...(args as Parameters<typeof console.error>));
  };

  let lastRenders = 0;
  let lastMaxDepth = 0;
  const timer = window.setInterval(() => {
    const upSec = Math.round((Date.now() - startedAt) / 1000);
    const renders = renderCount - lastRenders;
    const maxDepth = maxDepthCount - lastMaxDepth;
    lastRenders = renderCount;
    lastMaxDepth = maxDepthCount;
    const mem = (performance as unknown as MaybeMemory).memory;
    const payload = {
      upSec,
      heapMB: mem ? Math.round(mem.usedJSHeapSize / 1e6) : null,
      heapLimitMB: mem ? Math.round(mem.jsHeapSizeLimit / 1e6) : null,
      rendersPer5s: renders,
      maxDepthPer5s: maxDepth,
      domNodes: document.getElementsByTagName("*").length,
      agents: leakProbeState.agents,
      feedEvents: leakProbeState.feedEvents,
      logEntries: leakProbeState.logEntries,
      cards: leakProbeState.cards,
      refChanges: { ...refChangeCount },
    };
    for (const key of Object.keys(refChangeCount)) refChangeCount[key] = 0;
    void fetch("/api/dev/leak-probe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  }, 5000);

  return () => {
    window.clearInterval(timer);
    console.error = originalError;
    started = false;
  };
};
