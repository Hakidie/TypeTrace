import { http } from '@/shared/api/http';
import type { Paginated } from '@/shared/api/types';
import type { LearnerPassage, LearnerPassageListParams, OwnPassageInput } from '../types/passage.types';

/** The learner side of the passages (`/api/passages`); the admin side is `passages.api.ts`. Every function resolves with the response body. */
export const learnerPassagesApi = {
  /** The published practice passages: TypeTrace's and the learner's own. */
  list: (params: LearnerPassageListParams = {}) =>
    http.get<Paginated<LearnerPassage>>('/passages', { params }).then((r) => r.data),
  /** Adds one of the learner's own passages: private, and ready to type at once. */
  create: (input: OwnPassageInput) => http.post<LearnerPassage>('/passages', input).then((r) => r.data),
  /** Deletes one of the learner's own passages. */
  remove: (id: string) => http.delete(`/passages/${id}`).then(() => undefined),
  /** Asks for one of the learner's private passages to become public: an admin reviews it (SCRUM-176). */
  requestPublic: (id: string) => http.post<LearnerPassage>(`/passages/${id}/publish-request`).then((r) => r.data),
  /** Takes the request back while it still waits for review. */
  withdrawRequest: (id: string) => http.delete<LearnerPassage>(`/passages/${id}/publish-request`).then((r) => r.data),
};
