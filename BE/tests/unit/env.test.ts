import { describe, expect, it } from 'vitest';
import { parseEnv } from '../../src/config/env';

const base = { MONGO_URI: 'mongodb://localhost/test', JWT_SECRET: 'dev-secret' };

describe('parseEnv', () => {
  it('applies defaults for optional variables', () => {
    const env = parseEnv(base);
    expect(env.port).toBe(5003);
    expect(env.nodeEnv).toBe('development');
    expect(env.smtpHost).toBeUndefined();
    expect(env.smtpSecure).toBe(false);
  });

  it('coerces numbers and booleans', () => {
    const env = parseEnv({ ...base, PORT: '8080', SMTP_SECURE: 'true', OTP_EXPIRES_MINUTES: '5' });
    expect(env.port).toBe(8080);
    expect(env.smtpSecure).toBe(true);
    expect(env.otpExpiresMinutes).toBe(5);
  });

  it('treats blank optional values as unset', () => {
    expect(parseEnv({ ...base, SMTP_HOST: '  ' }).smtpHost).toBeUndefined();
  });

  it('reads the VNPay settings and defaults to the sandbox url', () => {
    const unset = parseEnv({ ...base, VNP_TMN_CODE: ' ' });
    expect(unset.vnpTmnCode).toBeUndefined();
    expect(unset.vnpHashSecret).toBeUndefined();
    expect(unset.vnpUrl).toBe('https://sandbox.vnpayment.vn/paymentv2/vpcpay.html');
    const set = parseEnv({ ...base, VNP_TMN_CODE: 'CODE', VNP_HASH_SECRET: 'secret', VNP_URL: 'https://pay.example/vpcpay.html' });
    expect(set).toMatchObject({ vnpTmnCode: 'CODE', vnpHashSecret: 'secret', vnpUrl: 'https://pay.example/vpcpay.html' });
  });

  it('reads the MoMo settings and defaults to the sandbox url and a local IPN url', () => {
    const unset = parseEnv({ ...base, MOMO_PARTNER_CODE: ' ' });
    expect(unset.momoPartnerCode).toBeUndefined();
    expect(unset.momoUrl).toBe('https://test-payment.momo.vn/v2/gateway/api/create');
    expect(unset.momoIpnUrl).toBe('http://localhost:5003/api/payments/momo/ipn');
    const set = parseEnv({ ...base, MOMO_PARTNER_CODE: 'P', MOMO_ACCESS_KEY: 'a', MOMO_SECRET_KEY: 's', MOMO_IPN_URL: 'https://x.ngrok.app/api/payments/momo/ipn' });
    expect(set).toMatchObject({ momoPartnerCode: 'P', momoAccessKey: 'a', momoSecretKey: 's', momoIpnUrl: 'https://x.ngrok.app/api/payments/momo/ipn' });
  });

  it('allows the mock MoMo payment in development only', () => {
    expect(parseEnv(base).momoMock).toBe(false);
    expect(parseEnv({ ...base, MOMO_MOCK: 'true' }).momoMock).toBe(true);
    expect(() => parseEnv({ ...base, NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(40), MOMO_MOCK: 'true' })).toThrow(/MOMO_MOCK/);
  });

  it('lists every missing required variable', () => {
    expect(() => parseEnv({})).toThrow(/MONGO_URI[\s\S]*JWT_SECRET/);
  });

  it('rejects the example or a short JWT secret in production', () => {
    expect(() => parseEnv({ ...base, NODE_ENV: 'production', JWT_SECRET: 'change_this_secret' })).toThrow(/JWT_SECRET/);
    expect(() => parseEnv({ ...base, NODE_ENV: 'production', JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/);
    expect(parseEnv({ ...base, NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(32) }).nodeEnv).toBe('production');
  });
});
