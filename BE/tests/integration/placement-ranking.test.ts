import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PassageModel } from '../../src/models/passage.model';
import { ABANDONED_TTL_MS, TypingSessionModel } from '../../src/models/typing-session.model';
import { api } from '../helpers/api';
import { bearerFor, createUser } from '../helpers/user-factory';

// The time of a session is measured by the server, so the clock is faked (Date only: HTTP and MongoDB keep real timers).
const START = new Date('2026-03-10T08:00:00.000Z');
const THREE_MINUTES_S = 180;

const WORDS = Array.from({ length: 30 }, (_, index) => `chữ${index + 1}`);

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(START);
  await PassageModel.create({
    title: 'Bài xếp hạng',
    content: WORDS.join(' '),
    source: 'Tự viết',
    status: 'published',
    visibility: 'public',
    isPlacement: true
  });
});

afterEach(() => {
  vi.useRealTimers();
});

const startSession = (authorization: string, body: Record<string, unknown>) =>
  api().post('/api/sessions').set('Authorization', authorization).send(body);

const begin = (authorization: string, id: string, body: Record<string, unknown> = {}) =>
  api().patch(`/api/sessions/${id}/begin`).set('Authorization', authorization).send(body);

/**
 * Starts a session with the time the learner chose (`limit`), presses the first key, lets `seconds` pass and sends `typedWords`;
 * resolves to the completed session. `claimed` is the time the page sends at the end.
 */
const play = async (
  authorization: string,
  { mode = 'placement', limit, seconds, typedWords = WORDS, claimed }: { mode?: string; limit?: number; seconds: number; typedWords?: string[]; claimed?: number }
) => {
  const session = (await startSession(authorization, { mode, ...(limit !== undefined && { timeLimitSeconds: limit }) })).body;
  await begin(authorization, session._id);
  vi.setSystemTime(new Date(START.getTime() + seconds * 1000));
  return api()
    .patch(`/api/sessions/${session._id}/complete`)
    .set('Authorization', authorization)
    .send({ typedWords, ...(claimed !== undefined && { timeLimitSeconds: claimed }) });
};

describe('POST /api/sessions: the time the learner chose', () => {
  it('keeps the time chosen when the session starts', async () => {
    const auth = bearerFor(await createUser({}));

    const response = await startSession(auth, { mode: 'placement', timeLimitSeconds: THREE_MINUTES_S });

    expect(response.status).toBe(201);
    expect(response.body.chosenLimitSeconds).toBe(THREE_MINUTES_S);
    expect(response.body.isOnPlacementBoard).toBe(false);
  });

  it('starts without a chosen time too (the session is then never on the board)', async () => {
    const auth = bearerFor(await createUser({}));

    const response = await startSession(auth, { mode: 'placement' });

    expect(response.status).toBe(201);
    expect(response.body.chosenLimitSeconds).toBeUndefined();
  });

  it('rejects a time the page never offers', async () => {
    const auth = bearerFor(await createUser({}));

    expect((await startSession(auth, { mode: 'placement', timeLimitSeconds: 45 })).status).toBe(400);
  });

  it('ignores a time sent with the first key: it cannot be changed once the session has started', async () => {
    const auth = bearerFor(await createUser({}));
    const session = (await startSession(auth, { mode: 'placement', timeLimitSeconds: 10 })).body;

    const response = await begin(auth, session._id, { timeLimitSeconds: THREE_MINUTES_S });

    expect(response.status).toBe(200);
    expect(response.body.chosenLimitSeconds).toBe(10);
  });
});

