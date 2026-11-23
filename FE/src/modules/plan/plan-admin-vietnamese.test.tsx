import { act } from 'react';
import userEvent from '@testing-library/user-event';
import { screen, waitFor, within } from '@testing-library/react';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_AVATAR } from '@/modules/avatar/types/avatar.types';
import { i18n } from '@/shared/i18n/i18n';
import { renderWithProviders } from '@/test/render-with-providers';
import { termDaysText } from './lib/term-progress';
import { AdminPlansPage } from './pages/AdminPlansPage';

const get = vi.fn();
const preview = vi.fn();
const save = vi.fn();
const listSubscriptions = vi.fn();
const usersOverTime = vi.fn();

vi.mock('./api/admin-plan.api', () => ({
  adminPlanApi: {
    get: () => get(),
    preview: (plans: unknown) => preview(plans),
    save: (plans: unknown) => save(plans),
    listSubscriptions: (params: unknown) => listSubscriptions(params),
    usersOverTime: (range: string, date: string) => usersOverTime(range, date),
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const plans = {
  free: { priceVnd: 0, maxPassages: 9, canCreateErrorPractice: false, canUsePublicPassages: false },
  premium: { priceVnd: 99000, maxPassages: 90, canCreateErrorPractice: true, canUsePublicPassages: true },
};

const row = (over: object = {}) => ({
  _id: 'r1',
  userName: 'An',
  email: 'an@example.com',
  avatarUrl: null,
  avatar: DEFAULT_AVATAR,
  plan: 'premium',
  source: 'admin',
  startsAt: '2026-01-15T00:00:00.000Z',
  endsAt: '2026-03-15T00:00:00.000Z',
  status: 'active',
  changedByName: 'Boss',
  createdAt: '2026-01-15T00:00:00.000Z',
  ...over,
});
const subscriptionPage = (items: object[]) => ({ items, page: 1, limit: 3, total: items.length, totalPages: items.length ? 1 : 0 });

const setNumber = async (user: ReturnType<typeof userEvent.setup>, label: string, value: string) => {
  const input = screen.getByLabelText(label);
  await user.clear(input);
  await user.type(input, value);
};

describe('the admin Plans page in Vietnamese (SCRUM-336)', () => {
  beforeEach(async () => {
    listSubscriptions.mockReset().mockResolvedValue(subscriptionPage([row()]));
    usersOverTime.mockReset().mockResolvedValue({ range: 'year', points: [{ key: '2026-01', free: 3, premium: 1 }] });
    get.mockReset().mockResolvedValue(plans);
    preview.mockReset().mockResolvedValue({ lockedUsers: 0, lockedPassages: 0 });
    save.mockReset().mockImplementation(async (value: unknown) => value);
    vi.mocked(toast.success).mockClear();
    await act(() => i18n.changeLanguage('vi'));
  });

  it('shows the chart and the plan cards in Vietnamese', async () => {
    renderWithProviders(<AdminPlansPage />, { route: '/admin/plans' });

    const free = await screen.findByRole('group', { name: 'Gói Free' });
    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual(['Gói đăng ký', 'Các gói']);
    expect(within(free).getByLabelText('Giới hạn đoạn văn (Free)')).toHaveValue(9);
    expect(screen.getByLabelText('Giá mỗi tháng (Premium)')).toHaveValue(99000);
    expect(screen.getAllByText('VND/tháng')).toHaveLength(2);
    expect(screen.getByRole('switch', { name: 'Tạo đoạn luyện lỗi (Premium)' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Cho phép đoạn văn premium (Free)' })).not.toBeChecked();
    expect(screen.getAllByRole('button', { name: 'Giải thích: Giới hạn đoạn văn' })).toHaveLength(2);
    expect(screen.getByRole('img', { name: 'Avatar của gói Premium' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lưu' })).toHaveAttribute('form', 'plans-form');
    expect(screen.getByRole('button', { name: 'Chuyển sang Danh sách gói đăng ký' })).toBeInTheDocument();
  });

  it('names the chart, its periods and its lines in Vietnamese', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminPlansPage />, { route: '/admin/plans' });

    expect(await screen.findByRole('img', { name: 'Người dùng mỗi gói theo tháng' })).toBeInTheDocument();
    const chart = within(screen.getByRole('region', { name: 'Người dùng theo gói' }));
    expect(chart.getByRole('button', { name: /^Tuần/ })).toBeInTheDocument();
    expect(chart.getByRole('button', { name: /^Tháng/ })).toBeInTheDocument();
    expect(chart.getByRole('button', { name: /^Năm/ })).toBeInTheDocument();
    const lines = chart.getByRole('button', { name: /^Đường/ });
    expect(lines).toHaveTextContent('Tất cả');

    await user.click(lines);
    expect(await screen.findByRole('menuitemradio', { name: 'Tất cả' })).toBeInTheDocument();
    await user.click(screen.getByRole('menuitemradio', { name: 'Premium' }));
    expect(lines).toHaveTextContent('Premium');
  });

  it('says what is wrong with a number in Vietnamese', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminPlansPage />, { route: '/admin/plans' });
    await screen.findByRole('group', { name: 'Gói Free' });

    await setNumber(user, 'Giới hạn đoạn văn (Free)', '-1');
    await setNumber(user, 'Giới hạn đoạn văn (Premium)', '1.5');
    await user.click(screen.getByRole('button', { name: 'Lưu' }));

    expect(await screen.findByText('Ít nhất là 0')).toBeInTheDocument();
    expect(screen.getByText('Hãy nhập số nguyên')).toBeInTheDocument();
    expect(preview).not.toHaveBeenCalled();
  });

  it('asks before locking passages and confirms the save in Vietnamese', async () => {
    const user = userEvent.setup();
    preview.mockResolvedValue({ lockedUsers: 3, lockedPassages: 1 });
    renderWithProviders(<AdminPlansPage />, { route: '/admin/plans' });
    await screen.findByRole('group', { name: 'Gói Free' });

    await setNumber(user, 'Giới hạn đoạn văn (Free)', '2');
    await user.click(screen.getByRole('button', { name: 'Lưu' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Lưu thay đổi?')).toBeInTheDocument();
    expect(within(dialog).getByText(/^3 người dùng sẽ bị khóa đoạn văn \(1 đoạn văn\)\. Không có gì bị xóa/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Hủy' })).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Đã lưu các gói.'));
  });

  it('shows the subscription list, its toolbar and its rows in Vietnamese', async () => {
    const user = userEvent.setup();
    listSubscriptions.mockResolvedValue(
      subscriptionPage([
        row(),
        row({ _id: 'r2', userName: 'Binh', plan: 'free', source: 'signup', endsAt: null, changedByName: null, status: 'upcoming' }),
        row({ _id: 'r3', userName: 'Chi', source: 'payment', status: 'cancelled', changedByName: null }),
        row({ _id: 'r4', userName: 'Dung', status: 'ended', changedByName: null }),
      ]),
    );
    renderWithProviders(<AdminPlansPage />, { route: '/admin/plans?show=list' });

    expect(await screen.findByText('Binh')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Danh sách gói đăng ký' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chuyển sang Các gói' })).toBeInTheDocument();
    const list = within(screen.getByRole('region', { name: 'Gói đăng ký' }));
    expect(list.getByRole('button', { name: 'Tìm người dùng' })).toBeInTheDocument();
    expect(list.getByText('Thay đổi')).toBeInTheDocument();
    expect(list.getAllByText('GÓI')).toHaveLength(4);
    expect(list.getAllByText('NGUỒN')).toHaveLength(4);
    expect(list.getAllByText('TRẠNG THÁI')).toHaveLength(4);
    expect(list.getAllByText('Không có')).toHaveLength(3);
    expect(list.getByText('Thanh toán')).toBeInTheDocument();
    expect(list.getByText('Đang hiệu lực')).toBeInTheDocument();
    expect(list.getByText('Sắp tới')).toBeInTheDocument();
    expect(list.getByText('Đã hủy')).toBeInTheDocument();
    expect(list.getByText('Đã kết thúc')).toBeInTheDocument();
    expect(list.getByText('bởi Boss')).toBeInTheDocument();
    expect(list.getByText('Hiện tại')).toBeInTheDocument();
    expect(list.getAllByRole('progressbar', { name: 'Tiến độ kỳ hạn' })).toHaveLength(4);
    expect(list.getByRole('img', { name: 'Avatar của An' })).toBeInTheDocument();

    await user.click(list.getByRole('button', { name: 'Sắp xếp' }));
    expect(await screen.findByRole('menuitemradio', { name: 'Hết hạn sớm nhất' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: 'Mới nhất' })).toBeInTheDocument();
    await user.keyboard('{Escape}');

    await user.click(list.getByRole('button', { name: 'Lọc' }));
    expect(await screen.findByRole('group', { name: 'Gói' })).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Nguồn' })).getByRole('menuitemradio', { name: 'Không có' })).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Trạng thái' })).getByRole('menuitemradio', { name: 'Đang hiệu lực' })).toBeInTheDocument();
    const by = within(screen.getByRole('group', { name: 'Thực hiện bởi' }));
    expect(by.getByRole('menuitemradio', { name: 'Quản trị viên' })).toBeInTheDocument();
    await user.click(by.getByRole('menuitemradio', { name: 'Hệ thống' }));
    await waitFor(() => expect(listSubscriptions).toHaveBeenLastCalledWith(expect.objectContaining({ by: 'system' })));
  });

  it('shows the empty list in Vietnamese', async () => {
    listSubscriptions.mockResolvedValue(subscriptionPage([]));
    renderWithProviders(<AdminPlansPage />, { route: '/admin/plans?show=list' });

    expect(await screen.findByText('Chưa có thay đổi gói nào')).toBeInTheDocument();
    expect(screen.getByText('Mỗi lần gói của người dùng thay đổi, thay đổi đó sẽ hiện ở đây.')).toBeInTheDocument();
  });

  it('says what is left of a term in Vietnamese', () => {
    const at = (iso: string) => new Date(iso).getTime();
    const start = '2026-01-01T00:00:00.000Z';
    const end = '2026-01-11T00:00:00.000Z';
    expect(termDaysText(start, end, at('2026-01-06T00:00:00Z'))).toBe('còn 5 ngày');
    expect(termDaysText(start, end, at('2025-12-30T00:00:00Z'))).toBe('Bắt đầu sau 2 ngày');
    expect(termDaysText(start, end, at('2026-02-01T00:00:00Z'))).toBe('Đã kết thúc');
    expect(termDaysText(start, null)).toBe('Không có ngày kết thúc');
  });
});
