import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PassageModel } from '../../src/models/passage.model';
import { TypingSessionModel } from '../../src/models/typing-session.model';
import { UserModel } from '../../src/models/user.model';
import { api } from '../helpers/api';
import { bearerFor, createUser } from '../helpers/user-factory';

// Wednesday 11 March 2026, 12:00 in Vietnam. The week of the board started on Monday 9 March at 0:00 there.
const NOW = new Date('2026-03-11T05:00:00.000Z');
const MINUTE = 60_000;
const WORDS = Array.from({ length: 30 }, (_, index) => `chữ${index + 1}`);

let passageId: string;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  passageId = String(
    (await PassageModel.create({ title: 'Bài xếp hạng', content: WORDS.join(' '), source: 'Tự viết', status: 'published', visibility: 'public', isPlacement: true }))._id
  );
});

afterEach(() => {
  vi.useRealTimers();
});

const at = (minutes: number, from: Date = NOW) => vi.setSystemTime(new Date(from.getTime() + minutes * MINUTE));

let counter = 0;
const newUser = (displayName: string) => {
  counter += 1;
  return createUser({ email: `learner${counter}@example.com`, displayName });
};

/** A completed session on the board, saved as the server would have left it (no hook runs: the cache is not told). */
const seed = (owner: { _id: unknown }, wpm: number, accuracy = 95, completedAt: Date = NOW) =>
  TypingSessionModel.create({
    owner: owner._id,
    mode: 'placement',
    passageId,
    targetWords: ['một', 'hai'],
    status: 'completed',
    wpm,
    accuracy,
    durationMs: 180_000,
    completedAt,
    isCounted: true,
    chosenLimitSeconds: 180,
    isOnPlacementBoard: true
  });

/** Completes a real placement session (the hooks run), 3 minutes unless `limit` says another, with `wrong` of the 30 words wrong. */
const complete = async (user: { _id: unknown }, { wrong = 0, limit = 180 }: { wrong?: number; limit?: number } = {}) => {
  const auth = bearerFor(user as never);
  const session = (await api().post('/api/sessions').set('Authorization', auth).send({ mode: 'placement', passageId, timeLimitSeconds: limit })).body;
  await api().patch(`/api/sessions/${session._id}/begin`).set('Authorization', auth);
  const startedAt = Date.now();
  vi.setSystemTime(new Date(startedAt + 180_000));
  const typedWords = WORDS.map((word, index) => (index < wrong ? `${word}x` : word));
  const response = await api().patch(`/api/sessions/${session._id}/complete`).set('Authorization', auth).send({ typedWords });
  vi.setSystemTime(new Date(startedAt)); // the clock goes back: the tests count the minutes from the start
  return response;
};

const board = (user: { _id: unknown }, query = '') =>
  api().get(`/api/placement/leaderboard?passageId=${passageId}${query}`).set('Authorization', bearerFor(user as never));

const names = (response: { body: { items: { displayName: string }[] } }) => response.body.items.map((item) => item.displayName);

const adminAuth = async () => bearerFor(await createUser({ email: 'admin@example.com', role: 'admin', displayName: 'Admin' }));

