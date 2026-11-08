import { Navigate } from 'react-router-dom';
import { tokenStore } from '@/modules/auth/store/token.store';
import { GuestHomePage } from './GuestHomePage';

/** The home page (`/`): a signed-in user opens the typing page, a guest gets a typing test to try (nothing is saved). */
export const HomePage = () => (tokenStore.get() ? <Navigate to="/typing" replace /> : <GuestHomePage />);
