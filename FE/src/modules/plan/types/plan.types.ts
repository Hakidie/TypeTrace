import type { ChartRange } from '@/modules/profile/types/profile.types';
import type { AvatarLook } from '@/modules/avatar/types/avatar.types';

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

/** Where a term is now: not started, in effect, cancelled (also while it runs to its end) or over. */
export type SubscriptionStatus = 'upcoming' | 'active' | 'cancelled' | 'ended';

export type SubscriptionSource = 'signup' | 'payment' | 'admin' | 'auto' | 'migration';

/** One term of a plan of a user (`GET /api/admin/subscriptions`). The user is named, never identified by an id. */
export interface SubscriptionRow {
  _id: string;
  userName: string;
  /** The uploaded picture the user shows; `null` when they chose their pixel avatar or never set a picture. */
  /** Only admins read this list; `null` for an account that was deleted. */
  email: string | null;
  avatarUrl: string | null;
  avatar: AvatarLook;
  plan: PlanId;
  source: SubscriptionSource;
  startsAt: string;
  /** When the term stops: the end of a Premium term (or the day it was cut short), the day Premium replaced a Free row; `null` while a Free row is open. */
  endsAt: string | null;
  status: SubscriptionStatus;
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
  status?: SubscriptionStatus;
}

export interface SubscriptionPage {
  items: SubscriptionRow[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** How many users are on each plan at the end of a period (`GET /api/admin/plans/users-over-time`). `key` is 'YYYY-MM' (year), the first day of a block of 7 days (month) or a day (week), as in the Progress chart. */
export interface PlanUsersPoint {
  key: string;
  free: number;
  premium: number;
}

export interface PlanUsersChartData {
  range: ChartRange;
  points: PlanUsersPoint[];
}
