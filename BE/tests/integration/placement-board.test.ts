import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PassageModel } from '../../src/models/passage.model';
import { TypingSessionModel } from '../../src/models/typing-session.model';
import { UserModel } from '../../src/models/user.model';
import { api } from '../helpers/api';
import { bearerFor, createUser } from '../helpers/user-factory';

// Wednesday 11 March 2026, 12:00 in Vietnam. The week of the board starts on Monday 9 March at 0:00 there (2026-03-08T17:00:00Z).
const NOW = new Date('2026-03-11T05:00:00.000Z');
const WEEK_START = new Date('2026-03-08T17:00:00.000Z');

let passageId: string;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  passageId = String(
    (await PassageModel.create({ title: 'Bài xếp hạng', content: 'một hai ba', source: 'Tự viết', status: 'published', visibility: 'public', isPlacement: true }))._id
  );
});

afterEach(() => {
  vi.useRealTimers();
});

let counter = 0;
const newUser = (displayName?: string, status?: 'active' | 'locked') => {
  counter += 1;
  return createUser({ email: `learner${counter}@example.com`, displayName, status });
};

interface Entry {
  wpm?: number;
  accuracy?: number;
  durationMs?: number;
  completedAt?: Date;
  onBoard?: boolean;
  passage?: string;
}

/** A completed placement session saved as the server would have left it. */
const addSession = (owner: { _id: unknown }, { wpm = 50, accuracy = 95, durationMs = 180_000, completedAt = NOW, onBoard = true, passage = passageId }: Entry = {}) =>
  TypingSessionModel.create({
    owner: owner._id,
    mode: 'placement',
    passageId: passage,
    targetWords: ['một', 'hai', 'ba'],
    status: 'completed',
    wpm,
    accuracy,
    durationMs,
    completedAt,
    isCounted: true,
    isOnPlacementBoard: onBoard
  });

const getBoard = (authorization: string, query = '') =>
  api().get(`/api/placement/leaderboard?passageId=${passageId}${query}`).set('Authorization', authorization);

