import { describe, expect, it } from 'vitest';
import { cleanPassageText, titleSearchPattern } from '../../src/utils/passage-text';

describe('cleanPassageText', () => {
  it('keeps clean Vietnamese text as it is', () => {
    expect(cleanPassageText('Hà Nội vào thu, gió heo may se lạnh.')).toBe('Hà Nội vào thu, gió heo may se lạnh.');
  });

  it('turns decomposed letters into their composed form (NFC)', () => {
    const decomposed = 'Tiếng Việt'.normalize('NFD');
    expect(decomposed).not.toBe('Tiếng Việt');
    expect(cleanPassageText(decomposed)).toBe('Tiếng Việt');
  });

  it('removes HTML tags but keeps a lone < or >', () => {
    expect(cleanPassageText('<p>Xin <b>chào</b></p><br/><a href="https://example.com">bạn</a>')).toBe('Xin chào bạn');
    expect(cleanPassageText('3 < 5 và 7 > 2')).toBe('3 < 5 và 7 > 2');
  });

  it('removes hidden characters: BOM, zero-width space and joiner, soft hyphen, control characters', () => {
    expect(cleanPassageText('﻿bạn​ ơi­‍\u0007!')).toBe('bạn ơi!');
  });

  it('replaces typographic quotes, dashes and the ellipsis by keyboard characters', () => {
    expect(cleanPassageText('“Chào” ‘em’ – «bạn» — 1−2…')).toBe(`"Chào" 'em' - "bạn" - 1-2...`);
  });

  it('turns every run of white space, line breaks included, into one space', () => {
    expect(cleanPassageText('  một\n\nhai\tba bốn\r\n  ')).toBe('một hai ba bốn');
  });
});

describe('titleSearchPattern', () => {
  it('lets a letter typed without its marks find every accented form, in any case', () => {
    expect(titleSearchPattern('ha noi').test('Hà Nội vào thu')).toBe(true);
    expect(titleSearchPattern('DUONG').test('Đường về nhà')).toBe(true);
    expect(titleSearchPattern('ua').test('Bữa cơm')).toBe(true);
  });

  it('keeps the marks that are typed', () => {
    expect(titleSearchPattern('nhà').test('Đường về nhà')).toBe(true);
    expect(titleSearchPattern('nhạ').test('Đường về nhà')).toBe(false);
    expect(titleSearchPattern('đ').test('Dung')).toBe(false);
  });

  it('takes every other character literally, and decomposed letters as composed ones', () => {
    expect(titleSearchPattern('(1)').test('Mùa thu (1)')).toBe(true);
    expect(titleSearchPattern('.*').test('Mùa thu')).toBe(false);
    expect(titleSearchPattern('Mùa'.normalize('NFD')).test('Mùa thu')).toBe(true);
  });
});
