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
