import crypto from 'crypto';
import { describe, expect, it } from 'vitest';
import { newPayosOrderCode, signPayosCreate, signPayosData, verifyPayos } from '../../src/utils/payos';

const key = 'checksum';
const hmac = (raw: string) => crypto.createHmac('sha256', key).update(raw).digest('hex');

describe('payos helpers', () => {
  it('signs the five create fields in alphabetical order', () => {
    const fields = { orderCode: 123, amount: 3000, description: 'VQRIO123', returnUrl: 'https://x/ok', cancelUrl: 'https://x/no' };
    expect(signPayosCreate(fields, key)).toBe(hmac('amount=3000&cancelUrl=https://x/no&description=VQRIO123&orderCode=123&returnUrl=https://x/ok'));
  });

  it('signs a data object with sorted keys and empty values for null', () => {
    expect(signPayosData({ b: 2, a: 'x', c: null }, key)).toBe(hmac('a=x&b=2&c='));
  });

  it('accepts its own signature and rejects a changed field, a wrong key or no signature', () => {
    const data = { orderCode: 1, amount: 2000 };
    const signature = signPayosData(data, key);
    expect(verifyPayos(data, signature, key)).toBe(true);
    expect(verifyPayos({ ...data, amount: 1 }, signature, key)).toBe(false);
    expect(verifyPayos(data, signature, 'other')).toBe(false);
    expect(verifyPayos(data, undefined, key)).toBe(false);
  });

  it('makes whole order codes that payOS accepts', () => {
    const code = newPayosOrderCode();
    expect(Number.isSafeInteger(code)).toBe(true);
    expect(code).toBeGreaterThan(0);
  });
});
