import { describe, expect, it } from 'vitest';
import { PASSAGE_LIST, PASSAGE_SOURCE } from '../../src/data/passages';
import { ENGLISH_PASSAGE_LIST, ENGLISH_PASSAGE_SOURCE } from '../../src/data/passages-en';
import { PassageModel, splitWords } from '../../src/models/passage.model';
import { seedPassages } from '../../src/services/passage-seed.service';
import { WordError } from '../../src/utils/vietnamese-errors';

const sample = { title: 'Một đoạn', content: 'Đường về nhà rất đẹp.', source: 'Tự viết' };

describe('seedPassages', () => {
  it('adds passages with their source, owned by TypeTrace, with computed counts', async () => {
    const result = await seedPassages([sample]);

    expect(result).toEqual({ added: 1, skipped: 0 });
    const saved = await PassageModel.findOne({ title: 'Một đoạn' });
    expect(saved).toMatchObject({ source: 'Tự viết', ownerName: 'TypeTrace', wordCount: 5, isPlacement: false, status: 'published' });
    expect(saved!.owner).toBeUndefined();
    expect(saved!.tagCounts.D_MISSING).toBe(2);
  });

  it('can run many times without creating duplicates', async () => {
    await seedPassages([sample]);
    const second = await seedPassages([sample, { ...sample, title: 'Đoạn khác' }]);

    expect(second).toEqual({ added: 1, skipped: 1 });
    expect(await PassageModel.countDocuments()).toBe(2);
  });

  it('does not overwrite a passage that was edited or hidden', async () => {
    await seedPassages([sample]);
    await PassageModel.updateOne({ title: sample.title }, { status: 'archived', source: 'Nguồn mới' });

    await seedPassages([sample]);

    expect(await PassageModel.findOne({ title: sample.title })).toMatchObject({
      status: 'archived',
      source: 'Nguồn mới'
    });
  });

  it('moves passages saved with the old active/inactive statuses to published/archived', async () => {
    await seedPassages([sample, { ...sample, title: 'Đoạn khác' }]);
    await PassageModel.collection.updateOne({ title: sample.title }, { $set: { status: 'active' } });
    await PassageModel.collection.updateOne({ title: 'Đoạn khác' }, { $set: { status: 'inactive' } });

    await seedPassages([sample, { ...sample, title: 'Đoạn khác' }]);

    expect((await PassageModel.findOne({ title: sample.title }))!.status).toBe('published');
    expect((await PassageModel.findOne({ title: 'Đoạn khác' }))!.status).toBe('archived');
  });

  it('refuses a passage without a source and adds nothing', async () => {
    await expect(seedPassages([sample, { ...sample, title: 'Không nguồn', source: ' ' }])).rejects.toThrow(/no source/);

    expect(await PassageModel.countDocuments()).toBe(0);
  });
});

describe('the starter passages', () => {
  it('all name their source and have unique titles', () => {
    expect(PASSAGE_LIST.every((passage) => passage.source.trim() === PASSAGE_SOURCE)).toBe(true);
    expect(new Set(PASSAGE_LIST.map((passage) => passage.title)).size).toBe(PASSAGE_LIST.length);
  });

  it('have at least 3 placement passages, each with at least 20 opportunities for every error type', async () => {
    await seedPassages(PASSAGE_LIST);

    const placement = await PassageModel.find({ isPlacement: true });
    expect(placement.length).toBeGreaterThanOrEqual(3);
    for (const passage of placement) {
      for (const type of Object.values(WordError)) {
        expect(passage.tagCounts[type], `${passage.title}: ${type}`).toBeGreaterThanOrEqual(20);
      }
    }
  });

  it('import twice without duplicates', async () => {
    const first = await seedPassages(PASSAGE_LIST);
    const second = await seedPassages(PASSAGE_LIST);

    expect(first.added).toBe(PASSAGE_LIST.length);
    expect(second).toEqual({ added: 0, skipped: PASSAGE_LIST.length });
  });
});

describe('English starter passages (ranked duel, phase 1)', () => {
  it('ships 20 English starter passages that a ranked match can use', () => {
    expect(ENGLISH_PASSAGE_LIST).toHaveLength(20);
    for (const passage of ENGLISH_PASSAGE_LIST) {
      const words = splitWords(passage.content).length;
      expect(passage.language).toBe('en');
      expect(words, passage.title).toBeGreaterThanOrEqual(30);
      expect(words, passage.title).toBeLessThanOrEqual(80);
      expect(passage.content, passage.title).toMatch(/^[\x20-\x7E]+$/);
      expect(passage.source).toBe(ENGLISH_PASSAGE_SOURCE);
      expect(passage.isPlacement).toBeUndefined();
    }
    const titles = ENGLISH_PASSAGE_LIST.map((passage) => passage.title);
    expect(new Set(titles).size).toBe(titles.length);
    expect(titles.filter((title) => PASSAGE_LIST.some((passage) => passage.title === title))).toEqual([]);
  });

  it('seeds the English passages as published and public', async () => {
    expect((await seedPassages(ENGLISH_PASSAGE_LIST)).added).toBe(20);

    const saved = await PassageModel.find({ title: { $in: ENGLISH_PASSAGE_LIST.map((passage) => passage.title) } });
    expect(saved).toHaveLength(20);
    expect(saved.every((passage) => passage.language === 'en' && passage.status === 'published' && passage.visibility === 'public')).toBe(true);
  });

  it('does not duplicate or overwrite English passages on a second run', async () => {
    await seedPassages(ENGLISH_PASSAGE_LIST);
    const edited = await PassageModel.findOneAndUpdate({ title: ENGLISH_PASSAGE_LIST[0].title }, { content: 'Edited by an admin.' }, { returnDocument: 'after' });

    expect(await seedPassages(ENGLISH_PASSAGE_LIST)).toEqual({ added: 0, skipped: 20 });
    expect((await PassageModel.findById(edited!._id))!.content).toBe('Edited by an admin.');
  });
});
