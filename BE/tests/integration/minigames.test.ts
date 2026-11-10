import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DailyTaskModel } from '../../src/models/daily-task.model';
import { MinigamePlayModel } from '../../src/models/minigame-play.model';
import { UserDailyTasksModel } from '../../src/models/user-daily-tasks.model';
import { api } from '../helpers/api';
import { bearerFor, createUser } from '../helpers/user-factory';

beforeAll(() => Promise.all([MinigamePlayModel.init(), UserDailyTasksModel.init()]));

// Today is fixed: 10 March 2026, 15:00 in Vietnam (08:00Z); a test moves the clock to let a game run.
const START = new Date('2026-03-10T08:00:00.000Z');
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(START);
});
afterEach(() => vi.useRealTimers());

let counter = 0;
const newLearner = () => {
  counter += 1;
  return createUser({ email: `play${counter}@example.com` });
};

const start = (auth: string, body: object = { game: 'chain' }) => api().post('/api/minigames/plays').set('Authorization', auth).send(body);
const finish = (auth: string, id: string) => api().post(`/api/minigames/plays/${id}/finish`).set('Authorization', auth);
const later = (seconds: number) => vi.setSystemTime(new Date(START.getTime() + seconds * 1000));

/** The learner's task of today, `{ progress, completed }`. */
const taskOf = async (auth: string) => (await api().get('/api/profile/daily-tasks').set('Authorization', auth)).body.tasks[0];

describe('POST /api/minigames/plays', () => {
  it('needs a signed-in user', async () => {
    expect((await api().post('/api/minigames/plays').send({ game: 'chain' })).status).toBe(401);
  });

  it('opens a play of each minigame and answers its id', async () => {
    const learner = await newLearner();
    for (const game of ['chain', 'rain', 'bot']) {
      const response = await start(bearerFor(learner), { game });
      expect(response.status).toBe(201);
      expect(response.body.id).toMatch(/^[0-9a-f]{24}$/);
      expect(await MinigamePlayModel.countDocuments({ _id: response.body.id, owner: learner._id, game, finished: false, startedAt: START })).toBe(1);
    }
  });

  it('refuses a game it does not know or none', async () => {
    const auth = bearerFor(await newLearner());

    expect((await start(auth, { game: 'poker' })).status).toBe(400);
    expect((await start(auth, {})).status).toBe(400);
    expect(await MinigamePlayModel.countDocuments()).toBe(0);
  });
});

describe('POST /api/minigames/plays/:id/finish', () => {
  beforeEach(async () => {
    await DailyTaskModel.create({ title: 'Chơi minigame', type: 'minigames', target: 1 });
  });

  it('counts a play that ran long enough for the daily task of the day it ends', async () => {
    const auth = bearerFor(await newLearner());
    const { id } = (await start(auth)).body;
    later(20);

    const response = await finish(auth, id);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ counted: true });
    expect(await MinigamePlayModel.countDocuments({ _id: id, finished: true, finishedAt: new Date(START.getTime() + 20_000) })).toBe(1);
    expect(await taskOf(auth)).toMatchObject({ type: 'minigames', progress: 1, completed: true });
  });

  it('does not count a finish that comes too early, keeps the play open and counts a later finish', async () => {
    const auth = bearerFor(await newLearner());
    const { id } = (await start(auth, { game: 'rain' })).body;
    later(5);

    expect((await finish(auth, id)).body).toEqual({ counted: false });
    expect(await MinigamePlayModel.countDocuments({ _id: id, finished: false })).toBe(1);
    expect(await taskOf(auth)).toMatchObject({ progress: 0, completed: false });

    later(20);
    expect((await finish(auth, id)).body).toEqual({ counted: true });
    expect(await taskOf(auth)).toMatchObject({ progress: 1, completed: true });
  });

  it('counts a Rain round or a Bot duel lost in about 10 seconds, the soonest a game can end by lives', async () => {
    const auth = bearerFor(await newLearner());
    for (const game of ['rain', 'bot']) {
      vi.setSystemTime(START);
      const { id } = (await start(auth, { game })).body;
      later(10);
      expect((await finish(auth, id)).body).toEqual({ counted: true });
    }
  });

  it('counts a play once: a second finish answers 409 and the day keeps one minigame', async () => {
    const auth = bearerFor(await newLearner());
    const { id } = (await start(auth, { game: 'bot' })).body;
    later(20);
    await finish(auth, id);

    const again = await finish(auth, id);

    expect(again.status).toBe(409);
    expect(await taskOf(auth)).toMatchObject({ progress: 1 });
  });

  it('counts the minigame for the day it ends, not the day it started', async () => {
    const learner = await newLearner();
    // 23:59:30 in Vietnam, then 00:00:10 the next day. A token is made after each move of the clock: they expire.
    vi.setSystemTime(new Date('2026-03-10T16:59:30.000Z'));
    const { id } = (await start(bearerFor(learner))).body;
    vi.setSystemTime(new Date('2026-03-10T17:00:10.000Z'));
    expect((await finish(bearerFor(learner), id)).body).toEqual({ counted: true });

    expect(await UserDailyTasksModel.countDocuments({ owner: learner._id, date: '2026-03-11', 'progress.minigames': 1 })).toBe(1);
    expect(await UserDailyTasksModel.countDocuments({ owner: learner._id, date: '2026-03-10', 'progress.minigames': 1 })).toBe(0);
  });

  it("answers 404 for another learner's play or an unknown one, and 400 for a malformed id", async () => {
    const owner = bearerFor(await newLearner());
    const stranger = bearerFor(await newLearner());
    const { id } = (await start(owner)).body;
    later(20);

    expect((await finish(stranger, id)).status).toBe(404);
    expect((await finish(owner, '64b7f0c2a1b2c3d4e5f60718')).status).toBe(404);
    expect((await finish(owner, 'not-an-id')).status).toBe(400);
    expect(await MinigamePlayModel.countDocuments({ _id: id, finished: false })).toBe(1);
  });
});
