import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render-with-providers';
import { PaymentHistoryPage } from './PaymentHistoryPage';

const mine = vi.fn();
const products = vi.fn();
vi.mock('../api/payments.api', () => ({
  paymentsApi: { mine: (page: number, limit: number) => mine(page, limit), products: () => products() },
}));

const row = (over: object = {}) => ({ _id: 'p1', product: 'premium-6m', amount: 505000, provider: 'payos', status: 'paid', paidAt: '2026-11-14T03:00:00.000Z', createdAt: '2026-11-14T03:00:00.000Z', ...over });
const page = (items: object[], extra: object = {}) => ({ items, page: 1, limit: 6, total: items.length, totalPages: items.length ? 1 : 0, ...extra });

beforeEach(() => {
  mine.mockReset();
  products.mockReset().mockResolvedValue([
    { id: 'premium-6m', amount: 505000, grant: { kind: 'premium', months: 6 } },
    { id: 'coins-1400', amount: 50000, grant: { kind: 'coins', coins: 1400 } },
  ]);
});

describe('PaymentHistoryPage', () => {
  it('lists the learner\'s payments with what they bought, the gateway and the state', async () => {
    mine.mockResolvedValue(page([row(), row({ _id: 'p2', product: 'coins-1400', provider: 'vnpay', status: 'expired' }), row({ _id: 'p3', status: 'failed', provider: 'momo' })]));
    renderWithProviders(<PaymentHistoryPage />, { route: '/store/history' });

    expect(await screen.findAllByText('Premium 6 months')).toHaveLength(2);
    expect(screen.getByText('1.400 coins')).toBeInTheDocument();
    expect(screen.getByText('payOS')).toBeInTheDocument();
    expect(screen.getByText('Paid')).toBeInTheDocument();
    expect(screen.getByText('Expired')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Switch to Store' })).toBeInTheDocument();
  });

  it('shows the empty state', async () => {
    mine.mockResolvedValue(page([]));
    renderWithProviders(<PaymentHistoryPage />, { route: '/store/history' });
    expect(await screen.findByText('No payments yet')).toBeInTheDocument();
  });

  it('shows the error with a retry', async () => {
    mine.mockRejectedValueOnce(new Error('boom')).mockResolvedValue(page([row()]));
    renderWithProviders(<PaymentHistoryPage />, { route: '/store/history' });
    fireEvent.click(await screen.findByRole('button', { name: /retry|try again/i }));
    expect(await screen.findByText('Premium 6 months')).toBeInTheDocument();
  });

  it('asks for the next page', async () => {
    mine.mockResolvedValue(page([row()], { totalPages: 2 }));
    renderWithProviders(<PaymentHistoryPage />, { route: '/store/history' });
    await screen.findByText('Premium 6 months');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await vi.waitFor(() => expect(mine).toHaveBeenCalledWith(2, 6));
  });
});
