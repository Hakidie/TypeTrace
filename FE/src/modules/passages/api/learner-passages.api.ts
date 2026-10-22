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
};
