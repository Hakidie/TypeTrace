import { beforeEach, describe, expect, it } from 'vitest';
import { PASSAGE_LIST } from '../../src/data/passages';
import { PassageModel } from '../../src/models/passage.model';
import { TypingSessionModel } from '../../src/models/typing-session.model';
import { UserModel } from '../../src/models/user.model';
import { getTopErrorTypes, getWeakErrorTypes, PROFILE_WINDOW } from '../../src/services/error-profile.service';
import { seedPassages } from '../../src/services/passage-seed.service';
import { WordError, type WordErrorType } from '../../src/utils/vietnamese-errors';
import { api } from '../helpers/api';
import { bearerFor, createUser } from '../helpers/user-factory';

type Learner = { _id: unknown; email: string };

interface TypeBody {
  type: WordErrorType;
  errors: number;
  opportunities: number;
  rate: number;
  level: string;
  previousRate: number;
  trend: string;
}

const profileOf = (learner: Learner) => api().get('/api/profile/error-profile').set('Authorization', bearerFor(learner));

const typeIn = (body: { types: TypeBody[] }, type: WordErrorType) => body.types.find((item) => item.type === type);

/**
 * A counted session completed `minutesAgo` minutes ago with `[errors, chances]` of the types given (0 of the others),
 * written straight to the database.
 */
const countedSession = (
  owner: unknown,
  minutesAgo: number,
  counts: Partial<Record<WordErrorType, readonly [number, number]>>,
  fields: Record<string, unknown> = {}
) => ({
  owner,
  passageId: 'p1',
  targetWords: ['a'],
  status: 'completed',
  isCounted: true,
  completedAt: new Date(Date.now() - minutesAgo * 60_000),
  durationMs: 60_000,
  wpm: 30,
  accuracy: 95,
  errorCounts: Object.fromEntries(Object.entries(counts).map(([type, [errors]]) => [type, errors])),
  opportunityCounts: Object.fromEntries(Object.entries(counts).map(([type, [, chances]]) => [type, chances])),
  ...fields
});

/** Starts a session on the passage of 23 words, as if it was opened `openedMsAgo` ago (2 minutes: an ordinary pace). */
const start = async (authorization: string, openedMsAgo = 120_000) => {
  const passage = (await PassageModel.findOne({ title: 'Tiếng Việt rất đẹp' }))!;
  const { body } = await api().post('/api/sessions').set('Authorization', authorization).send({ passageId: String(passage._id) });
  await TypingSessionModel.findByIdAndUpdate(body._id, { startedAt: new Date(Date.now() - openedMsAgo) });
  return body as { _id: string; targetWords: string[] };
};

const complete = (authorization: string, id: string, typedWords: string[]) =>
  api().patch(`/api/sessions/${id}/complete`).set('Authorization', authorization).send({ typedWords });

