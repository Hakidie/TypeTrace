import { describe, expect, it } from 'vitest';
import { PassageModel } from '../../src/models/passage.model';
import { migrateRankedPassages } from '../../src/scripts/migrate-ranked-passages';

const base = { content: 'The sun rose over the quiet town.', source: 'Written for TypeTrace', status: 'published', visibility: 'public' };

describe('migrate:ranked-passages', () => {
  it('marks the published public English passages and leaves the others alone, on every run', async () => {
    await PassageModel.create([
      { ...base, title: 'English', language: 'en' },
      { ...base, title: 'Vietnamese', language: 'vi', content: 'Đường về nhà rất đẹp.' },
      { ...base, title: 'English draft', language: 'en', status: 'draft' },
      { ...base, title: 'English private', language: 'en', visibility: 'private' }
    ]);

    expect(await migrateRankedPassages()).toEqual({ updated: 1 });
    expect(await migrateRankedPassages()).toEqual({ updated: 0 });
    const ranked = await PassageModel.find({ isRanked: true });
    expect(ranked.map((passage) => passage.title)).toEqual(['English']);
  });
});
