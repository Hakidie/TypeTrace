import { http } from '@/shared/api/http';
import type { LockPreview, PlansConfig } from '../types/plan.types';

/** The admin side of the plans (`/api/admin/plans`, US11.1). */
export const adminPlanApi = {
  get: () => http.get<PlansConfig>('/admin/plans').then((r) => r.data),
  /** How many users and passages saving these plans would newly lock; saves nothing. */
  preview: (plans: PlansConfig) => http.post<LockPreview>('/admin/plans/preview', plans).then((r) => r.data),
  save: (plans: PlansConfig) => http.put<PlansConfig>('/admin/plans', plans).then((r) => r.data),
};
