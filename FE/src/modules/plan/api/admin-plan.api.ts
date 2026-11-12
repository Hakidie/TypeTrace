import { http } from '@/shared/api/http';
import type { ChartRange } from '@/modules/profile/types/profile.types';
import type { LockPreview, PlansConfig, PlanUsersChartData, SubscriptionListParams, SubscriptionPage } from '../types/plan.types';

/** The admin side of the plans (`/api/admin/plans`, US11.1). */
export const adminPlanApi = {
  get: () => http.get<PlansConfig>('/admin/plans').then((r) => r.data),
  /** How many users and passages saving these plans would newly lock; saves nothing. */
  preview: (plans: PlansConfig) => http.post<LockPreview>('/admin/plans/preview', plans).then((r) => r.data),
  /** One page of the plan changes of all users. */
  listSubscriptions: (params: SubscriptionListParams) => http.get<SubscriptionPage>('/admin/subscriptions', { params }).then((r) => r.data),
  /** The users on each plan over a year, a month or a week (the one that holds `date`). */
  usersOverTime: (range: ChartRange, date: string) =>
    http.get<PlanUsersChartData>('/admin/plans/users-over-time', { params: { range, date } }).then((r) => r.data),
  save: (plans: PlansConfig) => http.put<PlansConfig>('/admin/plans', plans).then((r) => r.data),
};
