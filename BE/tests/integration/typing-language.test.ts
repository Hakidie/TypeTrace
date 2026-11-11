import { beforeEach, describe, expect, it } from 'vitest';
import { PASSAGE_LIST } from '../../src/data/passages';
import { ENGLISH_PASSAGE_LIST } from '../../src/data/passages-en';
import { ENGLISH_PRACTICE_PASSAGE_LIST } from '../../src/data/passages-en-practice';
import { PassageModel } from '../../src/models/passage.model';
import { TypingSessionModel } from '../../src/models/typing-session.model';
import { UserModel } from '../../src/models/user.model';
import { getWeakErrorTypes } from '../../src/services/error-profile.service';
import { seedPassages } from '../../src/services/passage-seed.service';
import { rainWordsFor } from '../../src/services/rain.service';
import { typingActivityOf } from '../../src/services/typing-session.service';
import { EnglishError } from '../../src/utils/english-errors';
import { WordError } from '../../src/utils/vietnamese-errors';
import { api } from '../helpers/api';
import { bearerFor, createUser } from '../helpers/user-factory';

type Learner = Awaited<ReturnType<typeof createUser>>;

const PRACTICE_TITLES = ENGLISH_PRACTICE_PASSAGE_LIST.map((passage) => passage.title);
const RANKED_TITLES = ENGLISH_PASSAGE_LIST.map((passage) => passage.title);

const setLanguage = (learner: Learner, typingLanguage: string) =>
  api().patch('/api/profile/settings').set('Authorization', bearerFor(learner)).send({ typingLanguage });

const startSession = (learner: Learner, body: Record<string, unknown> = {}) =>
  api().post('/api/sessions').set('Authorization', bearerFor(learner)).send(body);

const idOf = async (title: string) => String((await PassageModel.findOne({ title }))!._id);

/** An English learner: their Practice language saved as `en`. */
const englishLearner = async (email = 'english@example.com') => {
  const learner = await createUser({ email });
  await setLanguage(learner, 'en');
  return learner;
};

/** A counted session of `language` completed `minutesAgo` minutes ago with `[errors, chances]` of the types given, written straight to the database. */
const countedSession = (
  owner: unknown,
  minutesAgo: number,
  language: 'vi' | 'en',
  wpm: number,
  counts: Record<string, readonly [number, number]>
) => ({
  owner,
  language,
  passageId: 'p1',
  targetWords: ['a'],
  status: 'completed',
  isCounted: true,
  completedAt: new Date(Date.now() - minutesAgo * 60_000),
  durationMs: 60_000,
  wpm,
  accuracy: 90,
  errorCounts: Object.fromEntries(Object.entries(counts).map(([type, [errors]]) => [type, errors])),
  opportunityCounts: Object.fromEntries(Object.entries(counts).map(([type, [, chances]]) => [type, chances]))
});

// The tests start with an empty database: the Vietnamese passages, the ranked duels' English ones and the English practice ones.
beforeEach(async () => {
  await seedPassages(PASSAGE_LIST);
  await seedPassages(ENGLISH_PASSAGE_LIST);
  await seedPassages(ENGLISH_PRACTICE_PASSAGE_LIST);
});

describe('the typing language of a learner (SCRUM-219)', () => {
  it('is Vietnamese by default and changes alone or with the time zone, keeping the other settings', async () => {
    const learner = await createUser({});
    expect((await api().get('/api/auth/me').set('Authorization', bearerFor(learner))).body.settings.typingLanguage).toBe('vi');

    const english = await setLanguage(learner, 'en');
    expect(english.status).toBe(200);
    expect(english.body.settings).toMatchObject({ typingLanguage: 'en', timezone: 'Asia/Ho_Chi_Minh' });

    const both = await api().patch('/api/profile/settings').set('Authorization', bearerFor(learner)).send({ timezone: 'UTC', typingLanguage: 'vi' });
    expect(both.body.settings).toMatchObject({ typingLanguage: 'vi', timezone: 'UTC' });

    // The browser's time zone alone leaves the language as it is.
    await setLanguage(learner, 'en');
    await api().patch('/api/profile/settings').set('Authorization', bearerFor(learner)).send({ timezone: 'Asia/Tokyo' });
    expect((await UserModel.findById(learner._id))!.settings).toMatchObject({ typingLanguage: 'en', timezone: 'Asia/Tokyo' });
  });

  it('refuses a language the app does not have', async () => {
    const learner = await createUser({});

    const response = await setLanguage(learner, 'fr');

    expect(response.status).toBe(400);
    expect(response.body.errors[0].field).toBe('typingLanguage');
    expect((await UserModel.findById(learner._id))!.settings.typingLanguage).toBe('vi');
  });
});

