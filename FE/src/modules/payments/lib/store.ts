import { i18n } from '@/shared/i18n/i18n';
import type { AdminPaymentRow, PaymentProduct } from '../types/payments.types';

const number = new Intl.NumberFormat('vi-VN');

/** `249000` → `249.000 ₫`. */
export const formatVnd = (amount: number) => `${number.format(amount)} ₫`;

/** `1400` → `1.400 coins`. */
export const formatCoins = (coins: number) => i18n.t('store:coins', { amount: number.format(coins) });

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

export const planTitle = (plan: PremiumProduct) => i18n.t('store:planMonths', { count: monthsOf(plan) });

/** What a month costs. */
export const pricePerMonth = (plan: PremiumProduct) => Math.round(plan.amount / monthsOf(plan));

/** How much cheaper a month is than the shortest plan's month, in %. */
export const savingPercent = (plan: PremiumProduct, shortest: PremiumProduct) =>
  Math.max(0, Math.round((1 - pricePerMonth(plan) / pricePerMonth(shortest)) * 100));

/** How many more coins per ₫ a pack gives than the smallest pack, in %. */
export const bonusPercent = (pack: CoinProduct, smallest: CoinProduct) =>
  Math.max(0, Math.round((pack.grant.coins / pack.amount / (smallest.grant.coins / smallest.amount) - 1) * 100));

/** What VNPay's `vnp_ResponseCode` means for a learner whose payment did not go through. */
export const failureMessage = (code: string | null) =>
  i18n.t(`store:failure.vnpay.${code === '24' || code === '11' || code === '51' || code === '65' ? code : 'other'}`);

const MOMO_FAILURES: Record<string, string> = { '1003': 'cancelled', '1006': 'cancelled', '1005': 'expired', '1001': 'balance', '1004': 'limit' };

export const momoFailureMessage = (code: string | null) => i18n.t(`store:failure.momo.${MOMO_FAILURES[code ?? ''] ?? 'other'}`);

export const payosFailureMessage = (cancel: string | null) => i18n.t(`store:failure.payos.${cancel === 'true' ? 'cancelled' : 'other'}`);

const DAY_MS = 24 * 60 * 60 * 1000;

/** The whole days until a Premium ends, a started day counting as a day; at least 1 while it lasts. */
const daysUntil = (until: string, now: Date) => Math.max(1, Math.ceil((new Date(until).getTime() - now.getTime()) / DAY_MS));

/** "69 days": what is left of a Premium, for the Store's top row. */
const dayCount = (count: number) => i18n.t('store:days', { count });
const monthCount = (count: number) => i18n.t('store:months', { count });

export const daysLeftText = (until: string, now = new Date()) => dayCount(daysUntil(until, now));

/** "2 months 9 days left": the same time in calendar months and days, for the tooltip. Under a month it is only days. */
export const timeLeftDetail = (until: string, now = new Date()) => {
  const end = new Date(until);
  const stepped = (count: number) => new Date(now.getFullYear(), now.getMonth() + count, now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds());
  let months = (end.getFullYear() - now.getFullYear()) * 12 + end.getMonth() - now.getMonth();
  if (months > 0 && stepped(months) > end) months -= 1;
  if (months <= 0) return i18n.t('store:left', { what: dayCount(daysUntil(until, now)) });
  const days = Math.ceil((end.getTime() - stepped(months).getTime()) / DAY_MS);
  return i18n.t('store:left', { what: [monthCount(months), days > 0 ? dayCount(days) : ''].filter(Boolean).join(' ') });
};

/** The gateways' names, as the admin payment list shows them. */
export const PROVIDER_NAMES: Record<AdminPaymentRow['provider'], string> = { payos: 'payOS', vnpay: 'VNPay', momo: 'MoMo' };

/** Only an open payOS payment, or a paid one that was not given yet, has something to check with payOS. */
export const canRecheck = (row: AdminPaymentRow) => row.provider === 'payos' && (row.status === 'pending' || row.status === 'expired' || (row.status === 'paid' && !row.granted));

/** Premium that ends in this many days or fewer asks the learner whether to extend it (the banner). */
export const RENEWAL_BANNER_DAYS = 3;

/** True while Premium is on and ends within `RENEWAL_BANNER_DAYS`. Worked out when the app opens: nothing runs in the background. */
export const shouldAskToRenew = (premium: { active: boolean; until: string | null } | undefined, now = new Date()) =>
  Boolean(premium?.active && premium.until && new Date(premium.until).getTime() - now.getTime() <= RENEWAL_BANNER_DAYS * DAY_MS);

/** What a payment bought, from the catalog: "Premium 6 months", "1.400 coins". An id the catalog no longer sells stays as it is. */
export const purchaseLabel = (productId: string, products: PaymentProduct[] | undefined) => {
  const grant = products?.find((product) => product.id === productId)?.grant;
  if (!grant) return productId;
  return grant.kind === 'premium' ? i18n.t('store:premiumTerm', { what: monthCount(grant.months) }) : formatCoins(grant.coins);
};
