import { http } from '@/shared/api/http';
import type { Paginated } from '@/shared/api/types';
import type { Passage, PassageInput, PassageStatus, PassageListParams } from '../types/passage.types';

/** Every function resolves with the response body (not the Axios response). */
export const passagesApi = {
  list: (params: PassageListParams = {}) => http.get<Paginated<Passage>>('/admin/passages', { params }).then((r) => r.data),
  create: (input: PassageInput) => http.post<Passage>('/admin/passages', input).then((r) => r.data),
  update: (id: string, input: PassageInput) => http.patch<Passage>(`/admin/passages/${id}`, input).then((r) => r.data),
  setStatus: (id: string, status: PassageStatus) =>
    http.patch<Passage>(`/admin/passages/${id}/status`, { status }).then((r) => r.data),
};