describe('GET /api/profile/error-profile (SCRUM-27)', () => {
  beforeEach(async () => {
    await seedPassages(PASSAGE_LIST);
  });

  it('gives a new learner every error type without data, with the thresholds', async () => {
    const learner = await createUser({});

    const response = await profileOf(learner);

    expect(response.status).toBe(200);
    expect(Object.keys(response.body).sort()).toEqual(['minOpportunities', 'rankedTypes', 'sessionsUsed', 'types', 'weakRate', 'weakTypes', 'window']);
    expect(response.body).toMatchObject({ window: 10, minOpportunities: 20, weakRate: 15, sessionsUsed: 0, weakTypes: [], rankedTypes: [] });
    expect(response.body.types).toEqual(
      Object.values(WordError).map((type) => ({
        type,
        errors: 0,
        opportunities: 0,
        rate: 0,
        level: 'insufficient_data',
        previousRate: 0,
        trend: 'insufficient_data'
      }))
    );
  });

  it('answers 401 without a token and 404 for the token of a deleted account', async () => {
    expect((await api().get('/api/profile/error-profile')).status).toBe(401);

    const learner = await createUser({});
    await UserModel.deleteOne({ _id: learner._id });
    const response = await profileOf(learner);

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('User not found');
  });

  it('counts a session completed through the API right away', async () => {
    const learner = await createUser({});
    const auth = bearerFor(learner);
    const session = await start(auth);
    // The first 3 words typed wrong.
    const completed = await complete(auth, session._id, session.targetWords.map((word, index) => (index < 3 ? 'x' : word)));
    expect(completed.body.isCounted).toBe(true);

    const { body } = await profileOf(learner);

    const stored = (await TypingSessionModel.findById(session._id).lean())!;
    expect(body.sessionsUsed).toBe(1);
    for (const item of body.types as TypeBody[]) {
      expect(item.errors).toBe(stored.errorCounts![item.type]);
      expect(item.opportunities).toBe(stored.opportunityCounts![item.type]);
    }
    expect(typeIn(body, 'BASE_LETTER')).toMatchObject({ errors: 3, opportunities: 23, rate: 13, level: 'ok' });
  });

  it('leaves out sessions that are not counted or not completed, and the sessions of other learners', async () => {
    const learner = await createUser({});
    const other = await createUser({ email: 'other@example.com' });
    const auth = bearerFor(learner);
    // Through the API: 19 of the 23 words (too few to count), then the whole passage at once (over 200 WPM).
    const short = await start(auth);
    expect((await complete(auth, short._id, short.targetWords.slice(0, 19))).body.isCounted).toBe(false);
    const fast = await start(auth, 0);
    expect((await complete(auth, fast._id, fast.targetWords)).body.isCounted).toBe(false);
    // Straight to the database: an abandoned session, one in progress, and a counted session of another learner.
    const errorful = { HOI_NGA_CONFUSION: [20, 20] } as const;
    await TypingSessionModel.create([
      countedSession(learner._id, 1, errorful, { status: 'abandoned', isCounted: false }),
      countedSession(learner._id, 2, errorful, { status: 'in_progress', isCounted: false, completedAt: undefined }),
      countedSession(other._id, 3, errorful)
    ]);

    const { body } = await profileOf(learner);

    expect(body.sessionsUsed).toBe(0);
    expect((body.types as TypeBody[]).every((item) => item.errors === 0 && item.opportunities === 0)).toBe(true);
    // The other learner sees their own session.
    const theirs = (await profileOf(other)).body;
    expect(theirs.sessionsUsed).toBe(1);
    expect(typeIn(theirs, 'HOI_NGA_CONFUSION')).toMatchObject({ errors: 20, opportunities: 20, level: 'weak' });
  });

  it('shows a weak type that is improving: the 10 newest sessions against the 10 before them', async () => {
    const learner = await createUser({});
    // Newest first: 10 sessions with 6 hỏi/ngã errors in 40 chances (15 %), then 10 with 14 in 40 (35 %).
    const current = Array.from({ length: PROFILE_WINDOW }, (_, index) =>
      countedSession(learner._id, index + 1, { HOI_NGA_CONFUSION: [index < 6 ? 1 : 0, 4], BASE_LETTER: [0, 40] })
    );
    const previous = Array.from({ length: PROFILE_WINDOW }, (_, index) =>
      countedSession(learner._id, 100 + index, { HOI_NGA_CONFUSION: [index < 4 ? 2 : 1, 4], BASE_LETTER: [0, 40] })
    );
    await TypingSessionModel.create([...current, ...previous]);

    const { body } = await profileOf(learner);

    expect(body).toMatchObject({ sessionsUsed: 10, weakTypes: ['HOI_NGA_CONFUSION'] });
    expect((body.types as TypeBody[]).map((item) => item.type)).toEqual(Object.values(WordError));
    expect(typeIn(body, 'HOI_NGA_CONFUSION')).toEqual({
      type: 'HOI_NGA_CONFUSION',
      errors: 6,
      opportunities: 40,
      rate: 15,
      level: 'weak',
      previousRate: 35,
      trend: 'improved'
    });
    // No error in either window: nothing changed.
    expect(typeIn(body, 'BASE_LETTER')).toMatchObject({ errors: 0, opportunities: 400, level: 'ok', trend: 'unchanged' });
  });

  it('leaves out the sessions saved before the chances were counted, which take no place in the window', async () => {
    const learner = await createUser({});
    await TypingSessionModel.create([
      countedSession(learner._id, 1, {}, { errorCounts: { BASE_LETTER: 5 }, opportunityCounts: undefined }),
      ...Array.from({ length: PROFILE_WINDOW }, (_, index) => countedSession(learner._id, 10 + index, { BASE_LETTER: [1, 20] }))
    ]);

    const { body } = await profileOf(learner);

    expect(body.sessionsUsed).toBe(PROFILE_WINDOW);
    expect(typeIn(body, 'BASE_LETTER')).toMatchObject({ errors: 10, opportunities: 200, rate: 5, level: 'ok' });
  });

  it('gives the weak types, highest rate first (getWeakErrorTypes)', async () => {
    const learner = await createUser({});
    await TypingSessionModel.create(
      countedSession(learner._id, 1, { HOI_NGA_CONFUSION: [10, 40], TONE_WRONG: [8, 40], BASE_LETTER: [9, 40], MARK_WRONG: [1, 40] })
    );

    expect(await getWeakErrorTypes(String(learner._id))).toEqual(['HOI_NGA_CONFUSION', 'BASE_LETTER']);
    expect(await getWeakErrorTypes(String(learner._id), 1)).toEqual(['HOI_NGA_CONFUSION']);
    expect(await getWeakErrorTypes(String(learner._id), 5)).toEqual(['HOI_NGA_CONFUSION', 'BASE_LETTER', 'TONE_WRONG']);
  });

  it('gives a Weak spots lesson its types with enough data, weak or not, highest rate first (getTopErrorTypes, US3.2)', async () => {
    const learner = await createUser({});
    // Nothing weak: hỏi / ngã 10 %, the tone 5 %, the letters 0 %, đ with too few chances.
    await TypingSessionModel.create(
      countedSession(learner._id, 1, { HOI_NGA_CONFUSION: [4, 40], TONE_WRONG: [2, 40], BASE_LETTER: [0, 40], D_MISSING: [3, 5] })
    );

    expect(await getWeakErrorTypes(String(learner._id))).toEqual([]);
    expect(await getTopErrorTypes(String(learner._id))).toEqual(['HOI_NGA_CONFUSION', 'TONE_WRONG']);
    expect(await getTopErrorTypes(String(learner._id), 5)).toEqual(['HOI_NGA_CONFUSION', 'TONE_WRONG', 'BASE_LETTER']);
    // A learner without a counted session has nothing to aim at.
    expect(await getTopErrorTypes(String((await createUser({ email: 'new@example.com' }))._id))).toEqual([]);
  });
});
