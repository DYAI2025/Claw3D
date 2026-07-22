/**
 * useOnboardingState — Tracks whether onboarding has been completed.
 *
 * Uses localStorage so the wizard only shows once per browser.
 * The key is scoped to the Claw3D app to avoid collisions.
 */
import { useCallback } from "react";

import { useDeferredLocalStorageFlag } from "@/hooks/useDeferredLocalStorageFlag";

const STORAGE_KEY = "claw3d:onboarding:completed";

const writeCompleted = (value: boolean): void => {
  if (typeof window === "undefined") return;
  try {
    if (value) {
      window.localStorage.setItem(STORAGE_KEY, "true");
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Storage might be unavailable in some environments.
  }
};

export type OnboardingStateReturn = {
  /** Whether the wizard should be shown. */
  showOnboarding: boolean;
  /** Mark onboarding as complete (hides the wizard). */
  completeOnboarding: () => void;
  /** Reset onboarding (shows the wizard again). */
  resetOnboarding: () => void;
};

export const useOnboardingState = (): OnboardingStateReturn => {
  // `null` sentinel keeps the wizard hidden until localStorage has actually been read
  // after mount, avoiding a first-paint flash for returning users. See the hook for the
  // SSR/hydration rationale behind the deferred read.
  const [completed, setCompleted] = useDeferredLocalStorageFlag<boolean | null>(
    STORAGE_KEY,
    null,
  );

  const completeOnboarding = useCallback(() => {
    setCompleted(true);
    writeCompleted(true);
  }, [setCompleted]);

  const resetOnboarding = useCallback(() => {
    setCompleted(false);
    writeCompleted(false);
  }, [setCompleted]);

  return {
    showOnboarding: completed === false,
    completeOnboarding,
    resetOnboarding,
  };
};
