import { beforeAll, describe, expect, it } from 'vitest';
import { WORD_LIST } from '../../src/data/words';
import { WordModel } from '../../src/models/word.model';
import { importWords } from '../../src/services/word-import.service';
import { WordError } from '../../src/utils/vietnamese-errors';

describe('importWords', () => {
  beforeAll(() => WordModel.init());

  it('adds normalised, tagged words', async () => {
    const result = await importWords(['Đường', 'nhà']);

    expect(result).toEqual({ added: 2, skipped: 0, invalid: 0 });
    const word = await WordModel.findOne({ text: 'đường' });
    expect(word).toMatchObject({ isActive: true });
    expect(word!.tags).toEqual(expect.arrayContaining(['D_MISSING', 'MARK_WRONG']));
    expect((await WordModel.findOne({ text: 'nhà' }))!.tags).not.toContain('D_MISSING');
  });

  it('merges duplicates written in another case or Unicode form', async () => {
    const result = await importWords(['tiếng', 'Tiếng', 'tiếng'.normalize('NFD'), 'TIẾNG']);

    expect(result).toEqual({ added: 1, skipped: 0, invalid: 0 });
    expect(await WordModel.countDocuments()).toBe(1);
  });

  it('counts empty entries and entries with spaces as invalid', async () => {
    const result = await importWords(['', '   ', 'hai từ', 'đẹp']);

    expect(result).toEqual({ added: 1, skipped: 0, invalid: 3 });
  });

  it('does nothing for an empty list', async () => {
    expect(await importWords([])).toEqual({ added: 0, skipped: 0, invalid: 0 });
  });

  it('can run many times without creating duplicates', async () => {
    await importWords(['đường', 'đẹp']);
    const second = await importWords(['đường', 'đẹp', 'nhà']);

    expect(second).toEqual({ added: 1, skipped: 2, invalid: 0 });
    expect(await WordModel.countDocuments()).toBe(3);
  });

  it('keeps a word an admin hid hidden, and keeps its tags', async () => {
    await importWords(['đường']);
    await WordModel.updateOne({ text: 'đường' }, { isActive: false });

    await importWords(['đường']);

    const word = await WordModel.findOne({ text: 'đường' });
    expect(word!.isActive).toBe(false);
    expect(word!.tags).toContain('D_MISSING');
  });
});

describe('the starter word list', () => {
  it('imports cleanly twice, with no invalid entries', async () => {
    const first = await importWords(WORD_LIST);
    const second = await importWords(WORD_LIST);

    expect(first.invalid).toBe(0);
    expect(first.added).toBeGreaterThan(200);
    expect(second).toEqual({ added: 0, skipped: first.added, invalid: 0 });
    expect(await WordModel.countDocuments()).toBe(first.added);
  });

  it('has at least 20 words for every error type', async () => {
    await importWords(WORD_LIST);

    for (const type of Object.values(WordError)) {
      expect(await WordModel.countDocuments({ tags: type }), type).toBeGreaterThanOrEqual(20);
    }
  });
});
