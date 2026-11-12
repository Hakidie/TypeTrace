import { describe, expect, it } from 'vitest';
import type { PaymentProduct } from '../types/payments.types';
import { bonusPercent, coinPacks, failureMessage, formatCoins, formatVnd, itemLabel, momoFailureMessage, planTitle, pricePerMonth, proPlans, savingPercent } from './store';

const products: PaymentProduct[] = [
  { id: 'coins-1400', amount: 50_000, grant: { kind: 'coins', coins: 1400 } },
  { id: 'premium-12m', amount: 449_000, grant: { kind: 'premium', months: 12 } },
  { id: 'coins-500', amount: 20_000, grant: { kind: 'coins', coins: 500 } },
  { id: 'premium-1m', amount: 49_000, grant: { kind: 'premium', months: 1 } },
  { id: 'premium-6m', amount: 249_000, grant: { kind: 'premium', months: 6 } },
];

describe('store helpers', () => {
  it('formats money and coins with dots', () => {
    expect(formatVnd(249_000)).toBe('249.000 ₫');
    expect(formatCoins(1400)).toBe('1.400 coins');
  });

  it('puts plans and packs in order, shortest and smallest first', () => {
    expect(proPlans(products).map((plan) => plan.id)).toEqual(['premium-1m', 'premium-6m', 'premium-12m']);
    expect(coinPacks(products).map((pack) => pack.id)).toEqual(['coins-500', 'coins-1400']);
  });

  it('works out months, price per month and the saving against the shortest plan', () => {
    const [one, six, twelve] = proPlans(products);
    expect([planTitle(one), planTitle(six), planTitle(twelve)]).toEqual(['1 month', '6 months', '12 months']);
    expect(pricePerMonth(six)).toBe(41_500);
    expect(savingPercent(one, one)).toBe(0);
    expect(savingPercent(six, one)).toBe(15);
    expect(savingPercent(twelve, one)).toBe(24);
  });

  it('works out the coin bonus against the smallest pack', () => {
    const [small, big] = coinPacks(products);
    expect(bonusPercent(small, small)).toBe(0);
    expect(bonusPercent(big, small)).toBe(12);
  });

  it('names items and explains VNPay failures', () => {
    expect(itemLabel('dragon-horns')).toBe('Dragon horns');
    expect(failureMessage('24')).toMatch(/cancelled/);
    expect(failureMessage(null)).toMatch(/did not complete/);
  });

  it('explains MoMo failures by their result code', () => {
    expect(momoFailureMessage('1006')).toMatch(/cancelled/);
    expect(momoFailureMessage('1005')).toMatch(/expired/);
    expect(momoFailureMessage(null)).toMatch(/MoMo did not complete/);
  });
});
