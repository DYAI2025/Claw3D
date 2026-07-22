import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

const ensureLocalStorage = () => {
  if (typeof window === "undefined") return;
  const existing = window.localStorage as unknown as Record<string, unknown> | undefined;
  if (
    existing &&
    typeof existing.getItem === "function" &&
    typeof existing.setItem === "function" &&
    typeof existing.removeItem === "function" &&
    typeof existing.clear === "function"
  ) {
    return;
  }

  const store = new Map<string, string>();
  const storage = {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(String(key)) ? store.get(String(key)) ?? null : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(String(key));
    },
    setItem(key: string, value: string) {
      store.set(String(key), String(value));
    },
  };

  Object.defineProperty(window, "localStorage", {
    value: storage,
    configurable: true,
  });
};

ensureLocalStorage();

// Unmount React trees rendered by @testing-library/react after every test. Without
// this, a component left mounted by one test (e.g. one that fires an unawaited async
// handler with a pending timer) can re-render and mutate shared module-level state
// after a later test has started, causing order-dependent flakiness. cleanup() is
// idempotent, so files that already call it themselves are unaffected.
afterEach(() => {
  cleanup();
});
