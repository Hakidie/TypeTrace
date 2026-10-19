import type { CurrentUser } from '@/modules/auth/types/auth.types';
import { http } from '@/shared/api/http';
import type { Paginated } from '@/shared/api/types';
import type { AdminStats, AdminUpdateUserInput, AdminUser, AdminUserListParams } from '../types/admin.types';

/** Drops empty values so the URL stays clean (`?role=` is never sent). */
const cleanParams = (params: object) =>
  Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''));

/** Every function resolves with the response body (not the Axios response). */
export const adminApi = {
  stats: () => http.get<AdminStats>('/admin/stats').then((r) => r.data),
  listUsers: (params: AdminUserListParams = {}) =>
    http.get<Paginated<AdminUser>>('/admin/users', { params: cleanParams(params) }).then((r) => r.data),
  updateUser: (id: string, input: AdminUpdateUserInput) =>
    http.patch<CurrentUser>(`/admin/users/${id}`, input).then((r) => r.data),
  deleteUser: (id: string) => http.delete(`/admin/users/${id}`).then(() => undefined),
  bulkDeleteUsers: (ids: string[]) =>
    http.post<{ deleted: number }>('/admin/users/bulk-delete', { ids }).then((r) => r.data),
};
