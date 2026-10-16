import { act, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { currentUserKey } from '@/modules/auth/hooks/use-current-user';
import { tokenStore } from '@/modules/auth/store/token.store';
import { renderWithProviders } from '@/test/render-with-providers';
import { GuestRoute } from './GuestRoute';

const getMe = vi.fn();

vi.mock('@/modules/auth/api/auth.api', () => ({
  authApi: { getMe: () => getMe() },
}));

const renderAt = () =>
  renderWithProviders(<GuestRoute />, {
    route: '/login',
    otherRoutes: { '/': 'home page', '/admin': 'admin page' },
  });

beforeEach(() => {
  getMe.mockReset();
  tokenStore.clear();
});

describe('GuestRoute', () => {
  it('sends a signed-in user to the home page', async () => {
    tokenStore.set('jwt');
    getMe.mockResolvedValue({ role: 'user' });
    renderAt();
    expect(await screen.findByText('home page')).toBeInTheDocument();
  });

  it('sends a signed-in admin to the admin area', async () => {
    tokenStore.set('jwt');
    getMe.mockResolvedValue({ role: 'admin' });
    renderAt();
    expect(await screen.findByText('admin page')).toBeInTheDocument();
  });

  it('leaves a login made on the page alone: the login opens the next page itself', async () => {
    const { queryClient } = renderAt();

    // What useFinishLogin does before it navigates. A redirect from here would race its navigation, and win.
    await act(async () => {
      tokenStore.set('jwt-new');
      queryClient.setQueryData(currentUserKey, { role: 'user' });
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(screen.queryByText('home page')).not.toBeInTheDocument();
  });
});
