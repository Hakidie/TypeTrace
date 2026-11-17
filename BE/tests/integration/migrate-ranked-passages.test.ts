import { describe, expect, it } from 'vitest';
import { ENGLISH_PLACEMENT_PASSAGE_LIST } from '../../src/data/passages-en-placement';
import { ENGLISH_PRACTICE_PASSAGE_LIST } from '../../src/data/passages-en-practice';
import { PassageModel } from '../../src/models/passage.model';
import { migrateRankedPassages } from '../../src/scripts/migrate-ranked-passages';
import { seedPassages } from '../../src/services/passage-seed.service';

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

  it('never marks the English passages of the other tests: placement (SCRUM-305) and practice (SCRUM-219)', async () => {
    await seedPassages(ENGLISH_PLACEMENT_PASSAGE_LIST);
    await seedPassages(ENGLISH_PRACTICE_PASSAGE_LIST);
    await PassageModel.create({ ...base, title: 'English placement by an admin', language: 'en', isPlacement: true });

    expect(await migrateRankedPassages()).toEqual({ updated: 0 });
    expect(await PassageModel.countDocuments({ isRanked: true })).toBe(0);
  });
});
