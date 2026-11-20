import { act } from 'react';
import userEvent from '@testing-library/user-event';
import { screen, waitFor, within } from '@testing-library/react';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_AVATAR } from '@/modules/avatar/types/avatar.types';
import { i18n } from '@/shared/i18n/i18n';
import { renderWithProviders } from '@/test/render-with-providers';
import { AdminPaymentsPage } from './pages/AdminPaymentsPage';

const list = vi.fn();
const recheck = vi.fn();
const revenue = vi.fn();

vi.mock('./api/payments.api', () => ({
  adminPaymentsApi: { list: (params: unknown) => list(params), recheck: (id: string) => recheck(id), revenue: (range: string, date: string) => revenue(range, date) },
  paymentsApi: { products: () => Promise.resolve([{ id: 'coins-500', amount: 20000, grant: { kind: 'coins', coins: 500 } }, { id: 'premium-6m', amount: 100000, grant: { kind: 'premium', months: 6 } }]) },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }));

const row = (over: object = {}) => ({
  _id: 'p1',
  userName: 'An',
  email: 'an@example.com',
  avatarUrl: null,
  avatar: DEFAULT_AVATAR,
  product: 'coins-500',
  amount: 20000,
  provider: 'payos',
  status: 'pending',
  granted: false,
  paidAt: null,
  createdAt: '2026-11-14T03:00:00.000Z',
  ...over,
});
const page = (items: object[]) => ({ items, page: 1, limit: 3, total: items.length, totalPages: items.length ? 1 : 0 });

describe('the admin Payments page in Vietnamese (SCRUM-336)', () => {
  beforeEach(async () => {
    list.mockReset();
    recheck.mockReset();
    revenue.mockReset().mockResolvedValue({ range: 'year', points: [{ key: '2026-11', payos: 70000, vnpay: 0, momo: 0 }] });
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.message).mockClear();
    await act(() => i18n.changeLanguage('vi'));
  });

  it('names the revenue chart, its periods and its gateways in Vietnamese', async () => {
    const user = userEvent.setup();
    list.mockResolvedValue(page([row()]));
    renderWithProviders(<AdminPaymentsPage />);

    expect(await screen.findByRole('img', { name: 'Doanh thu của từng cổng theo tháng' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual(['Doanh thu', 'Danh sách thanh toán']);
    const chart = within(screen.getByRole('region', { name: 'Doanh thu theo cổng' }));
    expect(chart.getByRole('button', { name: /^Tuần/ })).toBeInTheDocument();
    expect(chart.getByRole('button', { name: /^Tháng/ })).toBeInTheDocument();
    expect(chart.getByRole('button', { name: /^Năm/ })).toBeInTheDocument();
    const gateway = chart.getByRole('button', { name: /^Cổng/ });
    expect(gateway).toHaveTextContent('Tất cả');

    await user.click(gateway);
    await user.click(await screen.findByRole('menuitemradio', { name: 'MoMo' }));
    expect(gateway).toHaveTextContent('MoMo');
  });

  it('shows the payment rows, their statuses and the access in Vietnamese', async () => {
    list.mockResolvedValue(
      page([
        row(),
        row({ _id: 'p2', product: 'premium-6m', provider: 'vnpay', status: 'paid', granted: true, userName: 'Binh', email: 'binh@example.com' }),
        row({ _id: 'p3', provider: 'momo', status: 'paid', granted: false, userName: 'Chi' }),
        row({ _id: 'p4', provider: 'vnpay', status: 'failed', userName: 'Dung' }),
      ]),
    );
    renderWithProviders(<AdminPaymentsPage />);

    const cards = within(await screen.findByLabelText('Thẻ thanh toán'));
    expect(await cards.findByText('Binh')).toBeInTheDocument();
    expect(cards.getByText('Đang chờ')).toBeInTheDocument();
    expect(cards.getAllByText('Đã thanh toán')).toHaveLength(2);
    expect(cards.getByText('Thất bại')).toBeInTheDocument();
    expect(cards.getAllByText('Đã cấp: Không')).toHaveLength(2);
    expect(cards.getByText('Đã cấp: Có')).toBeInTheDocument();
    expect(cards.getByText('Đã cấp: Chưa')).toBeInTheDocument();
    expect(cards.getAllByText('500 xu').length).toBeGreaterThan(0);
    expect(cards.getByText('Premium 6 tháng')).toBeInTheDocument();
    expect(cards.getByRole('img', { name: 'Avatar của Binh' })).toBeInTheDocument();
    expect(screen.getByText('Thanh toán')).toBeInTheDocument();
  });

  it('names the toolbar, its sorts and its filters in Vietnamese', async () => {
    const user = userEvent.setup();
    list.mockResolvedValue(page([row()]));
    renderWithProviders(<AdminPaymentsPage />);
    await screen.findByText('an@example.com');

    expect(screen.getByRole('button', { name: 'Tìm người dùng' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sắp xếp' }));
    expect(await screen.findByRole('menuitemradio', { name: 'Số tiền cao nhất' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: 'Cũ nhất' })).toBeInTheDocument();
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: 'Lọc' }));
    const status = within(await screen.findByRole('group', { name: 'Trạng thái' }));
    expect(status.getByRole('menuitemradio', { name: 'Đang chờ' })).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Cổng' })).getByRole('menuitemradio', { name: 'payOS' })).toBeInTheDocument();
    await user.click(status.getByRole('menuitemradio', { name: 'Thất bại' }));
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'failed' })));
  });

  it('checks an open payOS payment again and says what payOS answered in Vietnamese', async () => {
    const user = userEvent.setup();
    list.mockResolvedValue(page([row()]));
    recheck.mockResolvedValue(row({ status: 'paid', granted: false }));
    renderWithProviders(<AdminPaymentsPage />);

    await user.click(await screen.findByRole('button', { name: 'Kiểm tra lại với payOS' }));
    await waitFor(() => expect(recheck).toHaveBeenCalledWith('p1'));
    await waitFor(() => expect(toast.message).toHaveBeenCalledWith('Đã thanh toán, nhưng chưa cấp.'));
  });

  it('shows the empty list in Vietnamese', async () => {
    list.mockResolvedValue(page([]));
    renderWithProviders(<AdminPaymentsPage />);

    expect(await screen.findByText('Chưa có thanh toán nào')).toBeInTheDocument();
    expect(screen.getByText('Mọi lần thử thanh toán đều hiện ở đây.')).toBeInTheDocument();
  });
});
