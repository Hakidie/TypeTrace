import userEvent from '@testing-library/user-event';
import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_AVATAR } from '@/modules/avatar/types/avatar.types';
import { renderWithProviders } from '@/test/render-with-providers';
import { AdminPaymentsPage } from './AdminPaymentsPage';

const list = vi.fn();
const recheck = vi.fn();
const revenue = vi.fn();

vi.mock('../api/payments.api', () => ({
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
const page = (items: object[]) => ({ items, page: 1, limit: 5, total: items.length, totalPages: items.length ? 1 : 0 });

beforeEach(() => {
  list.mockReset();
  recheck.mockReset();
  revenue.mockReset();
  revenue.mockResolvedValue({ range: 'year', points: [{ key: '2026-11', payos: 70000, vnpay: 0, momo: 0 }] });
});

describe('AdminPaymentsPage', () => {
  it('lists the payments with the buyer, gateway and state', async () => {
    list.mockResolvedValue(page([row(), row({ _id: 'p2', product: 'premium-6m', provider: 'vnpay', status: 'paid', granted: true, userName: 'Binh', email: 'binh@example.com' })]));
    renderWithProviders(<AdminPaymentsPage />);

    expect(await screen.findByText('an@example.com')).toBeInTheDocument();
    expect(screen.getByText('Binh')).toBeInTheDocument();
    expect(screen.getByText('payOS')).toBeInTheDocument();
    expect(screen.getByText('VNPay')).toBeInTheDocument();
    expect(screen.getByText('Access: Yes')).toBeInTheDocument();
    expect(screen.getByText('Access: No')).toBeInTheDocument();
    expect(screen.getAllByText('500 coins').length).toBeGreaterThan(0);
    expect(screen.getByText('Premium-6M')).toBeInTheDocument();
    expect(screen.getAllByText(/^\d{2}:\d{2} UTC$/).length).toBeGreaterThan(0);
    expect(screen.getByRole('img', { name: 'Avatar of Binh' })).toBeInTheDocument();
  });

  it('offers a new check only for an open payOS payment, and sends it', async () => {
    const user = userEvent.setup();
    list.mockResolvedValue(page([row(), row({ _id: 'p2', provider: 'vnpay', userName: 'Binh' }), row({ _id: 'p3', status: 'paid', granted: true, userName: 'Chi' })]));
    recheck.mockResolvedValue(row({ status: 'paid', granted: true }));
    renderWithProviders(<AdminPaymentsPage />);

    const buttons = await screen.findAllByRole('button', { name: 'Check again with payOS' });
    expect(buttons).toHaveLength(1);
    await user.click(buttons[0]);

    await waitFor(() => expect(recheck).toHaveBeenCalledWith('p1'));
  });

  it('shows the empty and the error state', async () => {
    list.mockResolvedValue(page([]));
    renderWithProviders(<AdminPaymentsPage />);
    expect(await screen.findByText('No payments yet')).toBeInTheDocument();
  });

  it('shows an error with a retry', async () => {
    list.mockRejectedValue(new Error('boom'));
    renderWithProviders(<AdminPaymentsPage />);
    expect(await screen.findByRole('button', { name: /retry|try again/i })).toBeInTheDocument();
  });

  it('shows the revenue chart of the gateways, for the year of today at first, and asks again when the range changes', async () => {
    const user = userEvent.setup();
    list.mockResolvedValue(page([row()]));
    renderWithProviders(<AdminPaymentsPage />);

    expect(await screen.findByRole('img', { name: 'Money taken by each gateway by month' })).toBeInTheDocument();
    expect(revenue).toHaveBeenCalledWith('year', expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));

    const chart = within(screen.getByRole('region', { name: 'Revenue by gateway' }));
    await user.click(chart.getByRole('button', { name: /^Month/ }));
    await user.click((await screen.findAllByRole('menuitemradio'))[0]);
    await waitFor(() => expect(revenue).toHaveBeenLastCalledWith('month', expect.any(String)));
  });

  it('picks which gateway the revenue chart draws', async () => {
    const user = userEvent.setup();
    list.mockResolvedValue(page([row()]));
    renderWithProviders(<AdminPaymentsPage />);
    await screen.findByRole('img', { name: 'Money taken by each gateway by month' });

    const chart = within(screen.getByRole('region', { name: 'Revenue by gateway' }));
    expect(chart.getByRole('button', { name: /^Gateway/ })).toHaveTextContent('All');
    await user.click(chart.getByRole('button', { name: /^Gateway/ }));
    await user.click(await screen.findByRole('menuitemradio', { name: 'MoMo' }));
    expect(chart.getByRole('button', { name: /^Gateway/ })).toHaveTextContent('MoMo');
  });

  it('shows 3 payments a page, and 10 after Expand', async () => {
    const user = userEvent.setup();
    list.mockResolvedValue({ ...page([row(), row({ _id: 'p2' }), row({ _id: 'p3' })]), total: 12, totalPages: 4 });
    renderWithProviders(<AdminPaymentsPage />);

    await screen.findAllByText('an@example.com');
    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 3 }));

    await user.click(screen.getByRole('button', { name: 'Expand' }));
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 10, page: 1 })));
    expect(screen.getByRole('button', { name: 'Collapse' })).toBeInTheDocument();
  });

  it('has no Expand button when 3 payments or fewer exist', async () => {
    list.mockResolvedValue(page([row()]));
    renderWithProviders(<AdminPaymentsPage />);

    await screen.findByText('an@example.com');
    expect(screen.queryByRole('button', { name: 'Expand' })).not.toBeInTheDocument();
  });
});
