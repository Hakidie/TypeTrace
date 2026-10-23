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
  // The review of learners' requests to make a passage public (SCRUM-176). One passage answers 409 if it is no longer
  // waiting; many at once answer how many changed.
  approve: (id: string) => http.patch<Passage>(`/admin/passages/${id}/approve`).then((r) => r.data),
  reject: (id: string, reason: string) => http.patch<Passage>(`/admin/passages/${id}/reject`, { reason }).then((r) => r.data),
  bulkApprove: (ids: string[]) =>
    http.post<{ updated: number }>('/admin/passages/bulk-approve', { ids }).then((r) => r.data),
  bulkReject: (ids: string[], reason: string) =>
    http.post<{ updated: number }>('/admin/passages/bulk-reject', { ids, reason }).then((r) => r.data),
};
