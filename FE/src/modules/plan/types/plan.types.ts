export type PlanId = 'free' | 'premium';

/** The signed-in learner's plan (`GET /api/plan`): what it allows and how much of the passage limit is used. */
export interface PlanInfo {
  plan: PlanId;
  /** The day Premium ends; `null` on Free. */
  expiresAt: string | null;
  maxPassages: number;
  usedPassages: number;
  canUsePublicPassages: boolean;
  canCreateErrorPractice: boolean;
}

/** What one plan gives; the same fields as the backend's `PlanConfig` (`BE/src/models/app-setting.model.ts`). */
export interface PlanConfig {
  /** Price of one month, in VND. */
  priceVnd: number;
  /** How many passages of their own a learner on this plan may have. */
  maxPassages: number;
  canCreateErrorPractice: boolean;
  canUsePublicPassages: boolean;
}

/** Both plans, as the admin page reads and saves them. */
export interface PlansConfig {
  free: PlanConfig;
  premium: PlanConfig;
}

/** What saving `PlansConfig` would newly lock (`POST /api/admin/plans/preview`). */
export interface LockPreview {
  lockedUsers: number;
  lockedPassages: number;
}
