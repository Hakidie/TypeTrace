import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { authApi } from '../api/auth.api';
import { tokenStore } from '../store/token.store';
import { afterLoginPathFor, type AfterLoginState } from '../utils/home-path';
import { useSetCurrentUser } from './use-current-user';

/**
 * Returns a function that stores the token, then opens the page that follows login for the user's role. `newAccount`:
 * the account was just created, so the typing page asks the new learner to take the placement test (`AfterLoginState`).
 */
export const useFinishLogin = () => {
  const navigate = useNavigate();
  const setCurrentUser = useSetCurrentUser();

  return async (token: string, { newAccount = false }: { newAccount?: boolean } = {}) => {
    tokenStore.set(token);
    try {
      const user = await authApi.getMe();
      setCurrentUser(user);
      toast.success('Logged in successfully.');
      const state: AfterLoginState | undefined = newAccount ? { newAccount: true } : undefined;
      navigate(afterLoginPathFor(user.role), { replace: true, state });
    } catch (error) {
      tokenStore.clear();
      throw error;
    }
  };
};
