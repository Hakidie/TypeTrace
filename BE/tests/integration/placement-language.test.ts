import { beforeEach, describe, expect, it } from 'vitest';
import { PASSAGE_LIST } from '../../src/data/passages';
import { ENGLISH_PASSAGE_LIST } from '../../src/data/passages-en';
import { ENGLISH_PLACEMENT_PASSAGE_LIST } from '../../src/data/passages-en-placement';
import { ENGLISH_PRACTICE_PASSAGE_LIST } from '../../src/data/passages-en-practice';
import { PassageModel } from '../../src/models/passage.model';
import { TypingSessionModel } from '../../src/models/typing-session.model';
import { seedPassages } from '../../src/services/passage-seed.service';
import { EnglishError } from '../../src/utils/english-errors';
import { WordError } from '../../src/utils/vietnamese-errors';
import { api } from '../helpers/api';
import { bearerFor, createUser } from '../helpers/user-factory';

type Learner = Awaited<ReturnType<typeof createUser>>;

const VI_PLACEMENT_TITLES = PASSAGE_LIST.filter((passage) => passage.isPlacement).map((passage) => passage.title);
const EN_PLACEMENT_TITLES = ENGLISH_PLACEMENT_PASSAGE_LIST.map((passage) => passage.title);

const startSession = (learner: Learner, body: Record<string, unknown>) =>
  api().post('/api/sessions').set('Authorization', bearerFor(learner)).send(body);

const idOf = async (title: string) => String((await PassageModel.findOne({ title }))!._id);

/** A learner who types `typingLanguage` (SCRUM-219): the placement test is in that language too (SCRUM-305). */
const learnerIn = async (typingLanguage: 'vi' | 'en', email = `${typingLanguage}@example.com`) => {
  const learner = await createUser({ email });
  await api().patch('/api/profile/settings').set('Authorization', bearerFor(learner)).send({ typingLanguage });
  return learner;
};

const titlesOf = (body: { items: { title: string }[] }) => body.items.map((item) => item.title).sort();

// Every kind of passage of both languages, so a test can only see the right ones by the filters: Vietnamese ones (placement
// passages among them), the ranked duels' English ones, the English practice ones, and the English placement ones.
beforeEach(async () => {
  await seedPassages(PASSAGE_LIST);
  await seedPassages(ENGLISH_PASSAGE_LIST);
  await seedPassages(ENGLISH_PRACTICE_PASSAGE_LIST);
  await seedPassages(ENGLISH_PLACEMENT_PASSAGE_LIST);
});

