import crypto from 'crypto';

export type MomoParams = Record<string, string>;

/** The fields MoMo signs when a payment is created, in the order MoMo asks (alphabetical). */
const CREATE_KEYS = ['accessKey', 'amount', 'extraData', 'ipnUrl', 'orderId', 'orderInfo', 'partnerCode', 'redirectUrl', 'requestId', 'requestType'];
/** The fields MoMo signs in its answer (the return URL and the IPN call). */
const RESULT_KEYS = ['accessKey', 'amount', 'extraData', 'message', 'orderId', 'orderInfo', 'orderType', 'partnerCode', 'payType', 'requestId', 'responseTime', 'resultCode', 'transId'];

/** `key=value&key=value`, a missing field counts as empty. Values are not URL-encoded. */
const sign = (keys: string[], params: MomoParams, secret: string) =>
  crypto
    .createHmac('sha256', secret)
    .update(keys.map((key) => `${key}=${params[key] ?? ''}`).join('&'), 'utf8')
    .digest('hex');

export const signMomoCreate = (params: MomoParams, secret: string) => sign(CREATE_KEYS, params, secret);

/** The `accessKey` is ours: MoMo signs it but does not send it back. */
export const signMomoResult = (params: MomoParams, accessKey: string, secret: string) => sign(RESULT_KEYS, { ...params, accessKey }, secret);

/** True when `signature` matches the other fields (the answer really comes from MoMo). */
export const verifyMomo = (params: MomoParams, accessKey: string, secret: string) => {
  const given = Buffer.from((params.signature ?? '').toLowerCase());
  const expected = Buffer.from(signMomoResult(params, accessKey, secret));
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
};
