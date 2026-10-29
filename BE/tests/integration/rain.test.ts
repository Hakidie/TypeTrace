import { describe, expect, it } from 'vitest';
import { TypingSessionModel } from '../../src/models/typing-session.model';
import { WordModel } from '../../src/models/word.model';
import { api } from '../helpers/api';
import { bearerFor, createUser } from '../helpers/user-factory';

const getWords = (authorization: string) => api().get('/api/rain/words').set('Authorization', authorization);

/** A completed, counted session of `owner` with these error counts (the rest of the session does not matter here). */
const sessionWith = (owner: unknown, errorCounts: Record<string, number>) =>
  TypingSessionModel.create({ owner, passageId: 'p', targetWords: ['x'], status: 'completed', completedAt: new Date(), isCounted: true, errorCounts });

describe('GET /api/rain/words', () => {
  it('answers 401 without a token', async () => {
    expect((await api().get('/api/rain/words')).status).toBe(401);
  });

  it('answers an empty list when the bank is empty', async () => {
    const response = await getWords(bearerFor(await createUser()));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ words: [], focus: [] });
  });

  it('returns active words of 2 to 12 letters only', async () => {
    await WordModel.create([{ text: 'a' }, { text: 'nhà' }, { text: 'mười' }, { text: 'abcdefghijklm' }, { text: 'tắt', isActive: false }]);

    const response = await getWords(bearerFor(await createUser()));

    expect(response.body.words.sort()).toEqual(['mười', 'nhà'].sort());
    expect(response.body.focus).toEqual([]);
  });

  it("leans on the error types of the user's recent sessions", async () => {
    const user = await createUser();
    const tone = ['bạn', 'bến', 'cá', 'cũ', 'dễ', 'gà', 'hồ', 'kẻ', 'lá', 'mẹ', 'nó', 'ổi', 'phố', 'quả', 'rổ', 'sổ', 'tủ', 'vẽ', 'xế', 'yếm'];
    await WordModel.create(tone.map((text) => ({ text })));
    await WordModel.create(Array.from({ length: 60 }, (_, i) => ({ text: `ab${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}` })));
    await sessionWith(user._id, { TONE_WRONG: 3, D_MISSING: 1 });

    const response = await getWords(bearerFor(user));

    expect(response.body.focus[0]).toBe('TONE_WRONG');
    const tagged = await WordModel.find({ text: { $in: response.body.words }, tags: 'TONE_WRONG' });
    expect(tagged.length).toBeGreaterThanOrEqual(20);
  });

  it("ignores other users' sessions", async () => {
    await WordModel.create([{ text: 'nhà' }, { text: 'cửa' }]);
    const other = await createUser({ email: 'other@example.com' });
    await sessionWith(other._id, { TONE_WRONG: 5 });

    const response = await getWords(bearerFor(await createUser()));

    expect(response.body.focus).toEqual([]);
  });

  it('returns each word once', async () => {
    const user = await createUser();
    await WordModel.create([{ text: 'bạn' }, { text: 'cá' }, { text: 'nhà' }]);
    await sessionWith(user._id, { TONE_WRONG: 2 });

    const { words } = (await getWords(bearerFor(user))).body;

    expect(new Set(words).size).toBe(words.length);
    expect(words).toHaveLength(3);
  });
});
