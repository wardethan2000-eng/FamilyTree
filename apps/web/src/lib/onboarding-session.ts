const KEY = "tessera_onboarding";
const LEGACY_KEY_1 = "heirloom_onboarding";
const LEGACY_KEY_2 = "familytree_onboarding";

export type OnboardingSession = {
  treeId?: string;
  selfPersonId?: string;
  relativeAdded?: boolean;
  memoryAdded?: boolean;
};

export function readOnboardingSession(): OnboardingSession {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(KEY) ?? sessionStorage.getItem(LEGACY_KEY_1) ?? sessionStorage.getItem(LEGACY_KEY_2);
    if (!raw) return {};
    return JSON.parse(raw) as OnboardingSession;
  } catch {
    return {};
  }
}

export function writeOnboardingSession(patch: Partial<OnboardingSession>): void {
  if (typeof window === "undefined") return;
  const current = readOnboardingSession();
  sessionStorage.removeItem(LEGACY_KEY_1);
  sessionStorage.removeItem(LEGACY_KEY_2);
  sessionStorage.setItem(KEY, JSON.stringify({ ...current, ...patch }));
}

export function clearOnboardingSession(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(LEGACY_KEY_1);
  sessionStorage.removeItem(LEGACY_KEY_2);
  sessionStorage.removeItem(KEY);
}
