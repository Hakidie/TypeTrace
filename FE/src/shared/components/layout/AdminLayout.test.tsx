import { fireEvent, screen } from '@testing-library/react';
import { LayoutDashboard, Users } from 'lucide-react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '@/modules/auth/store/token.store';
import { renderWithProviders } from '@/test/render-with-providers';
import { AdminLayout } from './AdminLayout';

vi.mock('@/modules/auth/api/auth.api', () => ({
  authApi: { getMe: () => Promise.resolve({ _id: 'a1', email: 'admin@example.com', role: 'admin' }) },
}));

const navItems = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/users', label: 'Users', icon: Users },
];

const renderLayout = (route: string) =>
  renderWithProviders(<AdminLayout navItems={navItems} />, { route, path: '/admin/*', otherRoutes: { '/login': 'login page' } });

beforeEach(() => tokenStore.set('jwt-value'));

describe('AdminLayout', () => {
  it('highlights only the current section', () => {
    renderLayout('/admin/users');
    const nav = screen.getAllByRole('navigation', { name: 'Admin' })[0];
    expect(nav.querySelector('a[aria-current="page"]')).toHaveTextContent('Users');
  });

  it('shows the title of the current page in the header', () => {
    renderLayout('/admin/users');
    expect(screen.getByRole('heading', { level: 1, name: 'Users' })).toBeInTheDocument();
  });

  it('opens and closes the menu on small screens', () => {
    renderLayout('/admin');
    expect(screen.getAllByRole('navigation', { name: 'Admin' })).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.getAllByRole('navigation', { name: 'Admin' })).toHaveLength(2);

    fireEvent.click(screen.getAllByRole('button', { name: 'Close menu' })[0]);
    expect(screen.getAllByRole('navigation', { name: 'Admin' })).toHaveLength(1);
  });

  it('links back to the app and logs out', async () => {
    renderLayout('/admin');
    expect(screen.getAllByRole('link', { name: 'Back to app' })[0]).toHaveAttribute('href', '/');

    fireEvent.click(screen.getByRole('button', { name: /logout/i }));
    expect(await screen.findByText('login page')).toBeInTheDocument();
  });
});
