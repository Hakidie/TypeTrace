import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { passagesApi } from '../api/passages.api';
import type { PassageInput, PassageListParams, PassageStatus } from '../types/passage.types';

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

// Mutations: no `onError` — the shared query client toasts the backend message.

export const useCreatePassage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: passagesApi.create,
    onSuccess: () => {
      toast.success('Passage created as a draft.');
      return queryClient.invalidateQueries({ queryKey: passageKeys.all });
    },
  });
};

export const useUpdatePassage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: PassageInput }) => passagesApi.update(id, input),
    onSuccess: () => {
      toast.success('Passage updated.');
      return queryClient.invalidateQueries({ queryKey: passageKeys.all });
    },
  });
};

export const useSetPassageStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: PassageStatus }) => passagesApi.setStatus(id, status),
    onSuccess: (passage) => {
      toast.success(`Passage ${passage.status}.`);
      return queryClient.invalidateQueries({ queryKey: passageKeys.all });
    },
  });
};
