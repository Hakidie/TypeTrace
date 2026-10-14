import { describe, expect, it } from 'vitest';
import { classifyWord, tagWord, WordError } from './vietnamese-errors';

describe('classifyWord', () => {
  it.each([
    ['ấ', 'ầ', [WordError.TONE_WRONG]],
    ['ẩ', 'ẫ', [WordError.HOI_NGA_CONFUSION]],
    ['ấ', 'á', [WordError.MARK_WRONG]],
    ['ấ', 'a', [WordError.MARK_WRONG, WordError.TONE_WRONG]],
    ['đi', 'di', [WordError.D_MISSING]],
    ['con', 'cin', [WordError.BASE_LETTER]],
    ['ban', 'bàn', [WordError.TONE_WRONG]],
  ])('%s typed as %s gives %j', (target, typed, expected) => {
    expect(classifyWord(target, typed)).toEqual(expected);
  });

  it('returns no error for a correct word', () => {
    expect(classifyWord('Tiếng', 'Tiếng')).toEqual([]);
  });

  it('gives the same result for precomposed and combining Unicode', () => {
    const decomposed = 'ấ'.normalize('NFD');
    expect(classifyWord('ấ', decomposed)).toEqual([]);
    expect(classifyWord('ấ', 'ầ'.normalize('NFD'))).toEqual(classifyWord('ấ', 'ầ'));
    expect(classifyWord('ấ'.normalize('NFD'), 'a')).toEqual([WordError.MARK_WRONG, WordError.TONE_WRONG]);
  });

  it('accepts both tone placements', () => {
    expect(classifyWord('hoà', 'hòa')).toEqual([]);
    expect(classifyWord('thuỷ', 'thủy')).toEqual([]);
  });

  it('counts a wrong case as BASE_LETTER', () => {
    expect(classifyWord('Việt', 'việt')).toEqual([WordError.BASE_LETTER]);
  });

  it('keeps a hỏi/ngã confusion apart from other tone errors', () => {
    expect(classifyWord('nghỉ', 'nghĩ')).toEqual([WordError.HOI_NGA_CONFUSION]);
    expect(classifyWord('nghỉ', 'nghí')).toEqual([WordError.TONE_WRONG]);
    expect(classifyWord('nghỉ', 'nghi')).toEqual([WordError.TONE_WRONG]);
  });

  it('treats a missing horn or breve as a mark error', () => {
    expect(classifyWord('thư', 'thu')).toEqual([WordError.MARK_WRONG]);
    expect(classifyWord('ăn', 'an')).toEqual([WordError.MARK_WRONG]);
  });

  it('treats an extra stroke on d as BASE_LETTER and Đ/đ as stroked d', () => {
    expect(classifyWord('di', 'đi')).toEqual([WordError.BASE_LETTER]);
    expect(classifyWord('Đi', 'Di')).toEqual([WordError.D_MISSING]);
  });

  it('still compares the tone when the base letters differ', () => {
    expect(classifyWord('còn', 'cin')).toEqual([WordError.BASE_LETTER, WordError.TONE_WRONG]);
  });
});

describe('tagWord', () => {
  it('always offers BASE_LETTER and TONE_WRONG', () => {
    expect(tagWord('ban')).toEqual([WordError.BASE_LETTER, WordError.TONE_WRONG]);
  });

  it('adds the errors the word can have', () => {
    expect(tagWord('đi')).toEqual([WordError.BASE_LETTER, WordError.TONE_WRONG, WordError.D_MISSING]);
    expect(tagWord('ẩ')).toEqual([
      WordError.BASE_LETTER,
      WordError.TONE_WRONG,
      WordError.MARK_WRONG,
      WordError.HOI_NGA_CONFUSION,
    ]);
  });

  it('gives the same opportunities for NFC and NFD', () => {
    expect(tagWord('Việt'.normalize('NFD'))).toEqual(tagWord('Việt'));
  });
});
