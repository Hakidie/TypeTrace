import { tokenStore } from '@/modules/auth/store/token.store';
import { GuestTypingPage } from './GuestTypingPage';
import { TypingPage } from './TypingPage';

/** `/typing`: the Typing page for a signed-in learner, a guest gets the same page without an account (SCRUM-251; nothing is saved). */
export const TypingRoute = () => (tokenStore.get() ? <TypingPage /> : <GuestTypingPage />);
