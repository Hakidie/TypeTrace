import { describe, expect, it } from 'vitest';
import type { PaymentProduct } from '../types/payments.types';
import { bonusPercent, coinPacks, failureMessage, formatCoins, formatVnd, daysLeftText, itemLabel, momoFailureMessage, payosFailureMessage, planTitle, purchaseLabel, shouldAskToRenew, pricePerMonth, proPlans, savingPercent, timeLeftDetail } from './store';

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

describe('payosFailureMessage', () => {
  it('tells a cancel from any other failure', () => {
    expect(payosFailureMessage('true')).toMatch(/cancelled/);
    expect(payosFailureMessage('false')).toMatch(/payOS did not complete/);
    expect(payosFailureMessage(null)).toMatch(/payOS did not complete/);
  });
});

describe('daysLeftText', () => {
  const now = new Date('2026-10-01T10:00:00.000Z');

  it('counts the days to the end, a started day as a day', () => {
    expect(daysLeftText('2026-12-09T10:00:00.000Z', now)).toBe('69 days');
    expect(daysLeftText('2026-12-09T11:00:00.000Z', now)).toBe('70 days');
  });

  it('says "1 day" in the singular and never goes under it', () => {
    expect(daysLeftText('2026-10-02T10:00:00.000Z', now)).toBe('1 day');
    expect(daysLeftText('2026-10-01T10:30:00.000Z', now)).toBe('1 day');
  });
});

describe('timeLeftDetail', () => {
  const now = new Date(2026, 9, 1, 10, 0, 0);

  it('gives calendar months and the days after them', () => {
    expect(timeLeftDetail(new Date(2026, 11, 10, 10, 0, 0).toISOString(), now)).toBe('2 months 9 days left');
    expect(timeLeftDetail(new Date(2027, 3, 1, 10, 0, 0).toISOString(), now)).toBe('6 months left');
    expect(timeLeftDetail(new Date(2026, 10, 2, 10, 0, 0).toISOString(), now)).toBe('1 month 1 day left');
  });

  it('gives only days under a month', () => {
    expect(timeLeftDetail(new Date(2026, 9, 21, 10, 0, 0).toISOString(), now)).toBe('20 days left');
    expect(timeLeftDetail(new Date(2026, 9, 2, 10, 0, 0).toISOString(), now)).toBe('1 day left');
  });
});

describe('shouldAskToRenew', () => {
  const now = new Date('2026-11-14T10:00:00.000Z');
  const at = (days: number) => new Date(now.getTime() + days * 86_400_000).toISOString();

  it('is true from 3 days before the end, up to the end', () => {
    expect(shouldAskToRenew({ active: true, until: at(3) }, now)).toBe(true);
    expect(shouldAskToRenew({ active: true, until: at(0.1) }, now)).toBe(true);
    expect(shouldAskToRenew({ active: true, until: at(3.01) }, now)).toBe(false);
  });

  it('is false on Free or without a date', () => {
    expect(shouldAskToRenew({ active: false, until: null }, now)).toBe(false);
    expect(shouldAskToRenew({ active: true, until: null }, now)).toBe(false);
    expect(shouldAskToRenew(undefined, now)).toBe(false);
  });
});

describe('purchaseLabel', () => {
  it('names a purchase from the catalog and keeps an unknown id', () => {
    expect(purchaseLabel('premium-1m', products)).toBe('Premium 1 month');
    expect(purchaseLabel('premium-6m', products)).toBe('Premium 6 months');
    expect(purchaseLabel('coins-1400', products)).toBe('1.400 coins');
    expect(purchaseLabel('old-pack', products)).toBe('old-pack');
    expect(purchaseLabel('coins-500', undefined)).toBe('coins-500');
  });
});