describe('Practice in the learner typing language (SCRUM-219)', () => {
  it('types an English practice passage for an English learner, never a ranked or a Vietnamese one', async () => {
    const learner = await englishLearner();

    const seen = new Set<string>();
    for (let i = 0; i < 25; i += 1) {
      const { status, body } = await startSession(learner);
      expect(status).toBe(201);
      expect(body.language).toBe('en');
      seen.add(body.passageTitle);
    }

    expect([...seen].every((title) => PRACTICE_TITLES.includes(title))).toBe(true);
    expect(seen.size).toBeGreaterThan(1);
  });

  it('types a Vietnamese passage for a Vietnamese learner, never an English one', async () => {
    const learner = await createUser({});

    for (let i = 0; i < 10; i += 1) {
      const { body } = await startSession(learner);
      expect(body.language).toBe('vi');
      expect([...PRACTICE_TITLES, ...RANKED_TITLES]).not.toContain(body.passageTitle);
    }
  });

  it('refuses a passage of the other language and a ranked one (400)', async () => {
    const english = await englishLearner();
    const vietnamese = await createUser({ email: 'vi@example.com' });

    expect((await startSession(english, { passageId: await idOf('Tiếng Việt rất đẹp') })).status).toBe(400);
    expect((await startSession(english, { passageId: await idOf(RANKED_TITLES[0]) })).status).toBe(400);
    expect((await startSession(vietnamese, { passageId: await idOf(PRACTICE_TITLES[0]) })).status).toBe(400);
    expect((await startSession(english, { passageId: await idOf(PRACTICE_TITLES[0]) })).status).toBe(201);
  });

  it('keeps the placement test Vietnamese for an English learner', async () => {
    const learner = await englishLearner();

    const { status, body } = await startSession(learner, { mode: 'placement' });

    expect(status).toBe(201);
    expect(body).toMatchObject({ mode: 'placement', language: 'vi' });
    expect(await PassageModel.findById(body.passageId)).toMatchObject({ isPlacement: true });
  });

  it('lists the English practice passages with language=en, and the Vietnamese ones without it', async () => {
    const learner = await englishLearner();
    const list = (query: string) => api().get(`/api/passages?mode=practice&limit=100${query}`).set('Authorization', bearerFor(learner));

    const english = await list('&language=en');
    const vietnamese = await list('');

    expect(english.status).toBe(200);
    expect(english.body.items.map((item: { title: string }) => item.title).sort()).toEqual([...PRACTICE_TITLES].sort());
    expect(vietnamese.body.items.length).toBeGreaterThan(0);
    expect(vietnamese.body.items.some((item: { title: string }) => [...PRACTICE_TITLES, ...RANKED_TITLES].includes(item.title))).toBe(false);
    expect((await list('&language=fr')).status).toBe(400);
  });

  it('grades an English session with the English error set and stores only its types', async () => {
    const learner = await englishLearner();
    const { body: started } = await startSession(learner, { passageId: await idOf('Watering the Plants') });
    await TypingSessionModel.findByIdAndUpdate(started._id, { startedAt: new Date(Date.now() - 120_000) });
    // "Every evening Lan fills a small blue can and walks along the balcony."
    const typed = ['every', 'evenign', ...started.targetWords.slice(2, 12), 'balcony'];

    const { status, body } = await api()
      .patch(`/api/sessions/${started._id}/complete`)
      .set('Authorization', bearerFor(learner))
      .send({ typedWords: typed });

    expect(status).toBe(200);
    expect(body.words[0].errorTypes).toEqual(['CASE_WRONG']);
    expect(body.words[1].errorTypes).toEqual(['LETTERS_SWAPPED']);
    expect(body.words[12]).toMatchObject({ target: 'balcony.', errorTypes: ['PUNCTUATION_WRONG'] });
    expect(body.words.slice(2, 12).every((word: { errorTypes: string[] }) => word.errorTypes.length === 0)).toBe(true);
    expect(Object.keys(body.errorCounts).sort()).toEqual(Object.values(EnglishError).sort());
    expect(Object.keys(body.opportunityCounts).sort()).toEqual(Object.values(EnglishError).sort());
    expect(body.errorCounts).toMatchObject({ CASE_WRONG: 1, LETTERS_SWAPPED: 1, PUNCTUATION_WRONG: 1 });

    const stats = await api().get(`/api/sessions/${started._id}/stats`).set('Authorization', bearerFor(learner));
    expect(stats.body.errorTypes.every(({ type }: { type: string }) => (Object.values(EnglishError) as string[]).includes(type))).toBe(true);
  });

  it('still stores only the Vietnamese types for a Vietnamese session', async () => {
    const learner = await createUser({});
    const { body: started } = await startSession(learner, { passageId: await idOf('Tiếng Việt rất đẹp') });

    const { body } = await api()
      .patch(`/api/sessions/${started._id}/complete`)
      .set('Authorization', bearerFor(learner))
      .send({ typedWords: started.targetWords.slice(0, 3) });

    expect(body.language).toBe('vi');
    expect(Object.keys(body.errorCounts).sort()).toEqual(Object.values(WordError).sort());
  });
});

