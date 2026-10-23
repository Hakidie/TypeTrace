import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { typingKeys } from '@/modules/typing/hooks/use-typing';
import { getApiErrorBody, getApiErrorMessage } from '@/shared/api/api-error';
import { learnerPassagesApi } from '../api/learner-passages.api';
import type { LearnerPassageListParams, OwnPassageInput } from '../types/passage.types';

/** Cache keys. Invalidating `learnerPassageKeys.all` refreshes every learner passage list and passage. */
export const learnerPassageKeys = {
  all: ['learner-passages'] as const,
  list: (params: LearnerPassageListParams) => [...learnerPassageKeys.all, 'list', params] as const,
  detail: (id: string) => [...learnerPassageKeys.all, 'detail', id] as const,
};

/** Keeps the previous page on screen while the next one loads. */
export const useLearnerPassages = (params: LearnerPassageListParams) =>
  useQuery({
    queryKey: learnerPassageKeys.list(params),
    queryFn: () => learnerPassagesApi.list(params),
    placeholderData: keepPreviousData,
  });

/** One of the learner's own passages with its text, to edit it; nothing is asked for without an `id`. */
export const useOwnPassage = (id?: string) =>
  useQuery({
    queryKey: learnerPassageKeys.detail(id ?? ''),
    queryFn: () => learnerPassagesApi.get(id!),
    enabled: Boolean(id),
  });

/** After a change, the lists here and the passage menu of the Typing page are asked for again. */
const useRefreshPassages = () => {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: learnerPassageKeys.all }),
      queryClient.invalidateQueries({ queryKey: typingKeys.all }),
    ]);
};

/**
 * The backend checks the text again after cleaning it, so it may still refuse it: its 400 lists the problem per field
 * ("At least 20 words"), which says more than its `Validation failed` message.
 */
const addErrorMessage = (error: unknown) =>
  getApiErrorBody(error)?.errors?.[0]?.message ?? getApiErrorMessage(error, 'Something went wrong');

export const useAddOwnPassage = () => {
  const refresh = useRefreshPassages();
  return useMutation({
    mutationFn: learnerPassagesApi.create,
    onSuccess: () => {
      toast.success('Passage added.');
      return refresh();
    },
    onError: (error) => toast.error(addErrorMessage(error)),
  });
};

/** Edits one of the learner's own private passages; checked again by the backend like a new one. */
export const useUpdateOwnPassage = () => {
  const refresh = useRefreshPassages();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: OwnPassageInput }) => learnerPassagesApi.update(id, input),
    onSuccess: (passage) => {
      // An edit of a public passage is not live yet: an admin reads it first.
      toast.success(passage.editPending ? 'Edit sent for review. The approved text stays public until then.' : 'Passage updated.');
      return refresh();
    },
    onError: (error) => toast.error(addErrorMessage(error)),
  });
};

// No `onError` below: the shared query client toasts the backend message (a 409 says why nothing changed).

export const useDeleteOwnPassage = () => {
  const refresh = useRefreshPassages();
  return useMutation({
    mutationFn: learnerPassagesApi.remove,
    onSuccess: () => {
      toast.success('Passage deleted.');
      return refresh();
    },
  });
};

/** Asks for an own private passage to become public (SCRUM-176). */
export const useRequestPublic = () => {
  const refresh = useRefreshPassages();
  return useMutation({
    mutationFn: learnerPassagesApi.requestPublic,
    onSuccess: () => {
      toast.success('Request sent: an admin will review it.');
      return refresh();
    },
  });
};

export const useWithdrawRequest = () => {
  const refresh = useRefreshPassages();
  return useMutation({
    mutationFn: learnerPassagesApi.withdrawRequest,
    onSuccess: () => {
      toast.success('Request withdrawn.');
      return refresh();
    },
  });
};
