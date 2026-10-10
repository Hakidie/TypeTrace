import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { authApi } from '../api/auth.api';
import { tokenStore } from '../store/token.store';
import { homePathFor } from '../utils/home-path';
import { useSetCurrentUser } from './use-current-user';

/** Returns a function that stores the token, then opens the home page that belongs to the user's role. */
export const useFinishLogin = () => {
  const navigate = useNavigate();
  const setCurrentUser = useSetCurrentUser();

  return async (token: string) => {
    tokenStore.set(token);
    try {
      const user = await authApi.getMe();
      setCurrentUser(user);
      toast.success('Logged in successfully.');
      navigate(homePathFor(user.role), { replace: true });
    } catch (error) {
      tokenStore.clear();
      throw error;
    }
  };
};
