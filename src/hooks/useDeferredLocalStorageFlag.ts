import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

/**
 * SSR-safe boolean flag backed by `localStorage`.
 *
 * The value initializes to `initialValue` for the server render and the first client
 * render, then the persisted value is read AFTER mount. Reading during render (e.g. via a
 * lazy `useState` initializer) would diverge from the server-rendered HTML and cause a
 * hydration mismatch, so the deferred read is deliberate. This hook centralizes the
 * resulting `react-hooks/set-state-in-effect` suppression in one place instead of
 * scattering inline disables across components.
 *
 * Pass `null` as `initialValue` when the caller must distinguish "not read yet" from
 * `false` (e.g. to avoid a first-paint flash); the value becomes a definite boolean after
 * mount. On read failure (localStorage unavailable, e.g. private mode) the flag resolves
 * to `false` — i.e. "not set". Writes are the caller's responsibility, since persistence
 * semantics vary (some flags clear the key, others store `"false"`).
 *
 * A value is considered set only when the stored string is exactly `"true"`, matching the
 * `String(boolean)` / `"true"` conventions used by existing Claw3D flags.
 */
export function useDeferredLocalStorageFlag<T extends boolean | null = boolean>(
  storageKey: string,
  initialValue: T = false as T,
): [boolean | T, Dispatch<SetStateAction<boolean | T>>] {
  const [value, setValue] = useState<boolean | T>(initialValue);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(storageKey);
    } catch {
      // localStorage unavailable (private mode, etc.) — treat as "not set".
      stored = null;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValue(stored === "true");
  }, [storageKey]);

  return [value, setValue];
}
