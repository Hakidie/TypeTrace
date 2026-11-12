import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '@/modules/auth/store/token.store';
import { DEFAULT_AVATAR } from '@/modules/avatar/types/avatar.types';
import { renderWithProviders } from '@/test/render-with-providers';
import { MomoReturnPage, PaymentReturnPage } from './PaymentReturnPage';

const confirmReturn = vi.fn();
const getMe = vi.fn();
const catalog = vi.fn();

vi.mock('../api/payments.api', () => ({ paymentsApi: { confirmReturn: (search: string, provider?: string) => confirmReturn(search, provider) } }));
vi.mock('@/modules/auth/api/auth.api', () => ({ authApi: { getMe: () => getMe() } }));
vi.mock('@/modules/avatar/api/avatar.api', () => ({ avatarApi: { catalog: () => catalog(), update: vi.fn() } }));
vi.mock('@/shared/components/lottie', () => ({ Lottie: () => null }));

const render = (query = 'vnp_ResponseCode=00&vnp_TxnRef=p1') =>
  renderWithProviders(<PaymentReturnPage />, { route: `/payments/vnpay/return?${query}` });

const emptySlots = { skin: [], face: [], hair: [], top: [], bottom: [], shoes: [], headwear: [], accessory: [], back: [], effect: [] };

beforeEach(() => {
  confirmReturn.mockReset();
  getMe.mockReset().mockResolvedValue({ _id: 'u1', email: 'a@b.c', coins: 1720, pro: { active: true, until: '2027-05-10T00:00:00.000Z' } });
  catalog.mockReset().mockResolvedValue({ avatar: DEFAULT_AVATAR, coins: 1720, pro: { active: true, until: null }, slots: emptySlots });
  tokenStore.set('token');
});

afterEach(() => tokenStore.clear());

describe('PaymentReturnPage', () => {
  it('forwards the query VNPay sent and shows the coins that were added', async () => {
    confirmReturn.mockResolvedValue({ status: 'paid', amount: 50_000, orderInfo: 'x', product: 'coins-1400', grant: { kind: 'coins', coins: 1400 } });
    render('vnp_ResponseCode=00&vnp_TxnRef=p1&vnp_SecureHash=abc');

    expect(await screen.findByRole('heading', { name: 'Payment complete' })).toBeInTheDocument();
    expect(confirmReturn).toHaveBeenCalledWith('?vnp_ResponseCode=00&vnp_TxnRef=p1&vnp_SecureHash=abc', 'vnpay');
    // The number counts up, so wait for the last frame.
    await waitFor(() => expect(screen.getByText('+1.400 coins')).toBeInTheDocument(), { timeout: 3000 });
    expect(await screen.findByText('New balance: 1.720 coins')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Buy more' })).toHaveAttribute('href', '/store');
  });

  it('welcomes a new Pro and says until when', async () => {
    confirmReturn.mockResolvedValue({ status: 'paid', amount: 249_000, orderInfo: 'x', product: 'pro-6m', grant: { kind: 'pro', days: 180 } });
    render();

    expect(await screen.findByRole('heading', { name: /You are Pro/ })).toBeInTheDocument();
    expect(await screen.findByText('Pro until 10 May 2027')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open wardrobe' })).toBeInTheDocument();
  });

  it('shows the Pro set on the avatar with a button to wear it, when the set has sprites', async () => {
    confirmReturn.mockResolvedValue({ status: 'paid', amount: 49_000, orderInfo: 'x', product: 'pro-1m', grant: { kind: 'pro', days: 30 } });
    catalog.mockResolvedValue({
      avatar: DEFAULT_AVATAR,
      coins: 0,
      pro: { active: true, until: null },
      slots: { ...emptySlots, headwear: [{ id: 'dragon-horns', unlock: { kind: 'pro' }, owned: true }] },
    });
    render();

    expect(await screen.findByRole('button', { name: 'Wear it now' })).toBeInTheDocument();
  });

  it('says why a payment did not go through and leads back to the store', async () => {
    confirmReturn.mockResolvedValue({ status: 'failed', amount: 49_000, orderInfo: 'x', product: 'pro-1m', grant: { kind: 'pro', days: 30 } });
    render('vnp_ResponseCode=24');

    expect(await screen.findByRole('heading', { name: 'Payment not completed' })).toBeInTheDocument();
    expect(screen.getByText('You cancelled the payment on VNPay.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to the store' })).toHaveAttribute('href', '/store');
  });

  it('confirms a MoMo return with the MoMo route and explains its result code', async () => {
    confirmReturn.mockResolvedValue({ status: 'failed', amount: 49_000, orderInfo: 'x', product: 'pro-1m', grant: { kind: 'pro', days: 30 } });
    renderWithProviders(<MomoReturnPage />, { route: '/payments/momo/return?orderId=p1&resultCode=1006&signature=abc' });

    expect(await screen.findByText('You cancelled the payment on MoMo.')).toBeInTheDocument();
    expect(confirmReturn).toHaveBeenCalledWith('?orderId=p1&resultCode=1006&signature=abc', 'momo');
  });

  it('refuses a return the server could not verify', async () => {
    confirmReturn.mockRejectedValue(new Error('Invalid checksum'));
    render('vnp_SecureHash=forged');

    expect(await screen.findByRole('heading', { name: 'We could not verify this payment' })).toBeInTheDocument();
  });

  it('shows the result to someone who is not signed in, with a login link and no account calls', async () => {
    tokenStore.clear();
    confirmReturn.mockResolvedValue({ status: 'paid', amount: 20_000, orderInfo: 'x', product: 'coins-500', grant: { kind: 'coins', coins: 500 } });
    render();

    expect(await screen.findByRole('heading', { name: 'Payment complete' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Log in to see it' })).toBeInTheDocument();
    expect(getMe).not.toHaveBeenCalled();
  });
});
