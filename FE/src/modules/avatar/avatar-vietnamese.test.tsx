import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { i18n } from '@/shared/i18n/i18n';
import { lockText, poseName, slotName } from './lib/wardrobe-text';

describe('the wardrobe words in Vietnamese (SCRUM-333)', () => {
  it('names slots, poses and locks in the interface language', async () => {
    await act(() => i18n.changeLanguage('vi'));

    expect(slotName('hair')).toBe('Tóc');
    expect(poseName('win')).toBe('Thắng');
    expect(lockText({ kind: 'shop', price: 120 })).toBe('120 xu');
    expect(lockText({ kind: 'premium' })).toBe('Premium');
    await act(() => i18n.changeLanguage('en'));
    expect(lockText({ kind: 'shop', price: 120 })).toBe('120 coins');
  });
});
