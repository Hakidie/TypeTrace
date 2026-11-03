import { describe, expect, it } from 'vitest';
import { ownerFieldsFor, PassageModel, SYSTEM_OWNER_NAME } from '../../src/models/passage.model';
import { createUser } from '../helpers/user-factory';

const base = { title: 'Buổi sáng', content: 'Đường về nhà rất đẹp.', source: 'Tự viết cho TypeTrace' };

describe('PassageModel', () => {
  it('fills the defaults: public, draft, not a placement passage', async () => {
    const passage = await PassageModel.create(base);

    expect(passage).toMatchObject({ visibility: 'public', status: 'draft', isPlacement: false });
    expect(passage.owner).toBeUndefined();
  });

  it('belongs to TypeTrace when it has no author', async () => {
    const passage = await PassageModel.create(base);

    expect(passage.ownerName).toBe(SYSTEM_OWNER_NAME);
  });

  it('computes the word count and the tag counts from the content on create', async () => {
    const passage = await PassageModel.create(base);

    expect(passage.wordCount).toBe(5);
    expect(passage.tagCounts).toMatchObject({ BASE_LETTER: 5, TONE_WRONG: 5, D_MISSING: 2, MARK_WRONG: 3, HOI_NGA_CONFUSION: 0 });
  });

  it('ignores word counts and tag counts sent by the caller', async () => {
    const passage = await PassageModel.create({ ...base, wordCount: 999, tagCounts: { BASE_LETTER: 999 } });

    expect(passage.wordCount).toBe(5);
    expect(passage.tagCounts.BASE_LETTER).toBe(5);
  });

  it('computes them again when the content changes, and only then', async () => {
    const passage = await PassageModel.create(base);

    passage.content = 'Một hai ba.';
    await passage.save();
    expect(passage.wordCount).toBe(3);

    passage.title = 'Tên mới';
    await passage.save();
    expect(passage.wordCount).toBe(3);
  });

  it('requires a title, content and a source, and rejects unknown visibility or status', async () => {
    await expect(PassageModel.create({ ...base, source: '' })).rejects.toThrow();
    await expect(PassageModel.create({ ...base, title: '' })).rejects.toThrow();
    await expect(PassageModel.create({ ...base, content: '  ' })).rejects.toThrow();
    await expect(PassageModel.create({ ...base, visibility: 'friends' })).rejects.toThrow();
    await expect(PassageModel.create({ ...base, status: 'deleted' })).rejects.toThrow();
  });

  it('stores the owner of a passage a user wrote and hides __v in JSON', async () => {
    const user = await createUser({});
    const passage = await PassageModel.create({ ...base, owner: user._id, visibility: 'private' });

    expect(String(passage.owner)).toBe(String(user._id));
    expect(passage.toJSON()).not.toHaveProperty('__v');
  });

  it('shows system and admin passages as TypeTrace and learner passages under their own name', async () => {
    const admin = await createUser({ email: 'admin@example.com', role: 'admin' });
    const learner = await createUser({ displayName: 'Lan' });
    const unnamed = await createUser({ email: 'unnamed@example.com' });

    expect(ownerFieldsFor()).toEqual({ ownerName: 'TypeTrace' });
    expect(ownerFieldsFor({ id: String(admin._id), role: admin.role, email: admin.email })).toEqual({
      owner: String(admin._id),
      ownerName: 'TypeTrace'
    });
    expect(
      ownerFieldsFor({ id: String(learner._id), role: learner.role, displayName: 'Lan', email: learner.email })
    ).toEqual({ owner: String(learner._id), ownerName: 'Lan' });
    expect(ownerFieldsFor({ id: String(unnamed._id), role: unnamed.role, email: unnamed.email }).ownerName).toBe(
      'unnamed@example.com'
    );
  });

  it('keeps the id of the admin who created a passage that is shown as TypeTrace', async () => {
    const admin = await createUser({ email: 'admin@example.com', role: 'admin' });

    const passage = await PassageModel.create({
      ...base,
      ...ownerFieldsFor({ id: String(admin._id), role: admin.role, email: admin.email })
    });

    expect(String(passage.owner)).toBe(String(admin._id));
    expect(passage.ownerName).toBe('TypeTrace');
  });
});

describe('PassageModel language (ranked duel, phase 1)', () => {
  it('is Vietnamese by default', async () => {
    const passage = await PassageModel.create(base);

    expect(passage.language).toBe('vi');
  });

  it('counts the English error tags of an English passage, and no Vietnamese ones (SCRUM-218)', async () => {
    const passage = await PassageModel.create({ ...base, language: 'en', content: "I saw a cat - it ran, didn't it?" });

    expect(passage.wordCount).toBe(9);
    expect(passage.tagCounts).toMatchObject({
      BASE_LETTER: 0,
      TONE_WRONG: 0,
      D_MISSING: 0,
      MARK_WRONG: 0,
      HOI_NGA_CONFUSION: 0,
      // Every word can get a letter too many; `-` has no letter to get wrong, leave out or type in the wrong case.
      LETTER_EXTRA: 9,
      LETTER_WRONG: 8,
      LETTER_MISSING: 8,
      CASE_WRONG: 8,
      // Not `I`, `a` and `-`: no two different letters side by side.
      LETTERS_SWAPPED: 6,
      PUNCTUATION_WRONG: 4
    });
  });

  it('counts no English error tags in a Vietnamese passage', async () => {
    const passage = await PassageModel.create(base);

    expect(passage.tagCounts).toMatchObject({ LETTER_WRONG: 0, LETTER_MISSING: 0, LETTER_EXTRA: 0, LETTERS_SWAPPED: 0, CASE_WRONG: 0, PUNCTUATION_WRONG: 0 });
  });
});

describe('ranked passages (US6.4)', () => {
  it('is not ranked by default, and has an index on isRanked and status', async () => {
    const passage = await PassageModel.create(base);
    await PassageModel.init();

    expect(passage.isRanked).toBe(false);
    const indexes = await PassageModel.collection.indexes();
    expect(indexes.some((index) => JSON.stringify(index.key) === JSON.stringify({ isRanked: 1, status: 1 }))).toBe(true);
  });
});
