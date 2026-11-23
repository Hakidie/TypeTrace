import { act } from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import { LayoutDashboard, Users } from 'lucide-react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminNavItems } from '@/app/modules';
import { tokenStore } from '@/modules/auth/store/token.store';
import { i18n } from '@/shared/i18n/i18n';
import { renderWithProviders } from '@/test/render-with-providers';
import { AdminLayout } from './AdminLayout';

const getMe = vi.fn();
vi.mock('@/modules/auth/api/auth.api', () => ({
  authApi: { getMe: () => getMe() },
}));

const navItems = [
  { to: '/admin', label: 'Dashboard', labelKey: 'admin.pages.dashboard', icon: LayoutDashboard },
  { to: '/admin/users', label: 'Users', labelKey: 'admin.pages.users', icon: Users },
];

const renderLayout = (route: string) => renderWithProviders(<AdminLayout navItems={navItems} />, { route, path: '/admin/*' });

beforeEach(() => {
  localStorage.clear();
  tokenStore.set('jwt-value');
  getMe.mockReset().mockResolvedValue({ _id: 'a1', email: 'admin@example.com', role: 'admin' });
});

describe('the admin frame in Vietnamese (SCRUM-336)', () => {
  it('names the pages, the way back, Logout and the menu button in Vietnamese, and the page in the header', async () => {
    await act(() => i18n.changeLanguage('vi'));
    renderLayout('/admin/users');

    const nav = screen.getAllByRole('navigation', { name: 'Quản trị' })[0];
    expect(within(nav).getByRole('link', { name: 'Tổng quan' })).toBeInTheDocument();
    expect(nav.querySelector('a[aria-current="page"]')).toHaveTextContent('Người dùng');
    expect(within(nav).getByRole('link', { name: 'Về ứng dụng' })).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: 'Đăng xuất' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Người dùng' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mở menu' })).toBeInTheDocument();
  });

  it("shows the language the admin chose on their account, as the learner's pages do, though the admin area has no widgets", async () => {
    getMe.mockResolvedValue({ _id: 'a1', email: 'admin@example.com', role: 'admin', settings: { uiLanguage: 'vi' } });
    renderLayout('/admin/users');
    expect(screen.getByRole('heading', { level: 1, name: 'Users' })).toBeInTheDocument();

    await waitFor(() => expect(getMe).toHaveBeenCalled());
    await waitFor(() => expect(i18n.language).toBe('vi'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Người dùng' })).toBeInTheDocument();
  });

  it('gives every page of the admin sidebar a name in both languages', () => {
    expect(adminNavItems.length).toBeGreaterThan(0);
    for (const item of adminNavItems) {
      expect(item.labelKey, item.to).toMatch(/^admin\.pages\./);
      expect(i18n.t(item.labelKey!, { lng: 'en' }), item.to).toBe(item.label);
      expect(i18n.t(item.labelKey!, { lng: 'vi' }), item.to).not.toBe(item.label);
    }
  });
});
