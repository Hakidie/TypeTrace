import { describe, expect, it } from 'vitest';
import { completedWords, currentWord, isSameWord, wordKey } from '../src/words.js';

describe('completedWords', () => {
  it('keeps only words followed by a separator', () => {
    expect(completedWords('Tiếng Việt rấ')).toEqual(['Tiếng', 'Việt']);
    expect(completedWords('đẹp. Người ')).toEqual(['đẹp', 'Người']);
    expect(completedWords('xong')).toEqual([]);
  });

  it('treats the non-breaking space of contenteditable as a separator', () => {
    expect(completedWords('hoà ')).toEqual(['hoà']);
  });

  it('does not treat the placeholder Unikey inserts while adding a tone as a separator', () => {
    expect(completedWords('Tie·')).toEqual([]);
  });
});

describe('currentWord', () => {
  it('returns the text after the last separator', () => {
    expect(currentWord('Tiếng Việ')).toBe('Việ');
    expect(currentWord('Tiếng ')).toBe('');
    expect(currentWord('')).toBe('');
  });
});

describe('isSameWord', () => {
  it('accepts both tone placements', () => {
    expect(isSameWord('hòa', 'hoà')).toBe(true);
    expect(isSameWord('thủy', 'thuỷ')).toBe(true);
    expect(isSameWord('khỏe', 'khoẻ')).toBe(true);
  });

  it('accepts the same word in NFC and NFD', () => {
    expect(isSameWord('Tiếng'.normalize('NFD'), 'Tiếng')).toBe(true);
  });

  it('rejects a different tone, a missing tone or a different vowel', () => {
    expect(isSameWord('hóa', 'hoà')).toBe(false);
    expect(isSameWord('hoa', 'hoà')).toBe(false);
    expect(isSameWord('tẽt', 'text')).toBe(false);
    expect(isSameWord('thuở', 'thưở')).toBe(false);
  });

  it('keeps vowel marks that are not tones', () => {
    expect(wordKey('quốc')).toBe('quôc|́');
    expect(wordKey('đẹp')).toBe('đep|̣');
  });

  it('is case sensitive', () => {
    expect(isSameWord('việt', 'Việt')).toBe(false);
  });
});
