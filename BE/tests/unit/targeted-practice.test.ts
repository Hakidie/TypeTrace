import { describe, expect, it } from 'vitest';
import { WORD_LIST } from '../../src/data/words';
import {
  type BankWord,
  buildLesson,
  LESSON_MAX_FOCUS_PERCENT,
  LESSON_MAX_WORDS,
  LESSON_MIN_FOCUS_PERCENT,
  LESSON_MIN_WORDS,
  lessonTitle,
  trainsErrorType
} from '../../src/services/targeted-practice.service';
import { tagWord, WordError, type WordErrorType } from '../../src/utils/vietnamese-errors';

const word = (text: string): BankWord => ({ text, tags: tagWord(text) });

/** The starter word list (`npm run import:words`), as the bank reads it. */
const BANK = [...new Set(WORD_LIST)].map(word);

/** A random number generator that gives the same numbers for the same seed (mulberry32), so every case can be run again. */
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const SEEDS = Array.from({ length: 200 }, (_, index) => index + 1);

const trainsAny = (focus: readonly WordErrorType[]) => (text: string) => focus.some((type) => trainsErrorType(word(text), type));

/** How many words of the lesson train the focus, and the range the rule allows for its size. */
const focusShare = (words: string[], focus: readonly WordErrorType[]) => ({
  trained: words.filter(trainsAny(focus)).length,
  min: Math.ceil((words.length * LESSON_MIN_FOCUS_PERCENT) / 100),
  max: Math.floor((words.length * LESSON_MAX_FOCUS_PERCENT) / 100)
});

const lessonOf = (focus: WordErrorType[], seed: number, words: readonly BankWord[] = BANK, recentWords: ReadonlySet<string> = new Set()) =>
  buildLesson({ focus, words, recentWords, random: seeded(seed) })!;

describe('trainsErrorType', () => {
  it('reads đ, the vowel marks and hỏi / ngã from the tags of the word', () => {
    expect(trainsErrorType(word('đường'), WordError.D_MISSING)).toBe(true);
    expect(trainsErrorType(word('đường'), WordError.MARK_WRONG)).toBe(true);
    expect(trainsErrorType(word('đường'), WordError.HOI_NGA_CONFUSION)).toBe(false);
    expect(trainsErrorType(word('nghĩ'), WordError.HOI_NGA_CONFUSION)).toBe(true);
    expect(trainsErrorType(word('em'), WordError.D_MISSING)).toBe(false);
  });

  it('trains a tone only with a word that has a tone mark, though every word is tagged with TONE_WRONG', () => {
    expect(tagWord('em')).toContain(WordError.TONE_WRONG);
    expect(trainsErrorType(word('em'), WordError.TONE_WRONG)).toBe(false);
    expect(trainsErrorType(word('anh'), WordError.TONE_WRONG)).toBe(false);
    for (const toned of ['đường', 'sáng', 'ngã', 'hỏi', 'mẹ']) expect(trainsErrorType(word(toned), WordError.TONE_WRONG)).toBe(true);
  });

  it('trains the letters with any word', () => {
    expect(BANK.every((item) => trainsErrorType(item, WordError.BASE_LETTER))).toBe(true);
  });
});

