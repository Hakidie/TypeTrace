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

export type SubscriptionSource = 'signup' | 'payment' | 'admin' | 'auto' | 'migration';

/** One plan change of a user (`GET /api/admin/subscriptions`). The user is named, never identified by an id. */
export interface SubscriptionRow {
  _id: string;
  userName: string;
  plan: PlanId;
  source: SubscriptionSource;
  startsAt: string;
  /** Premium rows only. */
  expiresAt: string | null;
  /** The admin who made the change; `null` when the system did. */
  changedByName: string | null;
  createdAt: string;
}

export interface SubscriptionListParams {
  page: number;
  limit: number;
  sort: string;
  q?: string;
  plan?: PlanId;
  /** `none`: not paid for (VNPay, MoMo... come with the payments). */
  method?: 'none';
  by?: 'admin' | 'system';
}

export interface SubscriptionPage {
  items: SubscriptionRow[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
