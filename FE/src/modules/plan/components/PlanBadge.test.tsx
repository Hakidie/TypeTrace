import userEvent from '@testing-library/user-event';
import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render-with-providers';
import type { PlanInfo } from '../types/plan.types';
import { PlanBadge } from './PlanBadge';

const getPlan = vi.fn();

vi.mock('sonner', () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() } }));

vi.mock('../api/plan.api', () => ({
  planApi: { get: () => getPlan() },
}));
// The Store's prices, for the cheapest month of a long term under the Premium price.
vi.mock('@/modules/payments/api/payments.api', () => ({
  paymentsApi: {
    products: () =>
      Promise.resolve([
        { id: 'premium-1m', amount: 99_000, grant: { kind: 'premium', months: 1 } },
        { id: 'premium-12m', amount: 903_000, grant: { kind: 'premium', months: 12 } },
      ]),
  },
}));

const free: PlanInfo = {
  plan: 'free',
  expiresAt: null,
  maxPassages: 9,
  usedPassages: 8,
  canUsePublicPassages: false,
  canCreateErrorPractice: false,
  plans: {
    free: { priceVnd: 0, maxPassages: 9, canCreateErrorPractice: false, canUsePublicPassages: false },
    premium: { priceVnd: 99000, maxPassages: 90, canCreateErrorPractice: true, canUsePublicPassages: true },
  },
};

beforeEach(() => {
  getPlan.mockReset();
});

describe('PlanBadge', () => {
  it('shows the Free badge and opens the dialog with both plans: the Free one tagged as yours, Get Premium on Premium', async () => {
    getPlan.mockResolvedValue(free);
    renderWithProviders(<PlanBadge />);

    await userEvent.click(await screen.findByRole('button', { name: 'Free' }));

    const dialog = await screen.findByRole('dialog', { name: 'Plans' });
    // Focus goes to the dialog, so no tooltip opens by itself.
    expect(dialog).toHaveFocus();
    const freeCard = screen.getByRole('group', { name: 'Free plan' });
    const premiumCard = screen.getByRole('group', { name: 'Premium plan' });
    expect(within(freeCard).getByText('Your plan')).toBeInTheDocument();
    expect(within(premiumCard).queryByText('Your plan')).not.toBeInTheDocument();
    expect(within(premiumCard).getByText('99.000 ₫')).toBeInTheDocument();
    expect(await within(premiumCard).findByText('or 75.250 ₫ a month with 12 months')).toBeInTheDocument();
    expect(within(freeCard).queryByText(/a month with/)).not.toBeInTheDocument();
    // The learner's own plan shows what they use of its limit; the other one only its limit.
    expect(within(freeCard).getByText('8/9 used')).toBeInTheDocument();
    expect(within(premiumCard).queryByText(/used/)).not.toBeInTheDocument();
    // Perks are a list of included / not included, never switches that look editable.
    expect(within(freeCard).getByText('Train on your weak spots')).toHaveTextContent('(not included)');
    expect(within(premiumCard).getByText('Train on your weak spots')).toHaveTextContent('(included)');
    expect(within(premiumCard).getByText('The Dragon set for your avatar')).toHaveTextContent('(included)');
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    // Free is not sold: only Premium has a button.
    expect(within(freeCard).queryByRole('button', { name: /Premium|Owned/ })).not.toBeInTheDocument();
    expect(within(premiumCard).getByRole('button', { name: 'Get Premium' })).toHaveClass('w-full');
    // No dark screen over the page, and the dialog can still be closed.
    expect(document.querySelector('.bg-black\\/80')).toBeNull();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    // Each plan has a pixel avatar that illustrates it, under its name.
    expect(within(freeCard).getByRole('img', { name: 'Avatar of the Free plan' })).toBeInTheDocument();
    expect(within(premiumCard).getByRole('img', { name: 'Avatar of the Premium plan' })).toBeInTheDocument();
  });

  it('opens the Store when Get Premium is pressed', async () => {
    getPlan.mockResolvedValue(free);
    renderWithProviders(<PlanBadge />, { otherRoutes: { '/store': <p>Store page</p> } });
    await userEvent.click(await screen.findByRole('button', { name: 'Free' }));

    await userEvent.click(await screen.findByRole('button', { name: 'Get Premium' }));

    expect(await screen.findByText('Store page')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows Premium tagged as yours with Extend Premium, and no button on the Free card', async () => {
    getPlan.mockResolvedValue({
      ...free,
      plan: 'premium',
      expiresAt: '2026-02-15T00:00:00.000Z',
      maxPassages: 90,
      usedPassages: 12,
      canUsePublicPassages: true,
      canCreateErrorPractice: true,
    });
    renderWithProviders(<PlanBadge />);

    await userEvent.click(await screen.findByRole('button', { name: 'Premium' }));

    const premiumCard = await screen.findByRole('group', { name: 'Premium plan' });
    expect(within(premiumCard).getByText('Your plan')).toBeInTheDocument();
    expect(within(premiumCard).getByRole('button', { name: 'Extend Premium' })).toBeEnabled();
    expect(within(premiumCard).getByText('12/90 used')).toBeInTheDocument();
    const freeCard = screen.getByRole('group', { name: 'Free plan' });
    expect(within(freeCard).getByText('9')).toBeInTheDocument();
    expect(within(freeCard).queryByRole('button', { name: /Premium/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Get Premium' })).not.toBeInTheDocument();
  });

  it('shows an error state when the plan cannot be loaded', async () => {
    getPlan.mockRejectedValue(new Error('boom'));
    renderWithProviders(<PlanBadge />);

    await userEvent.click(await screen.findByRole('button', { name: 'Plan' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
