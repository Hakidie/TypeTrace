import { describe, expect, it } from 'vitest';
import { updateProfileSchema, updateSettingsSchema } from '../../src/validators/profile.validator';

describe('updateProfileSchema', () => {
  it('accepts an empty object (every field is optional)', () => {
    expect(updateProfileSchema.safeParse({}).success).toBe(true);
  });

  it('trims incoming strings', () => {
    const result = updateProfileSchema.parse({ displayName: '  Alice  ', phone: ' 0123456 ' });
    expect(result.displayName).toBe('Alice');
    expect(result.phone).toBe('0123456');
  });

  it('rejects a displayName that is empty after trimming', () => {
    expect(updateProfileSchema.safeParse({ displayName: '   ' }).success).toBe(false);
  });

  it('enforces displayName and bio maximum lengths', () => {
    expect(updateProfileSchema.safeParse({ displayName: 'a'.repeat(100) }).success).toBe(true);
    expect(updateProfileSchema.safeParse({ displayName: 'a'.repeat(101) }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ bio: 'b'.repeat(200) }).success).toBe(true);
    expect(updateProfileSchema.safeParse({ bio: 'b'.repeat(201) }).success).toBe(false);
  });

  it('enforces phone length boundaries', () => {
    expect(updateProfileSchema.safeParse({ phone: '123456' }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ phone: '1234567' }).success).toBe(true);
    expect(updateProfileSchema.safeParse({ phone: '1'.repeat(20) }).success).toBe(true);
    expect(updateProfileSchema.safeParse({ phone: '1'.repeat(21) }).success).toBe(false);
  });

  it('rejects non-string values', () => {
    expect(updateProfileSchema.safeParse({ displayName: 42 }).success).toBe(false);
  });
});

describe('updateSettingsSchema (SCRUM-31)', () => {
  const messagesOf = (body: unknown) => {
    const result = updateSettingsSchema.safeParse(body);
    return result.success ? [] : result.error.issues.map((issue) => issue.message);
  };

  it("trims the zone and keeps the browser's name for it, not the one this server's Intl gives it", () => {
    // Node 24 calls these zones Asia/Saigon and Europe/Kiev.
    expect(updateSettingsSchema.parse({ timezone: '  Asia/Ho_Chi_Minh ' })).toEqual({ timezone: 'Asia/Ho_Chi_Minh' });
    expect(updateSettingsSchema.parse({ timezone: 'Europe/Kyiv' })).toEqual({ timezone: 'Europe/Kyiv' });
    expect(updateSettingsSchema.parse({ timezone: 'utc' })).toEqual({ timezone: 'utc' });
  });

  it('drops every other field, so the theme settings cannot be sent here', () => {
    expect(updateSettingsSchema.parse({ timezone: 'UTC', mode: 'light', darkTheme: null })).toEqual({ timezone: 'UTC' });
  });

  it('requires a zone', () => {
    expect(updateSettingsSchema.safeParse({}).success).toBe(false);
    expect(updateSettingsSchema.safeParse({ timezone: 7 }).success).toBe(false);
    expect(messagesOf({ timezone: '' })).toContain('Time zone is required');
    expect(messagesOf({ timezone: '   ' })).toContain('Time zone is required');
  });

  it('refuses a zone Intl does not know and one longer than 64 characters', () => {
    expect(messagesOf({ timezone: 'Mars/Olympus' })).toEqual(['Unknown time zone']);
    expect(messagesOf({ timezone: 'A'.repeat(64) })).toEqual(['Unknown time zone']);
    expect(messagesOf({ timezone: 'A'.repeat(65) })).toContain('At most 64 characters');
  });
});
