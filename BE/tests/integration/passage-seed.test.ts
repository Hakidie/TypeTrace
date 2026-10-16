import { describe, expect, it } from 'vitest';
import { PASSAGE_LIST, PASSAGE_SOURCE } from '../../src/data/passages';
import { PassageModel } from '../../src/models/passage.model';
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

  it('have exactly one placement passage with at least 20 opportunities for every error type', async () => {
    await seedPassages(PASSAGE_LIST);

    const placement = await PassageModel.find({ isPlacement: true });
    expect(placement).toHaveLength(1);
    for (const type of Object.values(WordError)) {
      expect(placement[0].tagCounts[type], type).toBeGreaterThanOrEqual(20);
    }
  });

  it('import twice without duplicates', async () => {
    const first = await seedPassages(PASSAGE_LIST);
    const second = await seedPassages(PASSAGE_LIST);

    expect(first.added).toBe(PASSAGE_LIST.length);
    expect(second).toEqual({ added: 0, skipped: PASSAGE_LIST.length });
  });
});
