import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { typingApi } from '../api/typing.api';

/** Cache keys. Invalidating `typingKeys.all` refreshes every typing query. */
export const typingKeys = {
  all: ['typing'] as const,
  detail: (id: string) => [...typingKeys.all, 'session', id] as const,
};

export const useSession = (id: string) =>
  useQuery({ queryKey: typingKeys.detail(id), queryFn: () => typingApi.get(id) });

// Mutations: no `onError` — the shared query client toasts the backend message.

/** Starts a session; the server abandons the one still in progress. */
export const useStartSession = () => useMutation({ mutationFn: typingApi.start });

/** Tells the server the first key was pressed. */
export const useBeginSession = () => useMutation({ mutationFn: typingApi.begin });

export const useCompleteSession = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, typedWords }: { id: string; typedWords: string[] }) => typingApi.complete(id, typedWords),
    // The result page opens next: put the graded session in the cache so it does not need another request.
    onSuccess: (session) => queryClient.setQueryData(typingKeys.detail(session._id), session),
  });
};
