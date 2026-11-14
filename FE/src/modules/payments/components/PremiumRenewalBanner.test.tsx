import { fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render-with-providers';
import { PremiumRenewalBanner } from './PremiumRenewalBanner';

const NOW = new Date('2026-11-14T10:00:00.000Z');
const DAY = 86_400_000;
const user = vi.fn();
vi.mock('@/modules/auth/hooks/use-current-user', () => ({ useCurrentUser: () => ({ data: user() }) }));

const premiumUntil = (days: number) => ({ premium: { active: true, until: new Date(NOW.getTime() + days * DAY).toISOString() } });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  localStorage.clear();
  user.mockReset();
});
afterEach(() => vi.useRealTimers());

describe('PremiumRenewalBanner', () => {
  it('asks whether to extend when Premium ends in 3 days or fewer, and opens the Store', () => {
    user.mockReturnValue(premiumUntil(3));
    renderWithProviders(<PremiumRenewalBanner />, { route: '/typing' });

    expect(screen.getByText(/Your Premium ends in 3 days/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Extend Premium' })).toHaveAttribute('href', '/store');
  });

  it('says nothing with more than 3 days left, on Free, with no account yet, or inside the Store', () => {
    for (const value of [premiumUntil(4), { premium: { active: false, until: null } }, { premium: undefined }, undefined]) {
      user.mockReturnValue(value);
      const { unmount } = renderWithProviders(<PremiumRenewalBanner />, { route: '/typing' });
      expect(screen.queryByRole('region', { name: 'Premium ends soon' })).not.toBeInTheDocument();
      unmount();
    }
    user.mockReturnValue(premiumUntil(1));
    renderWithProviders(<PremiumRenewalBanner />, { route: '/store' });
    expect(screen.queryByRole('region', { name: 'Premium ends soon' })).not.toBeInTheDocument();
  });

  it('stays closed after "Not now" for the same end date, and comes back for another one', () => {
    user.mockReturnValue(premiumUntil(2));
    const first = renderWithProviders(<PremiumRenewalBanner />, { route: '/typing' });
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.queryByRole('region', { name: 'Premium ends soon' })).not.toBeInTheDocument();
    first.unmount();

    renderWithProviders(<PremiumRenewalBanner />, { route: '/typing' });
    expect(screen.queryByRole('region', { name: 'Premium ends soon' })).not.toBeInTheDocument();
  });

  it('still shows when the browser cannot store the choice', () => {
    user.mockReturnValue(premiumUntil(2));
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    renderWithProviders(<PremiumRenewalBanner />, { route: '/typing' });
    expect(screen.getByRole('region', { name: 'Premium ends soon' })).toBeInTheDocument();
    vi.restoreAllMocks();
  });
});
