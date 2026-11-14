import type { AdminPaymentRow, PaymentProduct } from '../types/payments.types';

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

/** The same for payOS: its return URL only says whether the learner cancelled (`cancel=true`); the server asks payOS the rest. */
export const payosFailureMessage = (cancel: string | null) =>
  cancel === 'true' ? 'You cancelled the payment on payOS.' : 'payOS did not complete the payment.';

const DAY_MS = 24 * 60 * 60 * 1000;
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** The whole days until a Premium ends, a started day counting as a day; at least 1 while it lasts. */
const daysUntil = (until: string, now: Date) => Math.max(1, Math.ceil((new Date(until).getTime() - now.getTime()) / DAY_MS));

/** "69 days": what is left of a Premium, for the Store's top row. */
export const daysLeftText = (until: string, now = new Date()) => plural(daysUntil(until, now), 'day');

/** "2 months 9 days left": the same time in calendar months and days, for the tooltip. Under a month it is only days. */
export const timeLeftDetail = (until: string, now = new Date()) => {
  const end = new Date(until);
  const stepped = (count: number) => new Date(now.getFullYear(), now.getMonth() + count, now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds());
  let months = (end.getFullYear() - now.getFullYear()) * 12 + end.getMonth() - now.getMonth();
  if (months > 0 && stepped(months) > end) months -= 1;
  if (months <= 0) return `${plural(daysUntil(until, now), 'day')} left`;
  const days = Math.ceil((end.getTime() - stepped(months).getTime()) / DAY_MS);
  return `${[plural(months, 'month'), days > 0 ? plural(days, 'day') : ''].filter(Boolean).join(' ')} left`;
};

/** The gateways' names, as the admin payment list shows them. */
export const PROVIDER_NAMES: Record<AdminPaymentRow['provider'], string> = { payos: 'payOS', vnpay: 'VNPay', momo: 'MoMo' };

/** Only an open payOS payment, or a paid one that was not given yet, has something to check with payOS. */
export const canRecheck = (row: AdminPaymentRow) => row.provider === 'payos' && (row.status === 'pending' || (row.status === 'paid' && !row.granted));

/** Premium that ends in this many days or fewer asks the learner whether to extend it (the banner). */
export const RENEWAL_BANNER_DAYS = 3;

/** True while Premium is on and ends within `RENEWAL_BANNER_DAYS`. Worked out when the app opens: nothing runs in the background. */
export const shouldAskToRenew = (premium: { active: boolean; until: string | null } | undefined, now = new Date()) =>
  Boolean(premium?.active && premium.until && new Date(premium.until).getTime() - now.getTime() <= RENEWAL_BANNER_DAYS * DAY_MS);

/** What a payment bought, from the catalog: "Premium 6 months", "1.400 coins". An id the catalog no longer sells stays as it is. */
export const purchaseLabel = (productId: string, products: PaymentProduct[] | undefined) => {
  const grant = products?.find((product) => product.id === productId)?.grant;
  if (!grant) return productId;
  return grant.kind === 'premium' ? `Premium ${plural(grant.months, 'month')}` : formatCoins(grant.coins);
};
