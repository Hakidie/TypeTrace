import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { i18n } from '@/shared/i18n/i18n';
import { passagesApi } from '../api/passages.api';
import type { PassageInput, PassageListParams, PassageStatus, ReviewDecision } from '../types/passage.types';
import { learnerPassageKeys } from './use-learner-passages';

/** Cache keys. Invalidating `passageKeys.all` refreshes every passages query. */
export const passageKeys = {
  all: ['passages'] as const,
  list: (params: PassageListParams) => [...passageKeys.all, 'list', params] as const,
};

/** Keeps the previous page on screen while the next one loads. */
export const usePassages = (params: PassageListParams) =>
  useQuery({
    queryKey: passageKeys.list(params),
    queryFn: () => passagesApi.list(params),
    placeholderData: keepPreviousData,
  });

/** How often the review queue asks again while an admin has it open: learners send requests at any time (SCRUM-176). */
export const REVIEW_QUEUE_REFRESH_MS = 60_000;

/**
 * The learners' requests waiting for review (`status: 'pending'`), kept up to date while the page is open: asked again
 * every `REVIEW_QUEUE_REFRESH_MS` (not while the browser tab is hidden) and when the admin comes back to the tab.
 */
export const usePendingPassages = (params: Omit<PassageListParams, 'status'> = {}) => {
  const pending = { ...params, status: 'pending' as const };
  return useQuery({
    queryKey: passageKeys.list(pending),
    queryFn: () => passagesApi.list(pending),
    placeholderData: keepPreviousData,
    refetchInterval: REVIEW_QUEUE_REFRESH_MS,
    refetchOnWindowFocus: true,
  });
};

// Mutations: no `onError` — the shared query client toasts the backend message. The success toasts are the admin
// Passages page's words (`passages:admin.toast`, SCRUM-336), read when they show.

export const useCreatePassage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: passagesApi.create,
    onSuccess: () => {
      toast.success(i18n.t('passages:admin.toast.created'));
      return queryClient.invalidateQueries({ queryKey: passageKeys.all });
    },
  });
};

export const useUpdatePassage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: PassageInput }) => passagesApi.update(id, input),
    onSuccess: () => {
      toast.success(i18n.t('passages:admin.toast.updated'));
      return queryClient.invalidateQueries({ queryKey: passageKeys.all });
    },
  });
};

export const useSetPassageStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: PassageStatus }) => passagesApi.setStatus(id, status),
    onSuccess: (passage) => {
      toast.success(i18n.t(`passages:admin.toast.status.${passage.status}`));
      return queryClient.invalidateQueries({ queryKey: passageKeys.all });
    },
  });
};

export const useDeletePassage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: passagesApi.remove,
    onSuccess: () => {
      toast.success(i18n.t('passages:admin.toast.deleted'));
      return queryClient.invalidateQueries({ queryKey: passageKeys.all });
    },
  });
};

interface ReviewInput {
  ids: string[];
  decision: ReviewDecision;
  /** Needed to turn requests down: the learners see it. */
  reason?: string;
}

/** Sends a decision on one request (its own endpoint) or many (the bulk one); resolves with how many passages changed. */
const review = async ({ ids, decision, reason = '' }: ReviewInput) => {
  if (ids.length === 1) {
    await (decision === 'approve' ? passagesApi.approve(ids[0]) : passagesApi.reject(ids[0], reason));
    return 1;
  }
  const { updated } = await (decision === 'approve' ? passagesApi.bulkApprove(ids) : passagesApi.bulkReject(ids, reason));
  return updated;
};

/**
 * Approves or turns down learners' requests to make a passage public (SCRUM-176). Another admin may have decided first
 * (or the learner withdrew or deleted the request): one passage then answers 409 or 404 (toasted), many at once say how
 * many were still waiting.
 */
export const useReviewPassages = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: review,
    onSuccess: (updated, { ids, decision }) => {
      const approved = decision === 'approve';
      if (ids.length === 1) toast.success(i18n.t(approved ? 'passages:admin.toast.approvedOne' : 'passages:admin.toast.rejectedOne'));
      else if (updated === ids.length)
        toast.success(i18n.t(approved ? 'passages:admin.toast.approvedAll' : 'passages:admin.toast.rejectedAll', { count: updated }));
      else
        toast.success(
          i18n.t(approved ? 'passages:admin.toast.approvedSome' : 'passages:admin.toast.rejectedSome', { updated, count: ids.length }),
        );
    },
    // After a failure too: a 409 or 404 means the queue changed, so the request it was about must leave the screen.
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: passageKeys.all }),
        queryClient.invalidateQueries({ queryKey: learnerPassageKeys.all }),
      ]),
  });
};
