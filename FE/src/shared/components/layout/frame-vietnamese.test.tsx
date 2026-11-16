import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { Keyboard, Settings, Shirt, User } from 'lucide-react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '@/modules/auth/store/token.store';
import { GuestMenu } from '@/modules/auth/components/GuestMenu';
import { SettingsPage } from '@/modules/settings/pages/SettingsPage';
import { i18n, resources } from '@/shared/i18n/i18n';
import { renderWithProviders } from '@/test/render-with-providers';
import { BrandFooter } from './BrandFooter';
import { NavLinks } from './NavLinks';
import { UserMenu } from './UserMenu';

vi.mock('@/modules/auth/api/auth.api', () => ({ authApi: { getMe: vi.fn().mockResolvedValue({ _id: 'u1', email: 'a@b.c', role: 'user' }) } }));
vi.mock('@/modules/settings/api/themes.api', () => ({
  themesApi: {
    list: vi.fn().mockResolvedValue([]),
    getActive: vi.fn().mockResolvedValue({ dark: null, light: null }),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    updateActive: vi.fn(),
  },
}));

beforeEach(async () => {
  tokenStore.set('jwt-value');
  await act(() => i18n.changeLanguage('vi'));
});

const keysOf = (value: object, prefix = ''): string[] =>
  Object.entries(value).flatMap(([key, child]) =>
    typeof child === 'object' && child !== null ? keysOf(child, `${prefix}${key}.`) : [`${prefix}${key}`],
  );

describe('the frame and Settings in Vietnamese (SCRUM-328)', () => {
  it('has every English string translated, in every namespace', () => {
    for (const namespace of Object.keys(resources.en) as (keyof typeof resources.en)[]) {
      expect(keysOf(resources.vi[namespace]).sort()).toEqual(keysOf(resources.en[namespace]).sort());
    }
  });

  it('translates the footer and the navigation, keeping the English label of a link without a key', () => {
    renderWithProviders(
      <>
        <NavLinks
          items={[
            { to: '/typing', label: 'Typing', labelKey: 'nav.typing', icon: Keyboard, guest: true },
            { to: '/profile', label: 'Profile', labelKey: 'nav.profile', icon: User },
            { to: '/other', label: 'Other', icon: Settings },
          ]}
          guest
        />
        <BrandFooter />
      </>,
    );

    expect(screen.getByRole('link', { name: 'Gõ phím' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Hồ sơ/ })).toHaveTextContent('(đã khóa)');
    expect(screen.getByRole('link', { name: /Other/ })).toBeInTheDocument();
    expect(screen.getByText(/Bảo lưu mọi quyền/)).toBeInTheDocument();
  });

  it('translates the account menu and the guest menu', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <UserMenu user={{ _id: 'u1', email: 'a@b.c', role: 'admin' } as never} menuItems={[{ label: 'Settings', labelKey: 'menu.settings', icon: Shirt, to: '/settings', last: true }]} />,
    );
    await user.click(screen.getByRole('button', { name: 'Menu tài khoản' }));
    for (const name of ['Tủ đồ', 'Tối', 'Quản trị', 'Cài đặt', 'Đăng xuất']) {
      expect(await screen.findByRole('menuitem', { name })).toBeInTheDocument();
    }
  });

  it('translates the guest menu', async () => {
    tokenStore.clear();
    const user = userEvent.setup();
    renderWithProviders(<GuestMenu />);
    await user.click(screen.getByRole('button', { name: 'Menu khách' }));
    for (const name of ['Đăng nhập', 'Đăng ký', /Chế độ:/, 'Ngôn ngữ: Tiếng Việt']) {
      expect(await screen.findByRole('menuitem', { name })).toBeInTheDocument();
    }
  });

  it('translates the Settings tabs and the Appearance tab', async () => {
    renderWithProviders(<SettingsPage />, { route: '/settings?tab=appearance' });

    expect(await screen.findByRole('radiogroup', { name: 'Cài đặt' })).toBeInTheDocument();
    for (const name of ['Gõ phím', 'Giao diện', 'Ngôn ngữ', 'Tủ đồ', 'Bảo mật', 'Hướng dẫn']) {
      expect(screen.getByRole('radio', { name })).toBeInTheDocument();
    }
    expect((await screen.findAllByText('Chủ đề')).length).toBeGreaterThan(0);
  });
});
