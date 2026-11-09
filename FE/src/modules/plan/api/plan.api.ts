import { http } from '@/shared/api/http';
import type { PlanInfo } from '../types/plan.types';

export const planApi = {
  get: () => http.get<PlanInfo>('/plan').then((r) => r.data),
};
