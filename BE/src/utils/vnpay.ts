import crypto from 'crypto';

export type VnpParams = Record<string, string>;

/** VNPay encodes a space as `+`, `encodeURIComponent` as `%20`. */
const encode = (value: string) => encodeURIComponent(value).replace(/%20/g, '+');

/** The text VNPay signs: the `vnp_` fields (not the hash itself) sorted by name, values URL-encoded. */
const signingString = (params: VnpParams) =>
  Object.keys(params)
    .filter((key) => key.startsWith('vnp_') && key !== 'vnp_SecureHash' && key !== 'vnp_SecureHashType')
    .sort()
    .map((key) => `${key}=${encode(params[key])}`)
    .join('&');

export const signVnpay = (params: VnpParams, secret: string) =>
  crypto.createHmac('sha512', secret).update(signingString(params), 'utf8').digest('hex');

/** The page the learner is sent to in order to pay. */
export const buildVnpayUrl = (baseUrl: string, params: VnpParams, secret: string) =>
  `${baseUrl}?${signingString(params)}&vnp_SecureHash=${signVnpay(params, secret)}`;

/** True when `vnp_SecureHash` matches the other fields (the answer really comes from VNPay). */
export const verifyVnpay = (params: VnpParams, secret: string) => {
  const given = Buffer.from((params.vnp_SecureHash ?? '').toLowerCase());
  const expected = Buffer.from(signVnpay(params, secret));
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
};

/** `yyyyMMddHHmmss` in Vietnam time (GMT+7), the date format VNPay asks for. */
export const vnpayDate = (date: Date) =>
  new Date(date.getTime() + 7 * 60 * 60 * 1000).toISOString().replace(/\D/g, '').slice(0, 14);
