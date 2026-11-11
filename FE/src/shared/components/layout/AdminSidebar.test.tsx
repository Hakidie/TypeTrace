import userEvent from '@testing-library/user-event';
import { fireEvent, screen, within } from '@testing-library/react';
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

  it('shows only icons when compact, keeping the names for screen readers', () => {
    renderWithProviders(<AdminSidebar navItems={navItems} compact />, { route: '/admin', path: '/admin/*' });
    const link = screen.getByRole('link', { name: 'Users' });
    expect(link.querySelector('svg')).toHaveClass('size-5');
    // The tooltip must not spoil the classes of the link: centered icon, its own padding, a real class name (not code).
    expect(link).toHaveClass('justify-center', 'px-3', 'py-2');
    expect(link.className).not.toContain('=>');
    expect(screen.getByRole('link', { name: 'Back to app' })).toHaveClass('justify-center');
    expect(within(link).getByText('Users')).toHaveClass('sr-only');
    expect(screen.getByRole('button', { name: /logout/i })).toHaveClass('px-0');
  });

  it.each([
    ['link', 'Users'],
    ['link', 'Back to app'],
  ] as const)('opens a flyout with the icon and the name of the %s %s when it is hovered, compact', async (role, name) => {
    renderWithProviders(<AdminSidebar navItems={navItems} compact />, { route: '/admin', path: '/admin/*' });

    // The flyout is in the page for the eye only, beside the link, with its own copy of the icon; CSS shows it on hover.
    const flyout = screen.getByRole(role, { name }).parentElement!.querySelector('span[aria-hidden="true"]')!;
    expect(flyout).toHaveTextContent(name);
    expect(flyout.querySelector('svg')).toBeInTheDocument();
    expect(flyout).toHaveClass('group-hover/tab:flex', 'hidden');
    // The link keeps its name, so a screen reader reads it once.
    expect(screen.getAllByText(name, { exact: true })).toHaveLength(2);
  });

  it('keeps a tooltip for the logout button when compact', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminSidebar navItems={navItems} compact />, { route: '/admin', path: '/admin/*' });

    await user.hover(screen.getByRole('button', { name: 'Logout' }));

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Logout');
  });

  it('has no flyout when the sidebar shows its text', () => {
    renderSidebar('/admin');
    expect(screen.getByRole('link', { name: 'Users' }).parentElement!.querySelector('.group\\/tab')).toBeNull();
    expect(document.querySelector('.group\\/tab')).toBeNull();
  });

  it('has no tooltips when the sidebar shows its text', async () => {
    const user = userEvent.setup();
    renderSidebar('/admin');
    await user.hover(screen.getByRole('link', { name: 'Users' }));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows the logo, the signed-in admin, and logs out', async () => {
    renderSidebar('/admin');
    expect(screen.getByRole('link', { name: 'TypeTrace' })).toHaveAttribute('href', '/admin');
    expect(await screen.findByText('admin@example.com')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /logout/i }));
    expect(await screen.findByText('login page')).toBeInTheDocument();
  });
});
