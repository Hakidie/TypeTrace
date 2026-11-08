import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { useDebounce } from '@/shared/hooks/use-debounce';
import { authApi } from '../api/auth.api';

const emailSchema = z.string().email();

/** Asks the server, once the learner stops typing a valid email, whether an account already uses it. */
export const useEmailExists = (email: string) => {
  const settled = useDebounce(email.trim(), 500);
  const valid = emailSchema.safeParse(settled).success;
  const query = useQuery({
    queryKey: ['auth', 'email-exists', settled],
    queryFn: () => authApi.emailExists(settled),
    enabled: valid,
    staleTime: 30_000,
  });
  return { exists: valid && settled === email.trim() && query.data?.exists === true, checking: valid && query.isFetching };
};