describe('GET /api/placement/leaderboard', () => {
  it('needs a signed-in user and a valid passage id and range', async () => {
    const auth = bearerFor(await newUser());

    expect((await api().get(`/api/placement/leaderboard?passageId=${passageId}`)).status).toBe(401);
    expect((await api().get('/api/placement/leaderboard').set('Authorization', auth)).status).toBe(400);
    expect((await api().get('/api/placement/leaderboard?passageId=nope').set('Authorization', auth)).status).toBe(400);
    expect((await getBoard(auth, '&range=month')).status).toBe(400);
  });

  it('answers 404 for a passage that is not a published placement passage', async () => {
    const auth = bearerFor(await newUser());
    const practice = await PassageModel.create({ title: 'Luyện tập', content: 'một hai', source: 'Tự viết', status: 'published', visibility: 'public' });

    expect((await api().get(`/api/placement/leaderboard?passageId=${practice._id}`).set('Authorization', auth)).status).toBe(404);
    expect((await api().get(`/api/placement/leaderboard?passageId=${'0'.repeat(24)}`).set('Authorization', auth)).status).toBe(404);
  });

  it('is empty when nobody is on the board, and the learner has no place', async () => {
    const auth = bearerFor(await newUser());

    const response = await getBoard(auth);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ passageId, range: 'week', players: 0, items: [], me: null });
  });

  it('sorts by WPM, then accuracy, then the shorter time, then who finished first', async () => {
    const [a, b, c, d, e] = await Promise.all(['A', 'B', 'C', 'D', 'E'].map((name) => newUser(name)));
    await addSession(a, { wpm: 60, accuracy: 95, durationMs: 180_000, completedAt: new Date('2026-03-11T01:00:00Z') });
    await addSession(b, { wpm: 70 }); // fastest
    await addSession(c, { wpm: 60, accuracy: 99 }); // same WPM as A, better accuracy
    await addSession(d, { wpm: 60, accuracy: 95, durationMs: 120_000 }); // same as A, shorter time
    await addSession(e, { wpm: 60, accuracy: 95, durationMs: 180_000, completedAt: new Date('2026-03-11T00:30:00Z') }); // same as A, earlier

    const response = await getBoard(bearerFor(a));

    expect(response.body.items.map((item: { displayName: string }) => item.displayName)).toEqual(['B', 'C', 'D', 'E', 'A']);
    expect(response.body.items.map((item: { rank: number }) => item.rank)).toEqual([1, 2, 3, 4, 5]);
    expect(response.body.items[0]).toMatchObject({ wpm: 70, accuracy: 95, durationMs: 180_000, isMe: false });
    expect(response.body.items[4].isMe).toBe(true);
    expect(response.body.players).toBe(5);
  });

  it('shows one line for each learner: their best session', async () => {
    const a = await newUser('A');
    await addSession(a, { wpm: 40 });
    await addSession(a, { wpm: 65 });
    await addSession(a, { wpm: 55 });

    const response = await getBoard(bearerFor(a));

    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].wpm).toBe(65);
  });

  it('leaves out sessions that are not on the board, on another passage, or not completed', async () => {
    const a = await newUser('A');
    const other = String((await PassageModel.create({ title: 'Bài khác', content: 'một hai', source: 'Tự viết', status: 'published', visibility: 'public', isPlacement: true }))._id);
    await addSession(a, { wpm: 99, onBoard: false });
    await addSession(a, { wpm: 98, passage: other });
    await TypingSessionModel.create({ owner: a._id, mode: 'placement', passageId, targetWords: ['một'], status: 'in_progress', isOnPlacementBoard: true });
    await addSession(a, { wpm: 30 });

    const response = await getBoard(bearerFor(a));

    expect(response.body.items.map((item: { wpm: number }) => item.wpm)).toEqual([30]);
  });

  it('cuts the week on Monday at 0:00 in Vietnam, and All-time keeps every session', async () => {
    const [early, late] = await Promise.all([newUser('Early'), newUser('Late')]);
    await addSession(early, { wpm: 80, completedAt: new Date(WEEK_START.getTime() - 1000) }); // Sunday 23:59:59
    await addSession(late, { wpm: 50, completedAt: WEEK_START }); // Monday 0:00:00
    const auth = bearerFor(late);

    const week = await getBoard(auth);
    const all = await getBoard(auth, '&range=all');

    expect(week.body.range).toBe('week');
    expect(week.body.items.map((item: { displayName: string }) => item.displayName)).toEqual(['Late']);
    expect(all.body.range).toBe('all');
    expect(all.body.items.map((item: { displayName: string }) => item.displayName)).toEqual(['Early', 'Late']);
  });

  it('leaves out locked learners', async () => {
    const [active, locked] = await Promise.all([newUser('Active'), newUser('Locked', 'locked')]);
    await addSession(active, { wpm: 40 });
    await addSession(locked, { wpm: 90 });

    const response = await getBoard(bearerFor(active));

    expect(response.body.items.map((item: { displayName: string }) => item.displayName)).toEqual(['Active']);
    expect(response.body.players).toBe(1);
  });

  it('shows a name and avatar, never an email or an id of someone else', async () => {
    const named = await newUser('Lan');
    const unnamed = await newUser();
    await addSession(named, { wpm: 70 });
    await addSession(unnamed, { wpm: 60 });

    const response = await getBoard(bearerFor(named));

    expect(response.body.items.map((item: { displayName: string }) => item.displayName)).toEqual(['Lan', 'Anonymous player']);
    expect(response.body.items[0].avatar).toBeDefined();
    expect(JSON.stringify(response.body)).not.toMatch(/@example\.com/);
    expect(response.body.items[0]).not.toHaveProperty('owner');
    expect(response.body.items[0]).not.toHaveProperty('userId');
  });

  it('sends the top 50 and still tells a learner outside them where they are', async () => {
    const users = [];
    for (let index = 0; index < 52; index += 1) users.push(await newUser(`P${index}`));
    for (const [index, user] of users.entries()) await addSession(user, { wpm: 200 - index }); // P0 is first, P51 is last
    const last = users[51];

    const response = await getBoard(bearerFor(last));

    expect(response.body.items).toHaveLength(50);
    expect(response.body.items[49].displayName).toBe('P49');
    expect(response.body.items.some((item: { isMe: boolean }) => item.isMe)).toBe(false);
    expect(response.body.players).toBe(52);
    expect(response.body.me).toEqual({ rank: 52, wpm: 149, accuracy: 95, durationMs: 180_000 });
  });

  it('gives the learner place and numbers in `me` when they are in the top 50', async () => {
    const [a, b] = await Promise.all([newUser('A'), newUser('B')]);
    await addSession(a, { wpm: 70 });
    await addSession(b, { wpm: 60, accuracy: 92, durationMs: 150_000 });

    const response = await getBoard(bearerFor(b));

    expect(response.body.me).toEqual({ rank: 2, wpm: 60, accuracy: 92, durationMs: 150_000 });
  });

  it('is kept after a learner is deleted from the users: no board line without an account', async () => {
    const [a, gone] = await Promise.all([newUser('A'), newUser('Gone')]);
    await addSession(a, { wpm: 40 });
    await addSession(gone, { wpm: 90 });
    await UserModel.deleteOne({ _id: gone._id });

    const response = await getBoard(bearerFor(a));

    expect(response.body.items.map((item: { displayName: string }) => item.displayName)).toEqual(['A']);
  });
});
