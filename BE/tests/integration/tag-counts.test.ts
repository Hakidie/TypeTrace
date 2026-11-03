import { describe, expect, it } from 'vitest';
import { computePassageStats, PassageModel } from '../../src/models/passage.model';
import { rebuildTagCounts } from '../../src/scripts/rebuild-tag-counts';

const english = { title: 'A quiet morning', content: 'The sun rose over the quiet town.', source: 'Written for TypeTrace', language: 'en' };
const vietnamese = { title: 'Buổi sáng', content: 'Đường về nhà rất đẹp.', source: 'Tự viết cho TypeTrace' };

/** The tags of an English passage saved before SCRUM-218: the Vietnamese types at 0 and no English type. */
const tagsBeforeEnglish = { BASE_LETTER: 0, TONE_WRONG: 0, D_MISSING: 0, MARK_WRONG: 0, HOI_NGA_CONFUSION: 0 };

/** An English passage as it was saved before SCRUM-218. */
const oldEnglishPassage = async () => {
  const passage = await PassageModel.create(english);
  await PassageModel.collection.updateOne({ _id: passage._id }, { $set: { tagCounts: tagsBeforeEnglish } });
  return passage;
};

describe('rebuildTagCounts (SCRUM-218)', () => {
  it('counts the English tags of an English passage saved before them', async () => {
    const passage = await oldEnglishPassage();

    expect(await rebuildTagCounts()).toEqual({ passages: 1, updated: 1 });
    const saved = await PassageModel.findById(passage._id).lean();
    expect(saved!.tagCounts).toEqual(computePassageStats(english.content, 'en').tagCounts);
    expect(saved!.tagCounts.LETTER_EXTRA).toBe(7);
  });

  it('counts a passage saved before the language field as Vietnamese', async () => {
    const now = new Date();
    const { insertedId } = await PassageModel.collection.insertOne({ ...vietnamese, status: 'published', visibility: 'public', createdAt: now, updatedAt: now });

    await rebuildTagCounts();
    expect(await PassageModel.findById(insertedId).lean()).toMatchObject(computePassageStats(vietnamese.content, 'vi'));
  });

  it('keeps updatedAt, which orders the review queue, and changes nothing on a second run', async () => {
    const passage = await oldEnglishPassage();
    await PassageModel.create(vietnamese);

    expect(await rebuildTagCounts()).toEqual({ passages: 2, updated: 1 });
    expect((await PassageModel.findById(passage._id))!.updatedAt).toEqual(passage.updatedAt);
    expect(await rebuildTagCounts()).toEqual({ passages: 2, updated: 0 });
  });

  it('does nothing without passages', async () => {
    expect(await rebuildTagCounts()).toEqual({ passages: 0, updated: 0 });
  });
});
