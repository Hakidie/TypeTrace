import { beforeAll, describe, expect, it } from 'vitest';
import { normalizeWord, WordModel } from '../../src/models/word.model';

describe('WordModel', () => {
  beforeAll(() => WordModel.init()); // builds the unique index before the duplicate tests

  it('is active by default and hides __v in JSON', async () => {
    const word = await WordModel.create({ text: 'đường' });

    expect(word.isActive).toBe(true);
    expect(word.toJSON()).not.toHaveProperty('__v');
  });

  it('tags the word from its text', async () => {
    const word = await WordModel.create({ text: 'đường' });

    expect(word.tags).toEqual(expect.arrayContaining(['BASE_LETTER', 'TONE_WRONG', 'D_MISSING', 'MARK_WRONG']));
    expect(word.tags).not.toContain('HOI_NGA_CONFUSION');
  });

  it('ignores tags sent by the caller and tags again when the text changes', async () => {
    const word = await WordModel.create({ text: 'nhà', tags: ['D_MISSING'] });
    expect(word.tags).not.toContain('D_MISSING');

    word.text = 'đẹp';
    await word.save();
    expect(word.tags).toContain('D_MISSING');
  });

  it('stores the text in lowercase and trimmed', async () => {
    const word = await WordModel.create({ text: '  Đường ' });

    expect(word.text).toBe('đường');
  });

  it('rejects a duplicate, even when it is written in another Unicode form or case', async () => {
    const composed = 'tiếng'.normalize('NFC');
    const decomposed = 'tiếng'.normalize('NFD');
    expect(decomposed).not.toBe(composed); // two different strings for the same word

    await WordModel.create({ text: composed });

    await expect(WordModel.create({ text: decomposed })).rejects.toThrow(/duplicate key/);
    await expect(WordModel.create({ text: 'TIẾNG' })).rejects.toThrow(/duplicate key/);
    expect(await WordModel.countDocuments()).toBe(1);
  });

  it('requires one word without spaces', async () => {
    await expect(WordModel.create({})).rejects.toThrow();
    await expect(WordModel.create({ text: '   ' })).rejects.toThrow();
    await expect(WordModel.create({ text: 'hai từ' })).rejects.toThrow();
  });

  it('keeps a hidden word in the bank, out of the active query', async () => {
    await WordModel.create({ text: 'đẹp' });
    await WordModel.create({ text: 'xấu', isActive: false });

    const active = await WordModel.find({ isActive: true });

    expect(active.map((word) => word.text)).toEqual(['đẹp']);
    expect(await WordModel.countDocuments()).toBe(2);
  });
});

describe('normalizeWord', () => {
  it('joins the two Unicode forms and lowercases', () => {
    expect(normalizeWord('Tiếng'.normalize('NFD'))).toBe('tiếng'.normalize('NFC'));
  });
});
