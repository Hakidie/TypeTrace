import { describe, expect, it } from 'vitest';
import { chanceWords, missingWords } from './chance-words';

describe('chanceWords', () => {
  it('names the words that give a chance of a type, or "words" when every word does', () => {
    expect(chanceWords('D_MISSING')).toBe('words with đ');
    expect(chanceWords('HOI_NGA_CONFUSION')).toBe('words with hỏi or ngã');
    expect(chanceWords('TONE_WRONG')).toBe('words');
    expect(chanceWords('BASE_LETTER')).toBe('words');
  });

  it('names the words of the English types too (SCRUM-219)', () => {
    expect(chanceWords('LETTERS_SWAPPED')).toBe('words of two letters or more');
    expect(chanceWords('PUNCTUATION_WRONG')).toBe('words with punctuation');
    expect(chanceWords('LETTER_WRONG')).toBe('words');
  });
});

describe('missingWords', () => {
  it('says how many more words a type needs, with one word in the singular', () => {
    expect(missingWords('D_MISSING', 12)).toBe('12 more words with đ');
    expect(missingWords('D_MISSING', 1)).toBe('1 more word with đ');
    expect(missingWords('TONE_WRONG', 15)).toBe('15 more words');
    expect(missingWords('BASE_LETTER', 1)).toBe('1 more word');
    expect(missingWords('PUNCTUATION_WRONG', 1)).toBe('1 more word with punctuation');
  });
});
