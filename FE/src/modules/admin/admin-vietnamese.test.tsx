import { act } from 'react';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '@/modules/auth/store/token.store';
import { i18n } from '@/shared/i18n/i18n';
import { renderWithProviders } from '@/test/render-with-providers';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { AdminThemesPage } from './pages/AdminThemesPage';
import { AdminUsersPage } from './pages/AdminUsersPage';

const listUsers = vi.fn();
const updateUser = vi.fn();
const listThemes = vi.fn();

vi.mock('./api/admin.api', () => ({
  adminApi: {
    stats: () => Promise.resolve({ users: 12, admins: 1, verified: 10, notes: 3, newUsersThisWeek: 4 }),
    listUsers: (params: unknown) => listUsers(params),
    updateUser: (id: string, input: unknown) => updateUser(id, input),
    listThemes: (params: unknown) => listThemes(params),
  },
}));

vi.mock('@/modules/plan/api/admin-plan.api', () => ({
  adminPlanApi: {
    usersOverTime: () => Promise.resolve({ range: 'year', points: [{ key: '2026-10', premium: 2, free: 4 }] }),
  },
}));

vi.mock('@/modules/auth/api/auth.api', () => ({
  authApi: { getMe: () => Promise.resolve(admin) },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const user = (id: string, email: string, extra = {}) => ({
  _id: id,
  email,
  displayName: email.split('@')[0],
  role: 'user',
  isEmailVerified: true,
  loginOtpEnabled: false,
  status: 'active',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  ...extra,
});

const admin = user('a1', 'admin@example.com', { role: 'admin' });
const lan = user('u1', 'lan@example.com', { plan: 'premium', planExpiresAt: '2026-12-05T00:00:00.000Z' });
const minh = user('u2', 'minh@example.com', { isEmailVerified: false, plan: 'free' });

const page = (items: unknown[], limit = 3) => ({ items, page: 1, limit, total: items.length, totalPages: 1 });

beforeEach(async () => {
  tokenStore.set('jwt-value');
  listUsers.mockReset().mockResolvedValue(page([admin, lan, minh]));
  updateUser.mockReset().mockImplementation((id: string, input: object) => Promise.resolve({ ...lan, _id: id, ...input }));
  listThemes.mockReset().mockResolvedValue(page([], 15));
  vi.mocked(toast.success).mockClear();
  await act(() => i18n.changeLanguage('vi'));
});

describe('the admin pages of the admin module in Vietnamese (SCRUM-336)', () => {
  it('says the dashboard in Vietnamese: the numbers, the newest users and their table', async () => {
    renderWithProviders(<AdminDashboardPage />, { route: '/admin', path: '/admin' });

    expect(screen.getByText('Tổng quan về ứng dụng.')).toBeInTheDocument();
    expect(await screen.findByText('4 người mới trong tuần')).toBeInTheDocument();
    expect(screen.getByText('Email đã xác minh')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Xem tất cả' })).toBeInTheDocument();
    const table = await screen.findByRole('table', { name: 'Người dùng mới nhất' });
    expect(within(table).getByRole('columnheader', { name: /Vai trò/ })).toBeInTheDocument();
    expect(await within(table).findAllByText('Quản trị viên')).not.toHaveLength(0);
    expect(within(table).getByText('Chưa xác minh')).toBeInTheDocument();
  });

  it('says the user list in Vietnamese: the toolbar, the tags of a card, its menu and the delete question', async () => {
    renderWithProviders(<AdminUsersPage />, { route: '/admin/users', path: '/admin/users' });

    expect(screen.getByRole('heading', { name: 'Danh sách người dùng' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tổng số người dùng' })).toBeInTheDocument();
    const cards = await screen.findByLabelText('Thẻ người dùng');
    expect(within(cards).getAllByText('Hoạt động')).toHaveLength(3);
    expect(within(cards).getByText('Chưa xác minh')).toBeInTheDocument();
    // The day Premium ends, the month in Vietnamese.
    expect(within(cards).getByText('Premium · 05 Thg 12 2026')).toBeInTheDocument();

    fireEvent.contextMenu(within(cards).getByRole('group', { name: 'Thao tác cho minh@example.com' }));
    const menu = await screen.findByRole('menu');
    for (const entry of ['Sửa', 'Khóa', 'Tặng Premium', 'Xóa']) expect(within(menu).getByRole('menuitem', { name: entry })).toBeInTheDocument();
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Xóa' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Xóa người dùng này?')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Xóa' })).toBeInTheDocument();
  });

  it('says the edit form in Vietnamese, with its check, and the toast of the update', async () => {
    const actor = userEvent.setup();
    renderWithProviders(<AdminUsersPage />, { route: '/admin/users', path: '/admin/users' });
    const cards = await screen.findByLabelText('Thẻ người dùng');
    fireEvent.contextMenu(within(cards).getByRole('group', { name: 'Thao tác cho lan@example.com' }));
    fireEvent.click(within(await screen.findByRole('menu')).getByRole('menuitem', { name: 'Sửa' }));

    const name = await screen.findByRole('textbox', { name: 'Tên hiển thị' });
    expect(screen.getByRole('switch', { name: 'Mã email khi đăng nhập' })).toHaveTextContent('Không cần mã email');
    expect(screen.getByText('Tham gia 01 Thg 10 2026')).toBeInTheDocument();
    await actor.clear(name);
    await actor.click(screen.getByRole('button', { name: 'Cập nhật người dùng' }));
    expect(await screen.findByText('Cần nhập tên')).toBeInTheDocument();

    await actor.type(name, 'Lan');
    await actor.click(screen.getByRole('button', { name: 'Cập nhật người dùng' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Đã cập nhật người dùng.'));
  });

  it('says the themes page in Vietnamese', async () => {
    renderWithProviders(<AdminThemesPage />, { route: '/admin/themes', path: '/admin/themes' });

    expect(screen.getByRole('heading', { name: 'Chủ đề' })).toBeInTheDocument();
    expect(await screen.findByText('Chưa có chủ đề')).toBeInTheDocument();
    expect(screen.getByText('Tạo chủ đề TypeTrace đầu tiên ở trên.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chế độ: Tối' })).toBeInTheDocument();
  });
});
