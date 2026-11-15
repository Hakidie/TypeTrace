import { screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { render } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '@/modules/auth/store/token.store';
import { createTestQueryClient } from '@/test/render-with-providers';
import App from './App';

// The pages are heavy and call APIs: the test only looks at which page the router opens for a guest.
vi.mock('@/shared/api/http', () => ({ http: { get: vi.fn().mockResolvedValue({ data: {} }), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock('@/modules/typing/pages/TypingPage', () => ({ TypingPage: () => <div>signed-in typing page</div> }));
vi.mock('@/modules/typing/pages/GuestTypingPage', () => ({ GuestTypingPage: () => <div>guest typing page</div> }));
vi.mock('@/modules/ranked/pages/LeaderboardPage', () => ({ LeaderboardPage: () => <div>leaderboard page</div> }));
vi.mock('@/modules/profile/pages/ProfilePage', () => ({ ProfilePage: () => <div>profile page</div> }));
vi.mock('@/modules/auth/pages/LoginPage', () => ({ LoginPage: () => <div>login page</div> }));
vi.mock('@/modules/auth/components/AuthBrandPanel', () => ({ AuthBrandPanel: () => null }));

const renderAt = (route: string) =>
  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter initialEntries={[route]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => tokenStore.clear());

describe('App routes for a guest (SCRUM-251)', () => {
  it('opens /typing and /leaderboard without a sign-in, in the main layout with the guest menu', async () => {
    renderAt('/typing');
    expect(await screen.findByText('guest typing page')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guest menu' })).toBeInTheDocument();
  });

  it('opens the leaderboard too', async () => {
    renderAt('/leaderboard');
    expect(await screen.findByText('leaderboard page')).toBeInTheDocument();
  });

  it('sends a guest from the other pages to the login page', async () => {
    renderAt('/profile');
    expect(await screen.findByText('login page')).toBeInTheDocument();
  });

  it('gives a signed-in learner the usual Typing page', async () => {
    tokenStore.set('jwt-value');
    renderAt('/typing');
    expect(await screen.findByText('signed-in typing page')).toBeInTheDocument();
  });
});
