import crypto from 'crypto';

export type PayosFields = Record<string, unknown>;

/** `key=value&key=value` with the keys in alphabetical order, as payOS asks; null and missing count as empty. */
const sortedQuery = (params: PayosFields) =>
  Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key] == null || params[key] === 'null' || params[key] === 'undefined' ? '' : String(params[key])}`)
    .join('&');

const hmac = (raw: string, checksumKey: string) => crypto.createHmac('sha256', checksumKey).update(raw, 'utf8').digest('hex');

const CREATE_KEYS = ['amount', 'cancelUrl', 'description', 'orderCode', 'returnUrl'] as const;

/** The signature sent when a payment link is created: only these five fields count. */
export const signPayosCreate = (fields: Record<(typeof CREATE_KEYS)[number], string | number>, checksumKey: string) =>
  hmac(sortedQuery(Object.fromEntries(CREATE_KEYS.map((key) => [key, fields[key]]))), checksumKey);

/** The signature of the `data` object of a payOS answer or webhook. */
export const signPayosData = (data: PayosFields, checksumKey: string) => hmac(sortedQuery(data), checksumKey);

/** True when `signature` matches `data` (the webhook really comes from payOS). */
export const verifyPayos = (data: PayosFields, signature: string | undefined, checksumKey: string) => {
  const given = Buffer.from((signature ?? '').toLowerCase());
  const expected = Buffer.from(signPayosData(data, checksumKey));
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
};

/** payOS wants a whole number (at most 9007199254740991) that was never used: the time in ms followed by 3 random digits. */
export const newPayosOrderCode = () => Date.now() * 1000 + Math.floor(Math.random() * 1000);
