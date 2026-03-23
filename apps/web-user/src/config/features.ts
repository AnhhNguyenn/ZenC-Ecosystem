// V14 Architecture: Remote Feature Flag Configuration
// Enterprise rollout mechanism for toggling volatile UI sections without redeploys.

export const FEATURE_FLAGS = {
  voicePracticeEnabled: process.env.NEXT_PUBLIC_FF_VOICE === "true" || true,
  newDashboardLayout: process.env.NEXT_PUBLIC_FF_DASHBOARD === "true" || true,
  betaLessonEditor: false, // Hidden by default
} as const;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

export function useFeatureFlag(key: FeatureFlagKey): boolean {
  // In a real V14 production environment, this might sync with LaunchDarkly or GrowthBook.
  // For now, it returns the static env mappings.
  return FEATURE_FLAGS[key];
}
