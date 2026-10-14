import { fireEvent, screen } from '@testing-library/react';
import { Home, Shield } from 'lucide-react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '@/modules/auth/store/token.store';
import { renderWithProviders } from '@/test/render-with-providers';
import { AppLayout } from './AppLayout';

const getMe = vi.fn();

vi.mock('@/modules/auth/api/auth.api', () => ({
  authApi: { getMe: () => getMe() },
}));

const navItems = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/admin', label: 'Admin', icon: Shield, roles: ['admin' as const] },
];

const renderLayout = () =>
  renderWithProviders(<AppLayout navItems={navItems} />, {
    route: '/',
    otherRoutes: { '/logout': 'logout route', '/login': 'login page' },
  });

beforeEach(() => {
  tokenStore.set('jwt-value');
  getMe.mockReset();
});

describe('AppLayout', () => {
  it('uses the TypeTrace header and footer', async () => {
    getMe.mockResolvedValue({ _id: '1', email: 'a@b.com', role: 'user' });
    renderLayout();

    expect(await screen.findByText('TypeTrace')).toBeInTheDocument();
    expect(screen.getByText(/All rights reserved/)).toBeInTheDocument();
    expect(screen.queryByText('MERN Auth')).not.toBeInTheDocument();
  });

  it('hides links meant for other roles', async () => {
    getMe.mockResolvedValue({ _id: '1', email: 'a@b.com', role: 'user' });
    renderLayout();

    // The avatar fallback shows the user's initials once the user has loaded.
    expect(await screen.findByText('A@')).toBeInTheDocument();
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
  });

  it('shows role links to users with that role', async () => {
    getMe.mockResolvedValue({ _id: '1', email: 'a@b.com', role: 'admin' });
    renderLayout();
    expect(await screen.findByText('Admin')).toBeInTheDocument();
  });

  it('keeps the user signed in when /me fails for a reason other than 401', async () => {
    getMe.mockRejectedValue({ response: { status: 503 } });
    renderLayout();

    expect(await screen.findByText('Home')).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText('logout route')).not.toBeInTheDocument();
    expect(tokenStore.get()).toBe('jwt-value');
  });

  it('renders the widgets registered by modules', async () => {
    getMe.mockResolvedValue({ _id: '1', email: 'a@b.com', role: 'user' });
    const FloatingThing = () => <div>floating widget</div>;
    renderWithProviders(<AppLayout navItems={navItems} widgets={[FloatingThing]} />, { route: '/' });
    expect(await screen.findByText('floating widget')).toBeInTheDocument();
  });

  it('logs out from the header button', async () => {
    getMe.mockResolvedValue({ _id: '1', email: 'a@b.com', role: 'user' });
    renderLayout();

    fireEvent.click(await screen.findByRole('button', { name: /logout/i }));

    expect(await screen.findByText('login page')).toBeInTheDocument();
    expect(tokenStore.get()).toBeNull();
  });
});
