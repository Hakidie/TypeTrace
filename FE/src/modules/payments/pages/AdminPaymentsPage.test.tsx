import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render-with-providers';
import { AdminPaymentsPage } from './AdminPaymentsPage';

const list = vi.fn();
const recheck = vi.fn();

vi.mock('../api/payments.api', () => ({
  adminPaymentsApi: { list: (params: unknown) => list(params), recheck: (id: string) => recheck(id) },
  paymentsApi: {},
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }));

const row = (over: object = {}) => ({
  _id: 'p1',
  userName: 'An',
  email: 'an@example.com',
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
});

describe('AdminPaymentsPage', () => {
  it('lists the payments with the buyer, gateway and state', async () => {
    list.mockResolvedValue(page([row(), row({ _id: 'p2', provider: 'vnpay', status: 'paid', granted: true, userName: 'Binh', email: 'binh@example.com' })]));
    renderWithProviders(<AdminPaymentsPage />);

    expect(await screen.findByText('an@example.com')).toBeInTheDocument();
    expect(screen.getByText('Binh')).toBeInTheDocument();
    expect(screen.getByText('payOS')).toBeInTheDocument();
    expect(screen.getByText('VNPay')).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument();
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
});