describe('buildLesson', () => {
  it.each([
    [[WordError.D_MISSING]],
    [[WordError.MARK_WRONG]],
    [[WordError.HOI_NGA_CONFUSION]],
    [[WordError.TONE_WRONG]],
    [[WordError.HOI_NGA_CONFUSION, WordError.D_MISSING]]
  ])('gives %j 30 to 50 words of the bank, 60 to 70 %% of them training it, none twice', (focus) => {
    const sizes = new Set<number>();
    for (const seed of SEEDS) {
      const lesson = lessonOf(focus, seed);
      const { trained, min, max } = focusShare(lesson.words, focus);

      expect(lesson.focus).toEqual(focus);
      expect(lesson.words.length).toBeGreaterThanOrEqual(LESSON_MIN_WORDS);
      expect(lesson.words.length).toBeLessThanOrEqual(LESSON_MAX_WORDS);
      expect(trained).toBeGreaterThanOrEqual(min);
      expect(trained).toBeLessThanOrEqual(max);
      expect(new Set(lesson.words).size).toBe(lesson.words.length);
      expect(lesson.words.every((text) => BANK.some((item) => item.text === text))).toBe(true);
      sizes.add(lesson.words.length);
    }
    // The size is drawn again for every lesson, over the whole range.
    expect(sizes).toContain(LESSON_MIN_WORDS);
    expect(sizes).toContain(LESSON_MAX_WORDS);
  });

  it('lets two error types take turns, so each one trains about half of the focus words', () => {
    const focus = [WordError.HOI_NGA_CONFUSION, WordError.D_MISSING];
    for (const seed of SEEDS) {
      const { words } = lessonOf(focus, seed);
      const { trained } = focusShare(words, focus);

      expect(words.filter(trainsAny([WordError.HOI_NGA_CONFUSION])).length).toBeGreaterThanOrEqual(Math.floor(trained / 2));
      expect(words.filter(trainsAny([WordError.D_MISSING])).length).toBeGreaterThanOrEqual(Math.floor(trained / 2));
    }
  });

  it('puts the words in a random order, not the focus words first', () => {
    const focus = [WordError.D_MISSING];
    const firstHalfShares = SEEDS.map((seed) => {
      const { words } = lessonOf(focus, seed);
      return words.slice(0, words.length / 2).filter(trainsAny(focus)).length / Math.floor(words.length / 2);
    });

    expect(firstHalfShares.some((share) => share < 1)).toBe(true);
  });

  it('makes a lesson of the letters of any words, every one training them', () => {
    for (const seed of SEEDS) {
      const lesson = lessonOf([WordError.BASE_LETTER], seed);

      expect(lesson.focus).toEqual([WordError.BASE_LETTER]);
      expect(lesson.words.length).toBeGreaterThanOrEqual(LESSON_MIN_WORDS);
      expect(lesson.words.length).toBeLessThanOrEqual(LESSON_MAX_WORDS);
      expect(new Set(lesson.words).size).toBe(lesson.words.length);
    }
  });

  it('keeps half of a letters lesson for the other weak type', () => {
    for (const seed of SEEDS) {
      const { words } = lessonOf([WordError.BASE_LETTER, WordError.D_MISSING], seed);

      expect(words.filter(trainsAny([WordError.D_MISSING])).length).toBeGreaterThanOrEqual(Math.floor(words.length / 2));
    }
  });

  it('takes no word of the last lessons while the bank has others', () => {
    const focus = [WordError.D_MISSING];
    const withD = BANK.filter((item) => trainsErrorType(item, WordError.D_MISSING)).map((item) => item.text);
    const without = BANK.filter((item) => !trainsErrorType(item, WordError.D_MISSING)).map((item) => item.text);
    // Enough fresh words for the biggest lesson: 35 that train the focus (70 % of 50) and 20 others (30 % of the smallest, 30).
    const fresh = new Set([...withD.slice(0, 35), ...without.slice(0, 20)]);
    const recentWords = new Set(BANK.map((item) => item.text).filter((text) => !fresh.has(text)));

    for (const seed of SEEDS) {
      expect(lessonOf(focus, seed, BANK, recentWords).words.every((text) => fresh.has(text))).toBe(true);
    }
  });

  it('takes words of the last lessons again once the others are all in the lesson', () => {
    const focus = [WordError.D_MISSING];
    const withD = BANK.filter((item) => trainsErrorType(item, WordError.D_MISSING)).map((item) => item.text);
    const without = BANK.filter((item) => !trainsErrorType(item, WordError.D_MISSING)).map((item) => item.text);
    // Fewer fresh words than the smallest lesson needs: 10 that train the focus (it needs 18) and 5 others (it needs 9).
    const fresh = [...withD.slice(0, 10), ...without.slice(0, 5)];
    const recentWords = new Set(BANK.map((item) => item.text).filter((text) => !fresh.includes(text)));

    for (const seed of SEEDS) {
      const { words } = lessonOf(focus, seed, BANK, recentWords);
      const { trained, min, max } = focusShare(words, focus);

      expect(fresh.every((text) => words.includes(text))).toBe(true);
      expect(words.some((text) => recentWords.has(text))).toBe(true);
      // The bank still has enough words: no word twice, and the share holds.
      expect(new Set(words).size).toBe(words.length);
      expect(trained).toBeGreaterThanOrEqual(min);
      expect(trained).toBeLessThanOrEqual(max);
    }
  });

  it('repeats words when the bank is too small for a lesson, and keeps the share', () => {
    const focus = [WordError.D_MISSING];
    const bank = ['đi', 'đo', 'đều', 'em', 'anh'].map(word);

    for (const seed of SEEDS) {
      const { words } = lessonOf(focus, seed, bank);
      const { trained, min, max } = focusShare(words, focus);

      expect(words.length).toBeGreaterThanOrEqual(LESSON_MIN_WORDS);
      expect(words.length).toBeLessThanOrEqual(LESSON_MAX_WORDS);
      expect(bank.every((item) => words.includes(item.text))).toBe(true);
      expect(trained).toBeGreaterThanOrEqual(min);
      expect(trained).toBeLessThanOrEqual(max);
    }
  });

  it('makes every word train the focus when the bank has no other word', () => {
    const bank = ['đi', 'đo', 'đều'].map(word);

    const { words } = lessonOf([WordError.D_MISSING], 7, bank);

    expect(words.filter(trainsAny([WordError.D_MISSING])).length).toBe(words.length);
  });

  it('has nothing to aim at when no word of the bank trains the focus', () => {
    const bank = ['em', 'anh', 'hỏi'].map(word);

    expect(buildLesson({ focus: [WordError.D_MISSING], words: bank, recentWords: new Set() })).toBeNull();
    expect(buildLesson({ focus: [WordError.D_MISSING], words: [], recentWords: new Set() })).toBeNull();
  });

  it('trains only the types of the focus that have words in the bank', () => {
    const bank = ['em', 'anh', 'hỏi', 'nghĩ', 'mẹ'].map(word);

    const lesson = buildLesson({ focus: [WordError.D_MISSING, WordError.HOI_NGA_CONFUSION], words: bank, recentWords: new Set() });

    expect(lesson?.focus).toEqual([WordError.HOI_NGA_CONFUSION]);
  });
});

describe('lessonTitle', () => {
  it('names the error types of the lesson, the weakest first', () => {
    expect(lessonTitle([WordError.HOI_NGA_CONFUSION, WordError.D_MISSING])).toBe('Weak spots: hỏi / ngã, đ');
    expect(lessonTitle([WordError.TONE_WRONG])).toBe('Weak spots: tones');
    expect(lessonTitle([WordError.BASE_LETTER, WordError.MARK_WRONG])).toBe('Weak spots: letters, vowel marks');
  });
});
