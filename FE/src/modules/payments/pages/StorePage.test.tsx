import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_AVATAR } from '@/modules/avatar/types/avatar.types';
import { renderWithProviders } from '@/test/render-with-providers';
import type { PaymentProduct } from '../types/payments.types';
import { StorePage } from './StorePage';

const products = vi.fn();
const start = vi.fn();
const catalog = vi.fn();
const assign = vi.fn();

vi.mock('../api/payments.api', () => ({
  paymentsApi: { products: () => products(), start: (product: string, provider?: string) => start(product, provider) },
}));
vi.mock('@/modules/avatar/api/avatar.api', () => ({ avatarApi: { catalog: () => catalog() } }));
const plan = vi.fn();
vi.mock('@/modules/plan/api/plan.api', () => ({ planApi: { get: () => plan() } }));

const list: PaymentProduct[] = [
  { id: 'premium-1m', amount: 49_000, grant: { kind: 'premium', months: 1 } },
  { id: 'premium-6m', amount: 249_000, grant: { kind: 'premium', months: 6 } },
  { id: 'premium-12m', amount: 449_000, grant: { kind: 'premium', months: 12 } },
  { id: 'coins-500', amount: 20_000, grant: { kind: 'coins', coins: 500 } },
  { id: 'coins-1400', amount: 50_000, grant: { kind: 'coins', coins: 1400 } },
  { id: 'coins-3000', amount: 100_000, grant: { kind: 'coins', coins: 3000 } },
];

const free = { kind: 'free' };
const emptySlots = { skin: [{ id: 'peach', unlock: free, owned: true }], face: [], hair: [], top: [], bottom: [], shoes: [], headwear: [], accessory: [], back: [], effect: [] };
const dragonSlots = {
  ...emptySlots,
  headwear: [{ id: 'dragon-horns', unlock: { kind: 'premium' }, owned: false }],
  back: [{ id: 'dragon-wings', unlock: { kind: 'premium' }, owned: false }],
};
const answerCatalog = (extra: object = {}) =>
  catalog.mockResolvedValue({ avatar: DEFAULT_AVATAR, coins: 320, premium: { active: false, until: null }, slots: emptySlots, ...extra });

const renderPage = (route = '/store') => renderWithProviders(<StorePage />, { route });

beforeAll(() => {
  // jsdom cannot navigate: the page only needs to call `assign` with the VNPay url.
  Object.defineProperty(window, 'location', { value: { assign }, writable: true, configurable: true });
});

beforeEach(() => {
  products.mockReset().mockResolvedValue(list);
  plan.mockReset().mockResolvedValue({ plan: 'free', expiresAt: null, maxPassages: 9, usedPassages: 2, canUsePublicPassages: false, canCreateErrorPractice: false, plans: { free: { priceVnd: 0, maxPassages: 9, canCreateErrorPractice: false, canUsePublicPassages: false }, premium: { priceVnd: 99000, maxPassages: 90, canCreateErrorPractice: true, canUsePublicPassages: true } } });
  start.mockReset().mockResolvedValue({ paymentId: 'p1', paymentUrl: 'https://sandbox.vnpayment.vn/pay?x=1' });
  catalog.mockReset();
  assign.mockReset();
  answerCatalog();
});

describe('StorePage', () => {
  it('shows the plans and packs the server sent, with the saving and the bonus', async () => {
    renderPage();

    const plans = await screen.findByRole('radiogroup', { name: 'Premium plan' });
    expect(within(plans).getByRole('radio', { name: /6 months/ })).toBeChecked();
    expect(within(plans).getByText('Save 15%')).toBeInTheDocument();
    expect(within(plans).getByText('Save 24%')).toBeInTheDocument();
    expect(within(plans).getByText('249.000 ₫')).toBeInTheDocument();
    const packs = screen.getByRole('radiogroup', { name: 'Coin pack' });
    expect(within(packs).getByRole('radio', { name: /1\.400 coins/ })).toBeChecked();
    expect(within(packs).getByText('+12% coins')).toBeInTheDocument();
    expect(screen.getByText('320 coins')).toBeInTheDocument();
  });

  it('sends the chosen plan to VNPay', async () => {
    renderPage();
    const plans = await screen.findByRole('radiogroup', { name: 'Premium plan' });

    fireEvent.click(within(plans).getByRole('radio', { name: /12 months/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Get Premium with VNPay' }));

    await waitFor(() => expect(start).toHaveBeenCalledWith('premium-12m', 'vnpay'));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://sandbox.vnpayment.vn/pay?x=1'));
  });

  it('sends the chosen coin pack to VNPay', async () => {
    renderPage();
    const packs = await screen.findByRole('radiogroup', { name: 'Coin pack' });

    fireEvent.click(within(packs).getByRole('radio', { name: /3\.000 coins/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Get coins with VNPay' }));

    await waitFor(() => expect(start).toHaveBeenCalledWith('coins-3000', 'vnpay'));
  });

  it('sends the chosen plan and pack to MoMo with their own buttons, next to VNPay', async () => {
    start.mockResolvedValue({ paymentId: 'p2', paymentUrl: 'https://test-payment.momo.vn/pay/abc' });
    renderPage();
    await screen.findByRole('radiogroup', { name: 'Premium plan' });

    fireEvent.click(screen.getByRole('button', { name: 'Get Premium with MoMo' }));
    await waitFor(() => expect(start).toHaveBeenCalledWith('premium-6m', 'momo'));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://test-payment.momo.vn/pay/abc'));

    fireEvent.click(screen.getByRole('button', { name: 'Get coins with MoMo' }));
    await waitFor(() => expect(start).toHaveBeenCalledWith('coins-1400', 'momo'));
  });

  it('previews the Premium items on the avatar and lets each one be switched off', async () => {
    answerCatalog({ slots: dragonSlots });
    renderPage();

    const items = await screen.findByRole('group', { name: 'Preview items' });
    const headset = within(items).getByRole('button', { name: 'Dragon horns' });
    expect(headset).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(headset);
    expect(headset).toHaveAttribute('aria-pressed', 'false');
    expect(within(items).getByRole('button', { name: 'Dragon wings' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('has no item switches while the Premium items have no sprites yet', async () => {
    renderPage();

    await screen.findByRole('radiogroup', { name: 'Premium plan' });
    expect(screen.queryByRole('group', { name: 'Preview items' })).not.toBeInTheDocument();
  });

  it('offers to extend an active Premium and says until when', async () => {
    answerCatalog({ premium: { active: true, until: '2027-05-10T00:00:00.000Z' } });
    renderPage();

    expect(await screen.findByRole('button', { name: 'Extend Premium with VNPay' })).toBeInTheDocument();
    expect(screen.getByText(/until 10 May 2027/)).toBeInTheDocument();
  });

  it('lists what Premium gives from the plans an admin set (passage limit, Train)', async () => {
    renderPage();

    expect(await screen.findByText('Up to 90 passages of your own, and Train on your weak spots')).toBeInTheDocument();
    expect(screen.getByText('A Premium badge beside your name')).toBeInTheDocument();
  });

  it('shows the backend error with a retry button', async () => {
    products.mockRejectedValue(new Error('Network down'));
    renderPage();

    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
