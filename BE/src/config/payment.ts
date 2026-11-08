// What can be bought. The price lives here, on the server: the client only says which product it wants.
// ponytail: 99000 is a placeholder price; coin top-ups come later as one more entry (or a pack list).
export const PAYMENT_PRODUCTS = {
  pro: { amount: 99_000, orderInfo: 'Thanh toan goi Pro TypeTrace' }
} as const;

export type PaymentProduct = keyof typeof PAYMENT_PRODUCTS;

export const PAYMENT_PRODUCT_IDS = Object.keys(PAYMENT_PRODUCTS) as [PaymentProduct, ...PaymentProduct[]];
