import userEvent from '@testing-library/user-event';
import { screen, within } from '@testing-library/react';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render-with-providers';
import type { PlanInfo } from '../types/plan.types';
import { PlanBadge } from './PlanBadge';

const getPlan = vi.fn();

vi.mock('sonner', () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() } }));

vi.mock('../api/plan.api', () => ({
  planApi: { get: () => getPlan() },
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
  it('shows the Free badge and opens the dialog with both plans, the Free one outlined and Owned, and Buy now on Premium', async () => {
    getPlan.mockResolvedValue(free);
    renderWithProviders(<PlanBadge />);

    await userEvent.click(await screen.findByRole('button', { name: 'Free' }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    const freeCard = screen.getByRole('group', { name: 'Free plan' });
    const premiumCard = screen.getByRole('group', { name: 'Premium plan' });
    expect(freeCard).toHaveClass('border-primary');
    expect(premiumCard).not.toHaveClass('border-primary');
    expect(within(premiumCard).getByText('99,000')).toBeInTheDocument();
    // The learner's own plan shows what they use of its limit; the other one only its limit.
    expect(within(freeCard).getByText('8/9')).toBeInTheDocument();
    expect(within(premiumCard).getByText('90')).toBeInTheDocument();
    expect(within(freeCard).getByRole('switch', { name: 'Generate practice passage (Free)' })).not.toBeChecked();
    expect(within(premiumCard).getByRole('switch', { name: 'Allow premium passage (Premium)' })).toBeChecked();
    expect(within(freeCard).getByRole('switch', { name: 'Generate practice passage (Free)' })).toBeDisabled();
    expect(within(freeCard).getByRole('button', { name: 'Owned' })).toBeDisabled();
    expect(within(premiumCard).getByRole('button', { name: 'Buy now' })).toBeEnabled();
    expect(within(premiumCard).getByRole('button', { name: 'Buy now' })).toHaveClass('w-full');
    expect(screen.queryByText(/You are on/)).not.toBeInTheDocument();
    // No dark screen over the page, and the dialog can still be closed.
    expect(document.querySelector('.bg-black\\/80')).toBeNull();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    // Each plan has a pixel avatar that illustrates it, under its name.
    expect(within(freeCard).getByRole('img', { name: 'Avatar of the Free plan' })).toBeInTheDocument();
    expect(within(premiumCard).getByRole('img', { name: 'Avatar of the Premium plan' })).toBeInTheDocument();
  });

  it('says payment is not available yet when Buy now is pressed', async () => {
    getPlan.mockResolvedValue(free);
    renderWithProviders(<PlanBadge />);
    await userEvent.click(await screen.findByRole('button', { name: 'Free' }));

    await userEvent.click(await screen.findByRole('button', { name: 'Buy now' }));

    expect(toast.info).toHaveBeenCalledWith('Payment is not available yet.');
  });

  it('shows Premium with its card outlined and Owned, and no button on the Free card', async () => {
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
    expect(premiumCard).toHaveClass('border-primary');
    expect(within(premiumCard).getByRole('button', { name: 'Owned' })).toBeDisabled();
    expect(within(premiumCard).getByText('12/90')).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Free plan' })).getByText('9')).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Free plan' })).queryByRole('button', { name: /Owned|Buy now/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Buy now' })).not.toBeInTheDocument();
  });

  it('shows an error state when the plan cannot be loaded', async () => {
    getPlan.mockRejectedValue(new Error('boom'));
    renderWithProviders(<PlanBadge />);

    await userEvent.click(await screen.findByRole('button', { name: 'Plan' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