describe('PATCH /api/sessions/:id/complete: which placement sessions go on the leaderboard', () => {
  const placement = { limit: THREE_MINUTES_S };

  it('puts a placement session that lasted the 3 minutes chosen on the board', async () => {
    const auth = bearerFor(await createUser({}));

    const response = await play(auth, { ...placement, seconds: THREE_MINUTES_S });

    expect(response.status).toBe(200);
    expect(response.body.isOnPlacementBoard).toBe(true);
  });

  it('puts a learner who typed the whole passage before the 3 minutes were over on the board', async () => {
    const auth = bearerFor(await createUser({}));

    const response = await play(auth, { ...placement, seconds: 60 });

    expect(response.body.isOnPlacementBoard).toBe(true);
  });

  it('keeps off the board a session that claims 3 minutes but stops early without finishing the passage', async () => {
    const auth = bearerFor(await createUser({}));

    const response = await play(auth, { ...placement, seconds: 10, typedWords: WORDS.slice(0, 25), claimed: THREE_MINUTES_S });

    expect(response.status).toBe(200);
    expect(response.body.isOnPlacementBoard).toBe(false);
  });

  it('ignores the time sent with the completion: it does not put a session on the board', async () => {
    const auth = bearerFor(await createUser({}));

    const response = await play(auth, { limit: 60, seconds: 60, typedWords: WORDS.slice(0, 25), claimed: THREE_MINUTES_S });

    expect(response.body.isOnPlacementBoard).toBe(false);
  });

  it('keeps off the board a session started without a chosen time', async () => {
    const auth = bearerFor(await createUser({}));

    const response = await play(auth, { seconds: THREE_MINUTES_S });

    expect(response.body.isOnPlacementBoard).toBe(false);
  });

  it('keeps off the board a practice session, even with 3 minutes', async () => {
    const auth = bearerFor(await createUser({}));
    await PassageModel.create({ title: 'Luyện tập', content: WORDS.join(' '), source: 'Tự viết', status: 'published', visibility: 'public' });

    const response = await play(auth, { mode: 'practice', limit: THREE_MINUTES_S, seconds: THREE_MINUTES_S });

    expect(response.body.isOnPlacementBoard).toBe(false);
  });

  it('keeps off the board an accuracy under the minimum (90 until an admin changes it)', async () => {
    const auth = bearerFor(await createUser({}));
    const wrong = WORDS.map((word, index) => (index < 4 ? `${word}x` : word)); // 26 of 30 right: 86.7%

    const response = await play(auth, { ...placement, seconds: THREE_MINUTES_S, typedWords: wrong });

    expect(response.body.accuracy).toBeLessThan(90);
    expect(response.body.isOnPlacementBoard).toBe(false);
  });

  it('keeps off the board a session too short or too fast to be counted', async () => {
    const auth = bearerFor(await createUser({}));

    const response = await play(auth, { ...placement, seconds: THREE_MINUTES_S, typedWords: WORDS.slice(0, 5) });

    expect(response.body.isCounted).toBe(false);
    expect(response.body.isOnPlacementBoard).toBe(false);
  });
});

describe('abandoned sessions are deleted after 24 hours', () => {
  const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

  it('lets MongoDB delete an abandoned session 24 hours after it was abandoned (partial TTL index on updatedAt)', async () => {
    await TypingSessionModel.init(); // the indexes exist before they are read

    const indexes = await TypingSessionModel.collection.indexes();

    expect(ABANDONED_TTL_MS).toBe(24 * 60 * 60 * 1000);
    expect(indexes).toContainEqual(
      expect.objectContaining({ key: { updatedAt: 1 }, expireAfterSeconds: 24 * 60 * 60, partialFilterExpression: { status: 'abandoned' } })
    );
  });

  it('counts the 24 hours from the moment a new session replaces it, not from when it was created', async () => {
    const user = await createUser({});
    const first = (await startSession(bearerFor(user), { mode: 'placement' })).body;
    vi.setSystemTime(new Date(START.getTime() + TWO_HOURS_MS));

    await startSession(bearerFor(user), { mode: 'placement' }); // a new token: the first one has expired in two hours

    const abandoned = (await TypingSessionModel.findById(first._id))!;
    expect(abandoned.status).toBe('abandoned');
    expect(abandoned.updatedAt.getTime()).toBe(START.getTime() + TWO_HOURS_MS);
  });

  it('counts the 24 hours from the moment of an abandon request too', async () => {
    const user = await createUser({});
    const session = (await startSession(bearerFor(user), { mode: 'placement' })).body;
    vi.setSystemTime(new Date(START.getTime() + TWO_HOURS_MS));

    await api().patch(`/api/sessions/${session._id}/abandon`).set('Authorization', bearerFor(user));

    expect((await TypingSessionModel.findById(session._id))!.updatedAt.getTime()).toBe(START.getTime() + TWO_HOURS_MS);
  });

  it('keeps completed and in-progress sessions out of that index (a completed one is history for ever)', async () => {
    const auth = bearerFor(await createUser({}));
    const done = await play(auth, { limit: THREE_MINUTES_S, seconds: THREE_MINUTES_S });
    expect(done.body.status).toBe('completed');
    const index = (await TypingSessionModel.collection.indexes()).find((item) => item.key.updatedAt === 1)!;

    expect(index.partialFilterExpression).toEqual({ status: 'abandoned' });
  });
});
