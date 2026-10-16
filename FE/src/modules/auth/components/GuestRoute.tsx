import { useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { LoadingState } from '@/shared/components/loading-state';
import { useCurrentUser } from '../hooks/use-current-user';
import { tokenStore } from '../store/token.store';
import { homePathFor } from '../utils/home-path';

/**
 * Wraps the login / register pages: a user already signed in when the page opens is sent to their own home page.
 * A login made on the page stores a new token and is left alone: it opens the page that follows login itself
 * (`useFinishLogin`), and a second redirect from here would race that navigation and win.
 */
export const GuestRoute = () => {
  const [tokenOnOpen] = useState(() => tokenStore.get());
  const { data: user, isPending } = useCurrentUser();
  if (!tokenOnOpen || tokenStore.get() !== tokenOnOpen) return <Outlet />;
  if (isPending) return <LoadingState />;
  if (user) return <Navigate to={homePathFor(user.role)} replace />;
  return <Outlet />;
};
