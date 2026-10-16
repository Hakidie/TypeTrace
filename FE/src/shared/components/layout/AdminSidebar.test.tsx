import { fireEvent, screen } from '@testing-library/react';
import { LayoutDashboard, Users } from 'lucide-react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '@/modules/auth/store/token.store';
import { renderWithProviders } from '@/test/render-with-providers';
import { AdminSidebar } from './AdminSidebar';

vi.mock('@/modules/auth/api/auth.api', () => ({
  authApi: { getMe: () => Promise.resolve({ _id: 'a1', email: 'admin@example.com', role: 'admin' }) },
}));

const navItems = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/users', label: 'Users', icon: Users },
];

const renderSidebar = (route: string, onNavigate?: () => void) =>
  renderWithProviders(<AdminSidebar navItems={navItems} onNavigate={onNavigate} />, { route, path: '/admin/*', otherRoutes: { '/login': 'login page' } });

beforeEach(() => tokenStore.set('jwt-value'));

describe('AdminSidebar', () => {
  it('highlights only the current page', () => {
    renderSidebar('/admin/users');
    expect(screen.getByRole('link', { name: 'Users' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
  });

  it('links back to the app and reports clicks', () => {
    const onNavigate = vi.fn();
    renderSidebar('/admin', onNavigate);
    expect(screen.getByRole('link', { name: 'Back to app' })).toHaveAttribute('href', '/');
    fireEvent.click(screen.getByRole('link', { name: 'Users' }));
    expect(onNavigate).toHaveBeenCalled();
  });

  it('shows the logo, the signed-in admin, and logs out', async () => {
    renderSidebar('/admin');
    expect(screen.getByRole('link', { name: 'TypeTrace' })).toHaveAttribute('href', '/admin');
    expect(await screen.findByText('admin@example.com')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /logout/i }));
    expect(await screen.findByText('login page')).toBeInTheDocument();
  });
});
