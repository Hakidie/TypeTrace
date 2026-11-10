import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DailyTaskModel } from '../../src/models/daily-task.model';
import { MatchModel, MatchResult } from '../../src/models/match.model';
import { MinigamePlayModel, Minigame } from '../../src/models/minigame-play.model';
import { UserDailyTasksModel } from '../../src/models/user-daily-tasks.model';
import { UserModel } from '../../src/models/user.model';
import { recordDailyTaskProgress } from '../../src/services/user-daily-tasks.service';
import { api } from '../helpers/api';
import { bearerFor, createUser } from '../helpers/user-factory';

beforeAll(() => UserDailyTasksModel.init());

// Today is fixed: 10 March 2026, 15:00 in Vietnam (08:00Z).
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-03-10T08:00:00.000Z'));
});
afterEach(() => vi.useRealTimers());

type Learner = Awaited<ReturnType<typeof createUser>>;

let counter = 0;
const newLearner = async () => {
  counter += 1;
  const learner = await createUser({ email: `mini${counter}@example.com` });
  await UserModel.updateOne({ _id: learner._id }, { 'settings.timezone': 'Asia/Ho_Chi_Minh' });
  return learner;
};

const at = (iso: string) => new Date(iso);

/** A play of a minigame, finished (or still open) at `finishedAt`. */
const play = (owner: Learner, finishedAt: Date | null, game: Minigame = 'chain') =>
  MinigamePlayModel.create({
    owner: owner._id,
    game,
    startedAt: new Date((finishedAt ?? new Date()).getTime() - 60_000),
    finished: finishedAt !== null,
    ...(finishedAt && { finishedAt })
  });

/** A ranked duel of the learner that ended at `endedAt`. */
const duel = (learner: Learner, fields: { result?: MatchResult; endedAt?: Date } & Record<string, unknown> = {}) => {
  counter += 1;
  const { result = 'win', endedAt = at('2026-03-10T03:00:00.000Z'), ...rest } = fields;
  return MatchModel.create({
    code: `DUEL${counter}`,
    kind: 'rain',
    status: 'finished',
    flagged: false,
    passageTitle: 'Rain',
    targetWords: ['a'],
    endedAt,
    players: [{ user: learner._id, displayName: 'Lan', avatar: learner.avatar, result }],
    ...rest
  });
};

/** Gives the learner an active `minigames` task of `target`, records the day and reads the stored number of minigames. */
const minigamesToday = async (learner: Learner, target = 2) => {
  await DailyTaskModel.create({ title: 'Chơi minigame', type: 'minigames', target });
  await recordDailyTaskProgress(learner._id as string, new Date());
  return (await UserDailyTasksModel.findOne({ owner: learner._id, date: '2026-03-10' }).lean())?.progress.minigames;
};

describe('the minigames of a learner day', () => {
  it('counts a finished play and a won duel of the day, and completes the task', async () => {
    const learner = await newLearner();
    await play(learner, at('2026-03-10T02:00:00.000Z'), 'rain');
    await duel(learner);

    expect(await minigamesToday(learner)).toBe(2);
    const tasks = (await api().get('/api/profile/daily-tasks').set('Authorization', bearerFor(learner))).body.tasks;
    expect(tasks).toMatchObject([{ type: 'minigames', target: 2, progress: 2, completed: true }]);
  });

  it('counts a lost and a drawn duel, and a duel the pair limit left unrated', async () => {
    const learner = await newLearner();
    await duel(learner, { result: 'loss' });
    await duel(learner, { result: 'draw', kind: 'race', passageId: learner._id });
    await duel(learner, { unratedReason: 'pair-limit' });

    expect(await minigamesToday(learner, 5)).toBe(3);
  });

  it('counts neither an open play, nor a forfeited, flagged, interrupted or unfinished duel', async () => {
    const learner = await newLearner();
    await play(learner, null);
    await duel(learner, { result: 'forfeit' });
    await duel(learner, { flagged: true });
    await duel(learner, { unratedReason: 'interrupted' });
    await duel(learner, { status: 'running' });

    expect(await minigamesToday(learner)).toBe(0);
  });

  it('counts only the learner own plays and duels', async () => {
    const learner = await newLearner();
    const other = await newLearner();
    await play(other, at('2026-03-10T02:00:00.000Z'));
    await duel(other);

    expect(await minigamesToday(learner)).toBe(0);
  });

  it('counts a minigame for the day of its finish in the learner zone: 23:30 and 00:30 in Vietnam are two days', async () => {
    const learner = await newLearner();
    await play(learner, at('2026-03-09T16:30:00.000Z'));
    await play(learner, at('2026-03-09T17:30:00.000Z'));
    await duel(learner, { endedAt: at('2026-03-10T17:30:00.000Z') });

    expect(await minigamesToday(learner)).toBe(1);
  });

  it('gives the same number when the day is recorded twice', async () => {
    const learner = await newLearner();
    await play(learner, at('2026-03-10T02:00:00.000Z'));

    expect(await minigamesToday(learner)).toBe(1);
    await recordDailyTaskProgress(learner._id as string, new Date());
    expect((await UserDailyTasksModel.findOne({ owner: learner._id }).lean())?.progress.minigames).toBe(1);
  });
});
