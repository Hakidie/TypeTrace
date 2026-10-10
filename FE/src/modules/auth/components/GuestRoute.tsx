import { Navigate, Outlet } from 'react-router-dom';
import { LoadingState } from '@/shared/components/loading-state';
import { useCurrentUser } from '../hooks/use-current-user';
import { tokenStore } from '../store/token.store';
import { homePathFor } from '../utils/home-path';

/** Wraps the login / register pages: a signed-in user is sent to their own home page instead. */
export const GuestRoute = () => {
  const { data: user, isPending } = useCurrentUser();
  if (!tokenStore.get()) return <Outlet />;
  if (isPending) return <LoadingState />;
  if (user) return <Navigate to={homePathFor(user.role)} replace />;
  return <Outlet />;
};
