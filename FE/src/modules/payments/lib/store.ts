import type { PaymentProduct } from '../types/payments.types';

const number = new Intl.NumberFormat('vi-VN');

/** `249000` → `249.000 ₫`. */
export const formatVnd = (amount: number) => `${number.format(amount)} ₫`;

/** `1400` → `1.400 coins`. */
export const formatCoins = (coins: number) => `${number.format(coins)} coins`;

/** `dragon-horns` → `Dragon horns`. */
export const itemLabel = (id: string) => id.replace(/-/g, ' ').replace(/^./, (first) => first.toUpperCase());

type PremiumProduct = PaymentProduct & { grant: { kind: 'premium'; months: number } };
type CoinProduct = PaymentProduct & { grant: { kind: 'coins'; coins: number } };

/** The Premium plans, shortest first. */
export const proPlans = (products: PaymentProduct[]) =>
  products.filter((product): product is PremiumProduct => product.grant.kind === 'premium').sort((a, b) => a.grant.months - b.grant.months);

/** The coin packs, smallest first. */
export const coinPacks = (products: PaymentProduct[]) =>
  products.filter((product): product is CoinProduct => product.grant.kind === 'coins').sort((a, b) => a.grant.coins - b.grant.coins);

export const monthsOf = (plan: PremiumProduct) => plan.grant.months;

export const planTitle = (plan: PremiumProduct) => `${monthsOf(plan)} ${monthsOf(plan) === 1 ? 'month' : 'months'}`;

/** What a month costs. */
export const pricePerMonth = (plan: PremiumProduct) => Math.round(plan.amount / monthsOf(plan));

/** How much cheaper a month is than the shortest plan's month, in %. */
export const savingPercent = (plan: PremiumProduct, shortest: PremiumProduct) =>
  Math.max(0, Math.round((1 - pricePerMonth(plan) / pricePerMonth(shortest)) * 100));

/** How many more coins per ₫ a pack gives than the smallest pack, in %. */
export const bonusPercent = (pack: CoinProduct, smallest: CoinProduct) =>
  Math.max(0, Math.round((pack.grant.coins / pack.amount / (smallest.grant.coins / smallest.amount) - 1) * 100));

/** What VNPay's `vnp_ResponseCode` means for a learner whose payment did not go through. */
export const failureMessage = (code: string | null) => {
  switch (code) {
    case '24':
      return 'You cancelled the payment on VNPay.';
    case '11':
      return 'The payment window expired.';
    case '51':
      return 'The account does not have enough balance.';
    case '65':
      return 'The account reached its daily limit.';
    default:
      return 'VNPay did not complete the payment.';
  }
};

/** The same for MoMo's `resultCode`. */
export const momoFailureMessage = (code: string | null) => {
  switch (code) {
    case '1003':
    case '1006':
      return 'You cancelled the payment on MoMo.';
    case '1005':
      return 'The payment window expired.';
    case '1001':
      return 'The MoMo wallet does not have enough balance.';
    case '1004':
      return 'The payment is over the MoMo limit.';
    default:
      return 'MoMo did not complete the payment.';
  }
};
