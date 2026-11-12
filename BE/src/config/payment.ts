// What can be bought. The price and what it gives live on the server: the client only says which product it wants.
// `orderInfo` has no accents (VNPay).
export type PaymentGrant = { kind: 'premium'; months: number } | { kind: 'coins'; coins: number };

/** A coin pack has its own price. ponytail: the pack sizes and prices are placeholders to confirm. */
interface CoinProduct {
  /** In VND. */
  amount: number;
  orderInfo: string;
  grant: { kind: 'coins'; coins: number };
}

/**
 * A term of Premium (US11.1). Its price follows the price of one month an admin sets in the Plans page
 * (`AppSettings.plans.premium.priceVnd`): `premiumAmount` = months x that price, less `discount` (a share, 0.15 = 15%).
 */
interface PremiumProduct {
  orderInfo: string;
  discount: number;
  grant: { kind: 'premium'; months: number };
}

export const PAYMENT_PRODUCTS = {
  'premium-1m': { orderInfo: 'Thanh toan Premium 1 thang TypeTrace', discount: 0, grant: { kind: 'premium', months: 1 } },
  'premium-6m': { orderInfo: 'Thanh toan Premium 6 thang TypeTrace', discount: 0.15, grant: { kind: 'premium', months: 6 } },
  'premium-12m': { orderInfo: 'Thanh toan Premium 12 thang TypeTrace', discount: 0.24, grant: { kind: 'premium', months: 12 } },
  'coins-500': { amount: 20_000, orderInfo: 'Thanh toan 500 coin TypeTrace', grant: { kind: 'coins', coins: 500 } },
  'coins-1400': { amount: 50_000, orderInfo: 'Thanh toan 1400 coin TypeTrace', grant: { kind: 'coins', coins: 1400 } },
  'coins-3000': { amount: 100_000, orderInfo: 'Thanh toan 3000 coin TypeTrace', grant: { kind: 'coins', coins: 3000 } }
} as const satisfies Record<string, CoinProduct | PremiumProduct>;

export type PaymentProduct = keyof typeof PAYMENT_PRODUCTS;

export const PAYMENT_PRODUCT_IDS = Object.keys(PAYMENT_PRODUCTS) as [PaymentProduct, ...PaymentProduct[]];

/** What a product costs in VND, given the price of one month of Premium; rounded to the thousand. */
export const productAmount = (product: PaymentProduct, premiumMonthVnd: number) => {
  const config = PAYMENT_PRODUCTS[product];
  if ('amount' in config) return config.amount;
  return Math.round((premiumMonthVnd * config.grant.months * (1 - config.discount)) / 1000) * 1000;
};
