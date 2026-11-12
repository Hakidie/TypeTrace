// What can be bought. The price and what it gives live here, on the server: the client only says which product it wants.
// ponytail: the prices and pack sizes are placeholders to confirm. `orderInfo` has no accents (VNPay).
export type PaymentGrant = { kind: 'pro'; days: number } | { kind: 'coins'; coins: number };

interface ProductConfig {
  /** In VND. */
  amount: number;
  orderInfo: string;
  grant: PaymentGrant;
}

export const PAYMENT_PRODUCTS = {
  // Days, not calendar months: plain date maths on every MongoDB version.
  'pro-1m': { amount: 49_000, orderInfo: 'Thanh toan Pro 1 thang TypeTrace', grant: { kind: 'pro', days: 30 } },
  'pro-6m': { amount: 249_000, orderInfo: 'Thanh toan Pro 6 thang TypeTrace', grant: { kind: 'pro', days: 180 } },
  'pro-12m': { amount: 449_000, orderInfo: 'Thanh toan Pro 12 thang TypeTrace', grant: { kind: 'pro', days: 365 } },
  'coins-500': { amount: 20_000, orderInfo: 'Thanh toan 500 coin TypeTrace', grant: { kind: 'coins', coins: 500 } },
  'coins-1400': { amount: 50_000, orderInfo: 'Thanh toan 1400 coin TypeTrace', grant: { kind: 'coins', coins: 1400 } },
  'coins-3000': { amount: 100_000, orderInfo: 'Thanh toan 3000 coin TypeTrace', grant: { kind: 'coins', coins: 3000 } }
} as const satisfies Record<string, ProductConfig>;

export type PaymentProduct = keyof typeof PAYMENT_PRODUCTS;

export const PAYMENT_PRODUCT_IDS = Object.keys(PAYMENT_PRODUCTS) as [PaymentProduct, ...PaymentProduct[]];
