import crypto from 'crypto';
import { describe, expect, it } from 'vitest';
import { signMomoCreate, signMomoResult, verifyMomo } from '../../src/utils/momo';

const secret = 'secret';
const hmac = (raw: string) => crypto.createHmac('sha256', secret).update(raw).digest('hex');

describe('momo helpers', () => {
  it('signs the create fields in alphabetical order, as MoMo documents', () => {
    const create = {
      accessKey: 'ak', amount: '49000', extraData: '', ipnUrl: 'https://x/ipn', orderId: 'o1', orderInfo: 'info',
      partnerCode: 'P', redirectUrl: 'https://x/back', requestId: 'r1', requestType: 'captureWallet'
    };
    expect(signMomoCreate(create, secret)).toBe(
      hmac('accessKey=ak&amount=49000&extraData=&ipnUrl=https://x/ipn&orderId=o1&orderInfo=info&partnerCode=P&redirectUrl=https://x/back&requestId=r1&requestType=captureWallet')
    );
  });

  it('signs the answer with our own accessKey and counts a missing field as empty', () => {
    const answer = { orderId: 'o1', amount: '49000', resultCode: '0', transId: '77', message: 'ok' };
    expect(signMomoResult(answer, 'ak', secret)).toBe(
      hmac('accessKey=ak&amount=49000&extraData=&message=ok&orderId=o1&orderInfo=&orderType=&partnerCode=&payType=&requestId=&responseTime=&resultCode=0&transId=77')
    );
  });

  it('accepts its own signature and rejects a changed field, a wrong secret or no signature', () => {
    const answer = { orderId: 'o1', amount: '49000', resultCode: '0' };
    const signed = { ...answer, signature: signMomoResult(answer, 'ak', secret) };
    expect(verifyMomo(signed, 'ak', secret)).toBe(true);
    expect(verifyMomo({ ...signed, amount: '100' }, 'ak', secret)).toBe(false);
    expect(verifyMomo(signed, 'ak', 'other')).toBe(false);
    expect(verifyMomo(answer, 'ak', secret)).toBe(false);
  });
});