describe('the placement board is kept for an hour', () => {
  it('builds it once and serves it for the hour, even when a new session goes on the board', async () => {
    const [a, b] = await Promise.all([newUser('A'), newUser('B')]);
    await seed(a, 60);
    const aggregate = vi.spyOn(TypingSessionModel, 'aggregate');
    expect(names(await board(a))).toEqual(['A']);

    await complete(b); // B goes on the board
    at(59);

    expect(names(await board(a))).toEqual(['A']);
    expect(aggregate).toHaveBeenCalledTimes(1);
  });

  it('shows the new session at the first read after the hour', async () => {
    const [a, b] = await Promise.all([newUser('A'), newUser('B')]);
    await seed(a, 60);
    const aggregate = vi.spyOn(TypingSessionModel, 'aggregate');
    await board(a);
    await complete(b);
    at(61);

    const response = await board(a);

    expect(names(response)).toEqual(expect.arrayContaining(['A', 'B']));
    expect(response.body.players).toBe(2);
    expect(aggregate).toHaveBeenCalledTimes(2);
  });

  it('does not build it again after the hour when nothing changed', async () => {
    const a = await newUser('A');
    await seed(a, 60);
    const aggregate = vi.spyOn(TypingSessionModel, 'aggregate');
    await board(a);

    at(61);
    await board(a);
    at(122);
    await board(a);

    expect(aggregate).toHaveBeenCalledTimes(1);
  });

  it('does not count a session that stays off the board as a change', async () => {
    const [a, b] = await Promise.all([newUser('A'), newUser('B')]);
    await seed(a, 60);
    const aggregate = vi.spyOn(TypingSessionModel, 'aggregate');
    await board(a);

    expect((await complete(b, { limit: 60 })).body.isOnPlacementBoard).toBe(false); // 1 minute: never on the board
    at(61);
    await board(a);

    expect(aggregate).toHaveBeenCalledTimes(1);
  });

  it('serves each viewer their own place from the same list', async () => {
    const [a, b] = await Promise.all([newUser('A'), newUser('B')]);
    await seed(a, 70);
    await seed(b, 60);
    const aggregate = vi.spyOn(TypingSessionModel, 'aggregate');

    const asA = await board(a);
    const asB = await board(b);

    expect(asA.body.me.rank).toBe(1);
    expect(asB.body.me.rank).toBe(2);
    expect(asB.body.items.map((item: { isMe: boolean }) => item.isMe)).toEqual([false, true]);
    expect(aggregate).toHaveBeenCalledTimes(1);
  });

  it('builds it once for requests that arrive at the same time', async () => {
    const a = await newUser('A');
    await seed(a, 60);
    const aggregate = vi.spyOn(TypingSessionModel, 'aggregate');

    const responses = await Promise.all([board(a), board(a), board(a)]);

    expect(responses.map((response) => response.status)).toEqual([200, 200, 200]);
    expect(aggregate).toHaveBeenCalledTimes(1);
  });

  it('keeps the week and All-time boards apart', async () => {
    const [a, b] = await Promise.all([newUser('A'), newUser('B')]);
    await seed(a, 60);
    await seed(b, 80, 95, new Date('2026-03-01T05:00:00.000Z')); // an earlier week

    expect(names(await board(a))).toEqual(['A']);
    expect(names(await board(a, '&range=all'))).toEqual(['B', 'A']);
  });

  it('builds the week board again when a new week starts, even inside the hour', async () => {
    const a = await newUser('A');
    await seed(a, 60, 95, new Date('2026-03-15T16:00:00.000Z')); // Sunday 23:00 in Vietnam
    const aggregate = vi.spyOn(TypingSessionModel, 'aggregate');
    const sunday = new Date('2026-03-15T16:30:00.000Z'); // Sunday 23:30
    vi.setSystemTime(sunday);
    expect(names(await board(a))).toEqual(['A']);

    at(40, sunday); // Monday 0:10: a new week, 40 minutes later

    expect((await board(a)).body.items).toEqual([]);
    expect(aggregate).toHaveBeenCalledTimes(2);
  });

  it('always shows the names and avatars as they are now', async () => {
    const a = await newUser('A');
    await seed(a, 60);
    const aggregate = vi.spyOn(TypingSessionModel, 'aggregate');
    await board(a);

    await UserModel.updateOne({ _id: a._id }, { displayName: 'Aaa' });

    expect(names(await board(a))).toEqual(['Aaa']);
    expect(aggregate).toHaveBeenCalledTimes(1);
  });

  it('drops a learner who was deleted since the board was built, at once, without waiting for the hour', async () => {
    const [a, gone] = await Promise.all([newUser('A'), newUser('Gone')]);
    await seed(a, 60);
    await seed(gone, 70);
    await board(a);

    await UserModel.deleteOne({ _id: gone._id });

    expect(names(await board(a))).toEqual(['A']);
  });
});

describe('what tells the board something changed', () => {
  it('a locked learner leaves the board at the first read after the hour', async () => {
    const [a, b] = await Promise.all([newUser('A'), newUser('B')]);
    await seed(a, 60);
    await seed(b, 70);
    await board(a);

    const response = await api().patch(`/api/admin/users/${b._id}/status`).set('Authorization', await adminAuth()).send({ status: 'locked' });
    expect(response.status).toBe(200);
    at(61);

    expect(names(await board(a))).toEqual(['A']);
  });

  it('deleted learners leave the board at the first read after the hour, with their sessions', async () => {
    const [a, b] = await Promise.all([newUser('A'), newUser('B')]);
    await seed(a, 60);
    await seed(b, 70);
    await board(a);

    await api().post('/api/admin/users/bulk-delete').set('Authorization', await adminAuth()).send({ ids: [String(b._id)] });
    at(61);

    const response = await board(a);
    expect(names(response)).toEqual(['A']);
    expect(response.body.players).toBe(1);
  });

  it('a new minimum accuracy that moves sessions off the board shows at the first read after the hour', async () => {
    const [a, b] = await Promise.all([newUser('A'), newUser('B')]);
    await seed(a, 60, 99);
    await seed(b, 70, 92);
    await board(a);

    await api().put('/api/admin/placement/settings').set('Authorization', await adminAuth()).send({ minAccuracy: 95 });
    expect(names(await board(a))).toEqual(['B', 'A']); // still the list built before: the hour is not over
    at(61);

    expect(names(await board(a))).toEqual(['A']);
  });
});

describe('the index of the board', () => {
  it('reads the sessions of a passage already in the order of the board, with no sort in memory', async () => {
    await TypingSessionModel.init();
    const a = await newUser('A');
    await seed(a, 60);

    const plan = await TypingSessionModel.find({ passageId, isOnPlacementBoard: true })
      .sort({ wpm: -1, accuracy: -1, durationMs: 1, completedAt: 1 })
      .explain('queryPlanner');

    const stages = JSON.stringify(plan);
    expect(stages).toContain('IXSCAN');
    expect(stages).not.toContain('"stage":"SORT"');
  });
});
