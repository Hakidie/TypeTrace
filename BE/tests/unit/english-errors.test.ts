import { describe, expect, it } from 'vitest';
import { classifyEnglishWord, EnglishError, tagEnglishWord } from '../../src/utils/english-errors';

describe('classifyEnglishWord', () => {
  it.each([
    ['cat', 'car', [EnglishError.LETTER_WRONG]],
    ['the', 'th', [EnglishError.LETTER_MISSING]],
    ['the', 'thee', [EnglishError.LETTER_EXTRA]],
    ['the', 'teh', [EnglishError.LETTERS_SWAPPED]],
    ['The', 'the', [EnglishError.CASE_WRONG]],
    ['bread,', 'bread', [EnglishError.PUNCTUATION_WRONG]],
    ["don't", 'dont', [EnglishError.PUNCTUATION_WRONG]],
  ])('%s typed as %s gives %j', (target, typed, expected) => {
    expect(classifyEnglishWord(target, typed)).toEqual(expected);
  });

  it('returns no error for a correct word', () => {
    expect(classifyEnglishWord("Don't", "Don't")).toEqual([]);
  });

  it('gives the same result for precomposed and combining Unicode', () => {
    expect(classifyEnglishWord('café', 'café')).toEqual([]);
    expect(classifyEnglishWord('café'.normalize('NFD'), 'cafe')).toEqual([EnglishError.LETTER_WRONG]);
  });

  it('lists each error once, in the order of EnglishError', () => {
    expect(classifyEnglishWord('bus', 'bxx')).toEqual([EnglishError.LETTER_WRONG]);
    expect(classifyEnglishWord('Bread,', 'brad')).toEqual([
      EnglishError.LETTER_MISSING,
      EnglishError.CASE_WRONG,
      EnglishError.PUNCTUATION_WRONG,
    ]);
  });

  it('counts a wrong case only on the same letter, also for Caps Lock', () => {
    expect(classifyEnglishWord('I', 'i')).toEqual([EnglishError.CASE_WRONG]);
    expect(classifyEnglishWord('bread', 'BREAD')).toEqual([EnglishError.CASE_WRONG]);
    expect(classifyEnglishWord('The', 'Tge')).toEqual([EnglishError.LETTER_WRONG]);
  });

  it('keeps two letters swapped apart from a letter typed in another place', () => {
    expect(classifyEnglishWord('form', 'from')).toEqual([EnglishError.LETTERS_SWAPPED]);
    expect(classifyEnglishWord('The', 'teh')).toEqual([EnglishError.LETTERS_SWAPPED, EnglishError.CASE_WRONG]);
    expect(classifyEnglishWord('bread', 'beard')).toEqual([EnglishError.LETTER_MISSING, EnglishError.LETTER_EXTRA]);
  });

  it('names a letter typed as a punctuation mark a wrong letter, and a mark typed as a letter a punctuation error', () => {
    expect(classifyEnglishWord('farm', 'far,')).toEqual([EnglishError.LETTER_WRONG]);
    expect(classifyEnglishWord('bread,', 'breadm')).toEqual([EnglishError.PUNCTUATION_WRONG]);
  });

  it('counts a stray, wrong or misplaced punctuation mark as a punctuation error', () => {
    expect(classifyEnglishWord('bread', 'bread,')).toEqual([EnglishError.PUNCTUATION_WRONG]);
    expect(classifyEnglishWord('end.', 'end,')).toEqual([EnglishError.PUNCTUATION_WRONG]);
    expect(classifyEnglishWord("don't", "do'nt")).toEqual([EnglishError.PUNCTUATION_WRONG]);
  });

  it('counts a word left out as missing letters and punctuation', () => {
    expect(classifyEnglishWord('bread', '')).toEqual([EnglishError.LETTER_MISSING]);
    expect(classifyEnglishWord('bread,', '')).toEqual([EnglishError.LETTER_MISSING, EnglishError.PUNCTUATION_WRONG]);
  });
});

describe('tagEnglishWord', () => {
  it('offers every letter error and the case on a word of letters', () => {
    expect(tagEnglishWord('bread')).toEqual([
      EnglishError.LETTER_WRONG,
      EnglishError.LETTER_MISSING,
      EnglishError.LETTER_EXTRA,
      EnglishError.LETTERS_SWAPPED,
      EnglishError.CASE_WRONG,
    ]);
  });

  it('adds PUNCTUATION_WRONG when the word has punctuation', () => {
    expect(tagEnglishWord("don't")).toEqual(Object.values(EnglishError));
    expect(tagEnglishWord('town.')).toContain(EnglishError.PUNCTUATION_WRONG);
  });

  it('offers a swap only with two different letters side by side', () => {
    expect(tagEnglishWord('it')).toContain(EnglishError.LETTERS_SWAPPED);
    expect(tagEnglishWord('a')).not.toContain(EnglishError.LETTERS_SWAPPED);
    expect(tagEnglishWord('zz')).not.toContain(EnglishError.LETTERS_SWAPPED);
    expect(tagEnglishWord('I.')).not.toContain(EnglishError.LETTERS_SWAPPED);
  });

  it('offers no case error on digits, and only a character too many on a lone punctuation mark', () => {
    expect(tagEnglishWord('42')).toEqual([
      EnglishError.LETTER_WRONG,
      EnglishError.LETTER_MISSING,
      EnglishError.LETTER_EXTRA,
      EnglishError.LETTERS_SWAPPED,
    ]);
    expect(tagEnglishWord('-')).toEqual([EnglishError.LETTER_EXTRA, EnglishError.PUNCTUATION_WRONG]);
  });

  it('gives the same opportunities for NFC and NFD', () => {
    expect(tagEnglishWord('Café'.normalize('NFD'))).toEqual(tagEnglishWord('Café'));
  });

  it('gives a chance of every error a word can get, apart from a stray punctuation mark', () => {
    const typos = [['the', 'teh'], ['The', 'tge'], ["don't", 'dont'], ['bread,', ''], ['I', 'i'], ['farm', 'far,']];
    for (const [target, typed] of typos) {
      expect(tagEnglishWord(target)).toEqual(expect.arrayContaining(classifyEnglishWord(target, typed)));
    }
  });
});