describe('the placement test in the learner typing language (SCRUM-305)', () => {
  it('picks a placement passage of the learner language and keeps the language on the session', async () => {
    const english = await learnerIn('en');
    const vietnamese = await learnerIn('vi');

    const englishTest = await startSession(english, { mode: 'placement' });
    const vietnameseTest = await startSession(vietnamese, { mode: 'placement' });

    expect(englishTest.status).toBe(201);
    expect(englishTest.body).toMatchObject({ mode: 'placement', language: 'en' });
    expect(EN_PLACEMENT_TITLES).toContain(englishTest.body.passageTitle);
    expect(vietnameseTest.body).toMatchObject({ mode: 'placement', language: 'vi' });
    expect(VI_PLACEMENT_TITLES).toContain(vietnameseTest.body.passageTitle);
  });

  it('grades an English placement session with the English error set only', async () => {
    const learner = await learnerIn('en');
    const { body: started } = await startSession(learner, { mode: 'placement' });
    const typed = [...started.targetWords.slice(0, 3)];
    typed[1] = typed[1].toUpperCase();

    const { body } = await api()
      .patch(`/api/sessions/${started._id}/complete`)
      .set('Authorization', bearerFor(learner))
      .send({ typedWords: typed });

    expect(body.language).toBe('en');
    expect(Object.keys(body.errorCounts).sort()).toEqual(Object.values(EnglishError).sort());
    expect(Object.keys(body.errorCounts).some((type) => (Object.values(WordError) as string[]).includes(type))).toBe(false);
    expect(body.errorCounts.CASE_WRONG).toBe(1);
  });

  it('refuses a placement passage of the other language (400)', async () => {
    const english = await learnerIn('en');
    const vietnamese = await learnerIn('vi');

    expect((await startSession(english, { mode: 'placement', passageId: await idOf(VI_PLACEMENT_TITLES[0]) })).status).toBe(400);
    expect((await startSession(vietnamese, { mode: 'placement', passageId: await idOf(EN_PLACEMENT_TITLES[0]) })).status).toBe(400);
    const picked = await startSession(english, { mode: 'placement', passageId: await idOf(EN_PLACEMENT_TITLES[0]) });
    expect(picked.status).toBe(201);
    expect(picked.body).toMatchObject({ passageTitle: EN_PLACEMENT_TITLES[0], language: 'en' });
  });

  it('answers 404 with a message that names the language while it has no placement passage', async () => {
    await PassageModel.deleteMany({ isPlacement: true, language: 'en' });
    const english = await learnerIn('en');

    const response = await startSession(english, { mode: 'placement' });

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('No English placement passage yet');
    expect((await startSession(await learnerIn('vi'), { mode: 'placement' })).status).toBe(201);
  });

  it('gives GET /api/placement in the learner language, or in the one asked for', async () => {
    const english = await learnerIn('en');
    const placement = (query = '') => api().get(`/api/placement${query}`).set('Authorization', bearerFor(english));

    expect(EN_PLACEMENT_TITLES).toContain((await placement()).body.title);
    expect(VI_PLACEMENT_TITLES).toContain((await placement('?language=vi')).body.title);
    expect((await placement('?language=fr')).status).toBe(400);
  });

  it('never offers an English placement passage in Practice, and never a ranked one in the placement test', async () => {
    const english = await learnerIn('en');

    const practice = await api().get('/api/passages?mode=practice&language=en&limit=100').set('Authorization', bearerFor(english));
    const placement = await api().get('/api/passages?mode=placement&language=en&limit=100').set('Authorization', bearerFor(english));

    expect(titlesOf(practice.body).filter((title) => EN_PLACEMENT_TITLES.includes(title))).toEqual([]);
    expect(titlesOf(placement.body)).toEqual([...EN_PLACEMENT_TITLES].sort());
  });
});

describe('the placement passages of each language for the leaderboard (SCRUM-305)', () => {
  it('lists the placement passages of the language asked for, Vietnamese without it, also for a guest', async () => {
    const learner = await learnerIn('en');
    const signedIn = (query: string) => api().get(`/api/passages?mode=placement&limit=100${query}`).set('Authorization', bearerFor(learner));
    const guest = (query: string) => api().get(`/api/placement/passages?limit=100${query}`);

    expect(titlesOf((await signedIn('&language=en')).body)).toEqual([...EN_PLACEMENT_TITLES].sort());
    expect(titlesOf((await signedIn('')).body)).toEqual([...VI_PLACEMENT_TITLES].sort());
    expect(titlesOf((await guest('&language=en')).body)).toEqual([...EN_PLACEMENT_TITLES].sort());
    expect(titlesOf((await guest('')).body)).toEqual([...VI_PLACEMENT_TITLES].sort());
  });

  it('keeps each board to the sessions of its own passage, so an English board never shows a Vietnamese result', async () => {
    const english = await learnerIn('en', 'lan@example.com');
    const vietnamese = await learnerIn('vi', 'minh@example.com');
    const englishId = await idOf(EN_PLACEMENT_TITLES[0]);
    const vietnameseId = await idOf(VI_PLACEMENT_TITLES[0]);
    const onTheBoard = {
      mode: 'placement',
      targetWords: ['a'],
      words: [],
      status: 'completed',
      isCounted: true,
      isOnPlacementBoard: true,
      completedAt: new Date(),
      durationMs: 180_000,
      accuracy: 97
    };
    await TypingSessionModel.create({ ...onTheBoard, owner: english._id, passageId: englishId, language: 'en', wpm: 62 });
    // A session saved before the language field: Vietnamese, still on its passage's board.
    await TypingSessionModel.collection.insertOne({ ...onTheBoard, owner: vietnamese._id, passageId: vietnameseId, wpm: 48 });
    const board = (passageId: string) => api().get(`/api/placement/leaderboard?passageId=${passageId}&range=all`);

    const englishBoard = await board(englishId);
    const vietnameseBoard = await board(vietnameseId);

    expect(englishBoard.status).toBe(200);
    expect(englishBoard.body.items.map((item: { wpm: number }) => item.wpm)).toEqual([62]);
    expect(vietnameseBoard.body.items.map((item: { wpm: number }) => item.wpm)).toEqual([48]);
  });
});
