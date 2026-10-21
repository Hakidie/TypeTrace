import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Home, Shield } from 'lucide-react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '@/modules/auth/store/token.store';
import { renderWithProviders } from '@/test/render-with-providers';
import { AppLayout } from './AppLayout';

const getMe = vi.fn();
const getActive = vi.fn();
const updateActive = vi.fn();

vi.mock('@/modules/auth/api/auth.api', () => ({
  authApi: { getMe: () => getMe() },
}));

vi.mock('@/modules/settings/api/themes.api', () => ({
  themesApi: { getActive: () => getActive(), updateActive: (input: unknown) => updateActive(input) },
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
  getActive.mockReset();
  updateActive.mockReset();
  getActive.mockResolvedValue({ mode: 'dark', dark: null, light: null });
  updateActive.mockResolvedValue({ mode: 'light', dark: null, light: null });
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

  it('opens the account menu from the avatar button with Mode and Logout', async () => {
    getMe.mockResolvedValue({ _id: '1', email: 'a@b.com', role: 'user' });
    renderLayout();
    await screen.findByText('A@');
    expect(screen.queryByRole('menuitem', { name: /logout/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));

    expect(screen.getByRole('menuitem', { name: /Mode:/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /logout/i })).toBeInTheDocument();
  });

  it('switches the mode from the account menu and saves it', async () => {
    getActive.mockResolvedValue({ mode: 'light', dark: null, light: null });
    // Like the server: the next read answers with the saved mode.
    updateActive.mockImplementation(async ({ mode }: { mode: string }) => {
      getActive.mockResolvedValue({ mode, dark: null, light: null });
      return { mode, dark: null, light: null };
    });
    getMe.mockResolvedValue({ _id: '1', email: 'a@b.com', role: 'user' });
    renderLayout();
    fireEvent.click(await screen.findByRole('button', { name: 'Account menu' }));

    fireEvent.click(await screen.findByRole('menuitem', { name: 'Mode: Light' }));

    await waitFor(() => expect(updateActive).toHaveBeenCalledWith({ mode: 'dark' }));
    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    expect(await screen.findByRole('menuitem', { name: 'Mode: Dark' })).toBeInTheDocument();
    expect(document.documentElement).toHaveClass('dark');
  });

  it('logs out from the account menu', async () => {
    getMe.mockResolvedValue({ _id: '1', email: 'a@b.com', role: 'user' });
    renderLayout();

    fireEvent.click(await screen.findByRole('button', { name: 'Account menu' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /logout/i }));

    expect(await screen.findByText('login page')).toBeInTheDocument();
    expect(tokenStore.get()).toBeNull();
  });
});