describe('the stats of each typing language (SCRUM-219)', () => {
  it('gives the error profile of the learner language, or of the one asked, from its own sessions only', async () => {
    const learner = await createUser({});
    await TypingSessionModel.create([
      countedSession(learner._id, 1, 'en', 60, { LETTER_WRONG: [10, 40] }),
      countedSession(learner._id, 2, 'vi', 30, { HOI_NGA_CONFUSION: [10, 40] })
    ]);
    // A session saved before the language field: Vietnamese.
    await TypingSessionModel.collection.insertOne({ ...countedSession(learner._id, 3, 'vi', 30, { D_MISSING: [8, 40] }), language: undefined });
    const profile = (query = '') => api().get(`/api/profile/error-profile${query}`).set('Authorization', bearerFor(learner));

    const vietnamese = (await profile()).body;
    expect(vietnamese).toMatchObject({ language: 'vi', sessionsUsed: 2, weakTypes: ['HOI_NGA_CONFUSION', 'D_MISSING'] });
    expect(vietnamese.types.map(({ type }: { type: string }) => type)).toEqual(Object.values(WordError));

    const english = (await profile('?language=en')).body;
    expect(english).toMatchObject({ language: 'en', sessionsUsed: 1, weakTypes: ['LETTER_WRONG'] });
    expect(english.types.map(({ type }: { type: string }) => type)).toEqual(Object.values(EnglishError));

    await setLanguage(learner, 'en');
    expect((await profile()).body.language).toBe('en');
    expect((await profile('?language=xx')).status).toBe(400);
  });

  it('averages WPM and accuracy of one language on the profile, and only Vietnamese in the admin user list', async () => {
    const learner = await createUser({});
    await TypingSessionModel.create([countedSession(learner._id, 1, 'en', 60, {}), countedSession(learner._id, 2, 'vi', 30, {})]);
    const activity = (query = '') => api().get(`/api/sessions/activity${query}`).set('Authorization', bearerFor(learner));

    expect((await activity()).body).toMatchObject({ language: 'vi', stats: { wpm: 30 } });
    expect((await activity('?language=en')).body).toMatchObject({ language: 'en', stats: { wpm: 60 } });
    expect((await typingActivityOf([learner._id]))(learner._id).stats).toMatchObject({ wpm: 30 });
  });

  it('starts the English progress chart at the first counted English session, without a placement test', async () => {
    const learner = await createUser({});
    await TypingSessionModel.create(countedSession(learner._id, 1, 'en', 60, {}));
    const progress = (language: string) =>
      api().get(`/api/profile/monthly-progress?range=week&language=${language}`).set('Authorization', bearerFor(learner));

    const english = (await progress('en')).body;
    const vietnamese = (await progress('vi')).body;

    expect(english.language).toBe('en');
    expect(english.points.some((point: { avgWpm: number | null }) => point.avgWpm === 60)).toBe(true);
    expect(vietnamese.points.every((point: { avgWpm: number | null }) => point.avgWpm === null)).toBe(true);
  });

  it('keeps the Vietnamese features (weak spots, word rain) on Vietnamese sessions when English ones are newer', async () => {
    const learner = await createUser({});
    await TypingSessionModel.create(countedSession(learner._id, 30, 'vi', 30, { HOI_NGA_CONFUSION: [10, 40], D_MISSING: [3, 40] }));
    await TypingSessionModel.create(Array.from({ length: 12 }, (_, index) => countedSession(learner._id, index + 1, 'en', 60, { LETTER_WRONG: [9, 40] })));

    expect(await getWeakErrorTypes(String(learner._id))).toEqual(['HOI_NGA_CONFUSION']);
    expect((await rainWordsFor(String(learner._id))).focus).toEqual(['HOI_NGA_CONFUSION', 'D_MISSING']);
  });

  it('answers 404 for the stats of an account that no longer exists', async () => {
    const learner = await createUser({});
    const token = bearerFor(learner);
    await UserModel.deleteOne({ _id: learner._id });

    expect((await api().get('/api/profile/error-profile').set('Authorization', token)).status).toBe(404);
    expect((await api().get('/api/profile/monthly-progress?language=en').set('Authorization', token)).status).toBe(404);
  });
});
