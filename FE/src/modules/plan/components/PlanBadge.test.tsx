import userEvent from '@testing-library/user-event';
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render-with-providers';
import type { PlanInfo } from '../types/plan.types';
import { PlanBadge } from './PlanBadge';

const getPlan = vi.fn();

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
};

beforeEach(() => {
  getPlan.mockReset();
});

describe('PlanBadge', () => {
  it('shows the Free badge and opens the dialog with 8/9 passages and the permissions', async () => {
    getPlan.mockResolvedValue(free);
    renderWithProviders(<PlanBadge />);

    await userEvent.click(await screen.findByRole('button', { name: 'Free' }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Free plan')).toBeInTheDocument();
    expect(screen.getByText('8/9')).toBeInTheDocument();
    expect(screen.getByText(/Create error practice/).closest('li')).toHaveTextContent('No');
    expect(screen.getByText(/Practice public passages of other learners/).closest('li')).toHaveTextContent('No');
    expect(screen.queryByText(/Expires on/)).not.toBeInTheDocument();
  });

  it('shows Premium with its expiry date and the permissions it gives', async () => {
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

    expect(await screen.findByText('Premium plan')).toBeInTheDocument();
    expect(screen.getByText('Expires on 15/02/2026')).toBeInTheDocument();
    expect(screen.getByText('12/90')).toBeInTheDocument();
    expect(screen.getByText(/Create error practice/).closest('li')).toHaveTextContent('Yes');
    expect(screen.getByText(/Practice public passages of other learners/).closest('li')).toHaveTextContent('Yes');
  });

  it('shows an error state when the plan cannot be loaded', async () => {
    getPlan.mockRejectedValue(new Error('boom'));
    renderWithProviders(<PlanBadge />);

    await userEvent.click(await screen.findByRole('button', { name: 'Plan' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
