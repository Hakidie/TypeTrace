import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DailyTaskModel, DailyTaskType } from '../../src/models/daily-task.model';
import { TypingSessionModel } from '../../src/models/typing-session.model';
import { UserDailyTasksModel } from '../../src/models/user-daily-tasks.model';
import { UserModel } from '../../src/models/user.model';
import { updateAppSettings } from '../../src/services/app-setting.service';
import { recordDailyTaskProgress } from '../../src/services/user-daily-tasks.service';
import { api } from '../helpers/api';
import { bearerFor, createUser } from '../helpers/user-factory';

// Coins for completed daily tasks (SCRUM-301).
beforeAll(() => UserDailyTasksModel.init());

// Today is fixed: 10 March 2026, 15:00 in Vietnam.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-03-10T08:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

type Learner = { _id: unknown; email: string };

const template = (title: string, type: DailyTaskType, target: number, coins?: number) => ({ title, type, target, ...(coins !== undefined && { coins }) });

const tasksOf = (learner: Learner) => api().get('/api/profile/daily-tasks').set('Authorization', bearerFor(learner));

const coinsOf = async (learner: Learner) => (await UserModel.findById(learner._id).select('coins').lean())!.coins;

/** A counted session of the learner completed now, written straight to the database, then recorded. */
const countSession = async (learner: Learner, fields: Record<string, unknown> = {}) => {
  const completedAt = new Date();
  await TypingSessionModel.create({
    owner: learner._id,
    passageId: 'p1',
    targetWords: ['a'],
    status: 'completed',
    isCounted: true,
    completedAt,
    durationMs: 60_000,
    wpm: 30,
    accuracy: 95,
    ...fields
  });
  await recordDailyTaskProgress(String(learner._id), completedAt);
};

describe('the coins of a daily task template', () => {
  it('default to 0 for a template saved without them', async () => {
    const task = await DailyTaskModel.create(template('Hai phiên', 'sessions', 2));
    expect(task.coins).toBe(0);
  });
});

describe('paying the coins of a completed task', () => {
  it('adds the coins once the task is completed, and shows the task as paid', async () => {
    const learner = await createUser({});
    await DailyTaskModel.create([template('Hai phiên', 'sessions', 2, 15)]);
    expect((await tasksOf(learner)).body.tasks[0]).toMatchObject({ coins: 15, completed: false, rewarded: false });

    await countSession(learner);
    expect(await coinsOf(learner)).toBe(0);
    expect((await tasksOf(learner)).body.tasks[0]).toMatchObject({ coins: 15, completed: false, rewarded: false });

    await countSession(learner);
    expect(await coinsOf(learner)).toBe(15);
    expect((await tasksOf(learner)).body.tasks[0]).toMatchObject({ coins: 15, completed: true, rewarded: true });
  });

  it('pays a task once: recording the same session again, or more sessions, adds nothing', async () => {
    const learner = await createUser({});
    await DailyTaskModel.create([template('Một phiên', 'sessions', 1, 10)]);
    const completedAt = new Date();
    await countSession(learner);

    await recordDailyTaskProgress(String(learner._id), completedAt);
    await countSession(learner);

    expect(await coinsOf(learner)).toBe(10);
  });

  it('pays once when two recordings run at the same time', async () => {
    const learner = await createUser({});
    await DailyTaskModel.create([template('Một phiên', 'sessions', 1, 10)]);
    const completedAt = new Date();
    await TypingSessionModel.create({
      owner: learner._id, passageId: 'p1', targetWords: ['a'], status: 'completed', isCounted: true, completedAt, durationMs: 60_000, wpm: 30, accuracy: 95
    });

    await Promise.all([1, 2, 3].map(() => recordDailyTaskProgress(String(learner._id), completedAt)));

    expect(await coinsOf(learner)).toBe(10);
  });

  it('pays each completed task its own coins, and nothing for a task without coins or one not completed', async () => {
    const learner = await createUser({});
    await DailyTaskModel.create([
      template('Một phiên', 'sessions', 1, 10),
      template('Gõ nhanh', 'wpm', 100, 40),
      template('Không thưởng', 'sessions', 1)
    ]);
    await updateAppSettings({ dailyTaskCount: 3 });

    await countSession(learner);

    expect(await coinsOf(learner)).toBe(10);
    const day = await UserDailyTasksModel.findOne({ owner: learner._id }).lean();
    expect(day!.rewardedTaskIds).toHaveLength(1);
  });

  it('adds the coins to the ones the learner already has', async () => {
    const learner = await createUser({});
    await UserModel.updateOne({ _id: learner._id }, { coins: 95 });
    await DailyTaskModel.create([template('Một phiên', 'sessions', 1, 10)]);

    await countSession(learner);

    expect(await coinsOf(learner)).toBe(105);
  });

  it('pays again the next day, for the next day\'s task', async () => {
    const learner = await createUser({});
    await DailyTaskModel.create([template('Một phiên', 'sessions', 1, 10)]);
    await countSession(learner);

    vi.setSystemTime(new Date('2026-03-11T08:00:00.000Z'));
    await countSession(learner);

    expect(await coinsOf(learner)).toBe(20);
  });
});

describe('the coins of a snapshot', () => {
  it('keep the value the template had when the day was made; a change applies from the next day', async () => {
    const learner = await createUser({});
    const [task] = await DailyTaskModel.create([template('Một phiên', 'sessions', 1, 10)]);
    expect((await tasksOf(learner)).body.tasks[0].coins).toBe(10);

    await DailyTaskModel.updateOne({ _id: task._id }, { coins: 50 });
    await countSession(learner);
    expect(await coinsOf(learner)).toBe(10);

    vi.setSystemTime(new Date('2026-03-11T08:00:00.000Z'));
    expect((await tasksOf(learner)).body.tasks[0].coins).toBe(50);
    await countSession(learner);
    expect(await coinsOf(learner)).toBe(60);
  });

  it('read as 0 on a day stored before coins existed: a completed task pays nothing', async () => {
    const learner = await createUser({});
    const [task] = await DailyTaskModel.create([template('Một phiên', 'sessions', 1, 10)]);
    await UserDailyTasksModel.collection.insertOne({
      owner: learner._id,
      date: '2026-03-10',
      timeZone: 'Asia/Ho_Chi_Minh',
      tasks: [{ taskId: task._id, title: 'Một phiên', description: '', type: 'sessions', target: 1 }],
      progress: { sessions: 0, durationMs: 0, bestWpm: 0, bestAccuracy: 0, minigames: 0, bestErrorAccuracy: {} }
    });

    await countSession(learner);

    expect(await coinsOf(learner)).toBe(0);
    expect((await tasksOf(learner)).body.tasks[0]).toMatchObject({ coins: 0, completed: true, rewarded: false });
  });

  it('pay nothing on a read: only a recorded session, minigame or duel pays', async () => {
    const learner = await createUser({});
    await DailyTaskModel.create([template('Một phiên', 'sessions', 1, 10)]);
    await tasksOf(learner);

    await tasksOf(learner);

    expect(await coinsOf(learner)).toBe(0);
  });
});

describe('a failed payment', () => {
  it('never fails the recording, and the next one pays', async () => {
    const learner = await createUser({});
    await DailyTaskModel.create([template('Một phiên', 'sessions', 1, 10)]);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const update = vi.spyOn(UserModel, 'updateOne').mockRejectedValueOnce(new Error('down'));

    await expect(countSession(learner)).resolves.toBeUndefined();
    expect(error).toHaveBeenCalled();
    update.mockRestore();
    error.mockRestore();
    expect(await coinsOf(learner)).toBe(0);
  });
});
