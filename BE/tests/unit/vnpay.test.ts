import { describe, expect, it } from 'vitest';
import { buildVnpayUrl, signVnpay, verifyVnpay, vnpayDate } from '../../src/utils/vnpay';

const secret = 'secret';
const params = { vnp_TxnRef: 'abc', vnp_Amount: '9900000', vnp_OrderInfo: 'Thanh toan goi Pro' };

describe('vnpay helpers', () => {
  it('signs the sorted fields with spaces as +', () => {
    const url = buildVnpayUrl('https://pay.example/vpcpay.html', params, secret);
    expect(url).toBe(
      `https://pay.example/vpcpay.html?vnp_Amount=9900000&vnp_OrderInfo=Thanh+toan+goi+Pro&vnp_TxnRef=abc&vnp_SecureHash=${signVnpay(params, secret)}`
    );
  });

  it('accepts its own checksum and rejects a changed field, a wrong secret or no checksum', () => {
    const signed = { ...params, vnp_SecureHash: signVnpay(params, secret) };
    expect(verifyVnpay(signed, secret)).toBe(true);
    expect(verifyVnpay({ ...signed, vnp_Amount: '100' }, secret)).toBe(false);
    expect(verifyVnpay(signed, 'other')).toBe(false);
    expect(verifyVnpay(params, secret)).toBe(false);
  });

  it('ignores vnp_SecureHashType when signing', () => {
    expect(signVnpay({ ...params, vnp_SecureHashType: 'HmacSHA512' }, secret)).toBe(signVnpay(params, secret));
  });

  it('writes dates in Vietnam time', () => {
    expect(vnpayDate(new Date('2026-11-09T05:16:42Z'))).toBe('20261109121642');
    expect(vnpayDate(new Date('2026-11-09T20:00:00Z'))).toBe('20261110030000');
  });
});
