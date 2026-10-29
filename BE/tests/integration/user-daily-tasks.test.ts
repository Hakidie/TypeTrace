import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PASSAGE_LIST } from '../../src/data/passages';
import { DailyProgressModel } from '../../src/models/daily-progress.model';
import { DailyTaskModel, DailyTaskType } from '../../src/models/daily-task.model';
import { PassageModel } from '../../src/models/passage.model';
import { TypingSessionModel } from '../../src/models/typing-session.model';
import { UserDailyTasksModel } from '../../src/models/user-daily-tasks.model';
import { UserModel } from '../../src/models/user.model';
import { updateAppSettings } from '../../src/services/app-setting.service';
import { seedPassages } from '../../src/services/passage-seed.service';
import { MIN_FOCUS_CHANCES, recordDailyTaskProgress, WEAKNESS_SESSIONS } from '../../src/services/user-daily-tasks.service';
import type { WordErrorType } from '../../src/utils/vietnamese-errors';
import { api } from '../helpers/api';
import { bearerFor, createUser } from '../helpers/user-factory';

// Snapshots made at the same time rely on the unique { owner, date } index: wait until it is built.
beforeAll(() => UserDailyTasksModel.init());

// Today is fixed, so no test runs across a midnight: 10 March 2026, 15:00 in Vietnam.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-03-10T08:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

type Learner = { _id: unknown; email: string };

interface TemplateInput {
  title: string;
  type: DailyTaskType;
  target: number;
  description?: string;
  errorType?: WordErrorType;
  isActive?: boolean;
}

interface TaskBody {
  id: string;
  title: string;
  target: number;
  progress: number;
  completed: boolean;
}

/** Templates made one after the other: the generator reads the active ones in this order. */
const createTemplates = (...templates: TemplateInput[]) => DailyTaskModel.create(templates);

/** The learner's tasks of today. A new token each time, so a test can move the clock by a day. */
const tasksOf = (learner: Learner) => api().get('/api/profile/daily-tasks').set('Authorization', bearerFor(learner));

/** What the learner sees of each task, by title: `[progress, completed]`. */
const progressOf = async (learner: Learner) =>
  Object.fromEntries((await tasksOf(learner)).body.tasks.map((task: TaskBody) => [task.title, [task.progress, task.completed]]));

/** The stored snapshot of one of the learner's days. */
const storedDay = (owner: unknown, date = '2026-03-10') => UserDailyTasksModel.findOne({ owner, date }).lean();

/** Each stored day of the learner with its counted sessions, oldest first. */
const daysOf = async (owner: unknown) =>
  (await UserDailyTasksModel.find({ owner }).sort({ date: 1 }).lean()).map((day) => [day.date, day.progress.sessions]);

/** Saves the learner's time zone the way the page does (`TimezoneSync`). */
const setZone = (learner: Learner, timezone: string) =>
  api().patch('/api/profile/settings').set('Authorization', bearerFor(learner)).send({ timezone });

/** A counted session completed at `completedAt`, written straight to the database. */
const countedSession = (owner: unknown, completedAt: Date, fields: Record<string, unknown> = {}) => ({
  owner,
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

/** Starts a session on a passage of 23 words, as if it was opened two minutes ago. */
const start = async (authorization: string) => {
  const passage = (await PassageModel.findOne({ title: 'Tiếng Việt rất đẹp' }))!;
  const { body } = await api().post('/api/sessions').set('Authorization', authorization).send({ passageId: String(passage._id) });
  await TypingSessionModel.findByIdAndUpdate(body._id, { startedAt: new Date(Date.now() - 120_000) });
  return body as { _id: string; targetWords: string[] };
};

const complete = (authorization: string, id: string, typedWords: string[]) =>
  api().patch(`/api/sessions/${id}/complete`).set('Authorization', authorization).send({ typedWords });

/** Types the 23 words in two minutes, the first `wrong` of them wrong: a counted session. */
const typeCounted = async (learner: Learner, wrong = 0) => {
  const auth = bearerFor(learner);
  const session = await start(auth);
  const response = await complete(auth, session._id, session.targetWords.map((word, index) => (index < wrong ? 'x' : word)));
  expect(response.body.isCounted).toBe(true);
  return response;
};

describe('GET /api/profile/daily-tasks (SCRUM-112)', () => {
  it("makes today's tasks on the first request: dailyTaskCount of the active templates, never an inactive one", async () => {
    const learner = await createUser({});
    await createTemplates(
      { title: 'Ba phiên', type: 'sessions', target: 3 },
      { title: 'Mười phút', type: 'minutes', target: 10, description: 'Gõ đều tay' },
      { title: 'Gõ nhanh', type: 'wpm', target: 40 },
      { title: 'Chính xác', type: 'accuracy', target: 95 },
      { title: 'Hỏi hay ngã', type: 'accuracy', target: 90, errorType: 'HOI_NGA_CONFUSION' },
      { title: 'Nghỉ', type: 'sessions', target: 1, isActive: false },
      { title: 'Dấu thanh', type: 'accuracy', target: 80, errorType: 'TONE_WRONG', isActive: false }
    );
    await updateAppSettings({ dailyTaskCount: 4 });

    const response = await tasksOf(learner);

    expect(response.status).toBe(200);
    expect(Object.keys(response.body).sort()).toEqual(['date', 'tasks']);
    expect(response.body.date).toBe('2026-03-10');
    expect(response.body.tasks).toHaveLength(4);
    const active = await DailyTaskModel.find({ isActive: true }).lean();
    for (const task of response.body.tasks) {
      const template = active.find((item) => String(item._id) === task.id);
      expect(template).toBeDefined();
      // Only these fields: never the owner or the stored numbers, `errorType` only on a focused task.
      expect(task).toEqual({
        id: String(template!._id),
        title: template!.title,
        description: template!.description,
        type: template!.type,
        target: template!.target,
        ...(template!.errorType && { errorType: template!.errorType }),
        progress: 0,
        completed: false
      });
    }
    expect(new Set(response.body.tasks.map((task: TaskBody) => task.id)).size).toBe(4);
    // One snapshot, stored in the order answered.
    const stored = await UserDailyTasksModel.find().lean();
    expect(stored).toHaveLength(1);
    expect(String(stored[0].owner)).toBe(String(learner._id));
    expect(stored[0]).toMatchObject({
      date: '2026-03-10',
      timeZone: 'Asia/Ho_Chi_Minh',
      progress: { sessions: 0, durationMs: 0, bestWpm: 0, bestAccuracy: 0 }
    });
    expect(stored[0].tasks.map((task) => String(task.taskId))).toEqual(response.body.tasks.map((task: TaskBody) => task.id));
  });

  it('sends the description and the error type of a task as the template has them', async () => {
    const learner = await createUser({});
    const [template] = await createTemplates({
      title: 'Hỏi hay ngã',
      type: 'accuracy',
      target: 90,
      errorType: 'HOI_NGA_CONFUSION',
      description: 'Chú ý dấu hỏi và dấu ngã'
    });

    expect((await tasksOf(learner)).body).toEqual({
      date: '2026-03-10',
      tasks: [
        {
          id: String(template._id),
          title: 'Hỏi hay ngã',
          description: 'Chú ý dấu hỏi và dấu ngã',
          type: 'accuracy',
          target: 90,
          errorType: 'HOI_NGA_CONFUSION',
          progress: 0,
          completed: false
        }
      ]
    });
  });

  it('answers the same tasks to the next requests of the day, from one snapshot', async () => {
    const learner = await createUser({});
    await createTemplates(
      { title: 'Ba phiên', type: 'sessions', target: 3 },
      { title: 'Mười phút', type: 'minutes', target: 10 },
      { title: 'Gõ nhanh', type: 'wpm', target: 40 },
      { title: 'Chính xác', type: 'accuracy', target: 95 },
      { title: 'Hỏi hay ngã', type: 'accuracy', target: 90, errorType: 'HOI_NGA_CONFUSION' }
    );

    const first = await tasksOf(learner);

    for (let again = 0; again < 3; again += 1) expect((await tasksOf(learner)).body).toEqual(first.body);
    expect(await UserDailyTasksModel.countDocuments()).toBe(1);
  });

  it('keeps one snapshot when the first two requests of the day arrive at the same time', async () => {
    const learner = await createUser({});
    await createTemplates(
      { title: 'Ba phiên', type: 'sessions', target: 3 },
      { title: 'Mười phút', type: 'minutes', target: 10 },
      { title: 'Gõ nhanh', type: 'wpm', target: 40 },
      { title: 'Chính xác', type: 'accuracy', target: 95 },
      { title: 'Hỏi hay ngã', type: 'accuracy', target: 90, errorType: 'HOI_NGA_CONFUSION' }
    );

    const responses = await Promise.all([tasksOf(learner), tasksOf(learner)]);

    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(responses[1].body).toEqual(responses[0].body);
    expect(await UserDailyTasksModel.countDocuments()).toBe(1);
  });

  it('answers all the active templates when there are fewer than dailyTaskCount', async () => {
    const learner = await createUser({});
    await createTemplates(
      { title: 'Ba phiên', type: 'sessions', target: 3 },
      { title: 'Gõ nhanh', type: 'wpm', target: 40 },
      { title: 'Nghỉ', type: 'sessions', target: 1, isActive: false }
    );

    const response = await tasksOf(learner);

    expect(response.body.tasks.map((task: TaskBody) => task.title).sort()).toEqual(['Ba phiên', 'Gõ nhanh']);
  });

  it('answers no task and stores nothing while no template is active, and makes the tasks once one is', async () => {
    const learner = await createUser({});
    const [resting] = await createTemplates({ title: 'Nghỉ', type: 'sessions', target: 1, isActive: false });
    await TypingSessionModel.create(countedSession(learner._id, new Date()));

    expect((await tasksOf(learner)).body).toEqual({ date: '2026-03-10', tasks: [] });
    await recordDailyTaskProgress(String(learner._id), new Date());
    expect(await UserDailyTasksModel.countDocuments()).toBe(0);

    // Activated later the same day: the learner gets it that day, with the session already counted.
    await DailyTaskModel.updateOne({ _id: resting._id }, { isActive: true });
    expect((await tasksOf(learner)).body.tasks).toMatchObject([{ title: 'Nghỉ', progress: 1, completed: true }]);
  });

  it("keeps each learner's tasks apart", async () => {
    const me = await createUser({ email: 'me@example.com' });
    const other = await createUser({ email: 'other@example.com' });
    await createTemplates({ title: 'Một phiên', type: 'sessions', target: 1 });
    await TypingSessionModel.create(countedSession(other._id, new Date('2026-03-10T07:00:00.000Z')));

    expect(await progressOf(me)).toEqual({ 'Một phiên': [0, false] });
    expect(await progressOf(other)).toEqual({ 'Một phiên': [1, true] });
    expect((await UserDailyTasksModel.find().lean()).map((day) => String(day.owner)).sort()).toEqual(
      [String(me._id), String(other._id)].sort()
    );
  });

  it('answers 401 without a token and 404 when the signed-in user no longer exists', async () => {
    const learner = await createUser({});
    await createTemplates({ title: 'Một phiên', type: 'sessions', target: 1 });
    await UserModel.deleteOne({ _id: learner._id });

    const response = await tasksOf(learner);

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('User not found');
    expect((await api().get('/api/profile/daily-tasks')).status).toBe(401);
    expect(await UserDailyTasksModel.countDocuments()).toBe(0);
  });
});

describe('a snapshot of the day', () => {
  it("keeps today's tasks when the templates or the count change, and makes the next day from the templates as they are then", async () => {
    const learner = await createUser({});
    const adminAuth = bearerFor(await createUser({ email: 'admin@example.com', role: 'admin' }));
    const [deleted, edited, deactivated] = await createTemplates(
      { title: 'Ba phiên', type: 'sessions', target: 3 },
      { title: 'Gõ nhanh', type: 'wpm', target: 40 },
      { title: 'Chính xác', type: 'accuracy', target: 95 }
    );
    const today = await tasksOf(learner);
    expect(today.body.tasks.map((task: TaskBody) => [task.title, task.target]).sort()).toEqual([
      ['Ba phiên', 3],
      ['Chính xác', 95],
      ['Gõ nhanh', 40]
    ]);

    // An admin edits a template, deactivates one, deletes one, adds two and asks for 5 tasks a day.
    const changes = await Promise.all([
      api().patch(`/api/admin/daily-tasks/${edited._id}`).set('Authorization', adminAuth).send({ title: 'Gõ thật nhanh', target: 60 }),
      api().patch(`/api/admin/daily-tasks/${deactivated._id}`).set('Authorization', adminAuth).send({ isActive: false }),
      api().delete(`/api/admin/daily-tasks/${deleted._id}`).set('Authorization', adminAuth),
      api().post('/api/admin/daily-tasks').set('Authorization', adminAuth).send({ title: 'Mười phút', type: 'minutes', target: 10 }),
      api()
        .post('/api/admin/daily-tasks')
        .set('Authorization', adminAuth)
        .send({ title: 'Hỏi hay ngã', type: 'accuracy', target: 90, errorType: 'HOI_NGA_CONFUSION' }),
      api().put('/api/admin/daily-tasks/settings').set('Authorization', adminAuth).send({ dailyTaskCount: 5 })
    ]);
    expect(changes.map((response) => response.status)).toEqual([200, 200, 204, 201, 201, 200]);

    expect((await tasksOf(learner)).body).toEqual(today.body);

    // The next day (11 March, 15:00 in Vietnam) is made from the active templates of now.
    vi.setSystemTime(new Date('2026-03-11T08:00:00.000Z'));
    const tomorrow = await tasksOf(learner);
    expect(tomorrow.body.date).toBe('2026-03-11');
    expect(tomorrow.body.tasks.map((task: TaskBody) => [task.title, task.target]).sort()).toEqual([
      ['Gõ thật nhanh', 60],
      ['Hỏi hay ngã', 90],
      ['Mười phút', 10]
    ]);
    expect(await UserDailyTasksModel.countDocuments({ owner: learner._id })).toBe(2);
    expect((await storedDay(learner._id))!.tasks.map((task) => task.title).sort()).toEqual(['Ba phiên', 'Chính xác', 'Gõ nhanh']);
  });
});

describe('the weak error types of the learner', () => {
  const templates: TemplateInput[] = [
    { title: 'Ba phiên', type: 'sessions', target: 3 },
    { title: 'Mười phút', type: 'minutes', target: 10 },
    { title: 'Gõ nhanh', type: 'wpm', target: 40 },
    { title: 'Chính xác', type: 'accuracy', target: 95 },
    { title: 'Dấu thanh', type: 'accuracy', target: 90, errorType: 'TONE_WRONG' },
    { title: 'Chữ đ', type: 'accuracy', target: 90, errorType: 'D_MISSING' },
    { title: 'Hỏi hay ngã', type: 'accuracy', target: 90, errorType: 'HOI_NGA_CONFUSION' }
  ];

  const titlesOf = async (learner: Learner) => (await tasksOf(learner)).body.tasks.map((task: TaskBody) => task.title);

  it('gives the template of the weakest error type first, then the one of the next weak type', async () => {
    const weak = await createUser({ email: 'weak@example.com' });
    const fresh = await createUser({ email: 'fresh@example.com' });
    await createTemplates(...templates);
    // Yesterday: 8 hỏi/ngã mix-ups in 20 chances (40 %), 4 wrong tones in 80 (5 %), no đ missed in 20.
    await TypingSessionModel.create(
      [1, 2].map(() =>
        countedSession(weak._id, new Date('2026-03-09T08:00:00.000Z'), {
          errorCounts: { HOI_NGA_CONFUSION: 4, TONE_WRONG: 2 },
          opportunityCounts: { BASE_LETTER: 40, TONE_WRONG: 40, D_MISSING: 10, HOI_NGA_CONFUSION: 10 }
        })
      )
    );
    // A random pick takes the first template left: without the weak types, the first three would be picked.
    vi.spyOn(Math, 'random').mockReturnValue(0);

    expect(await titlesOf(weak)).toEqual(['Hỏi hay ngã', 'Dấu thanh', 'Ba phiên']);
    // A learner without a session has no weak type: random picks only.
    expect(await titlesOf(fresh)).toEqual(['Ba phiên', 'Mười phút', 'Gõ nhanh']);
  });

  it('reads the weak types from the last 20 counted sessions only', async () => {
    const learner = await createUser({});
    await createTemplates(...templates);
    const mixUps = { errorCounts: { HOI_NGA_CONFUSION: 10 }, opportunityCounts: { HOI_NGA_CONFUSION: 10 } };
    const lastSessions = Array.from({ length: WEAKNESS_SESSIONS }, (_, minute) => new Date(Date.UTC(2026, 2, 9, 0, minute)));
    await TypingSessionModel.create([
      // Weeks ago, full of hỏi/ngã mix-ups.
      countedSession(learner._id, new Date('2026-02-01T08:00:00.000Z'), mixUps),
      // The last 20 counted sessions, without a mix-up.
      ...lastSessions.map((completedAt) => countedSession(learner._id, completedAt, { opportunityCounts: { HOI_NGA_CONFUSION: 10 } })),
      // Newer, but not counted or not completed: never part of it.
      countedSession(learner._id, new Date('2026-03-09T12:00:00.000Z'), { ...mixUps, isCounted: false }),
      countedSession(learner._id, new Date('2026-03-09T13:00:00.000Z'), { ...mixUps, status: 'abandoned' })
    ]);
    vi.spyOn(Math, 'random').mockReturnValue(0);

    expect(await titlesOf(learner)).toEqual(['Ba phiên', 'Mười phút', 'Gõ nhanh']);

    // One session fewer: the old one is among the last 20 again, so the next day starts with hỏi/ngã.
    await TypingSessionModel.deleteOne({ owner: learner._id, completedAt: lastSessions[0] });
    vi.setSystemTime(new Date('2026-03-11T08:00:00.000Z'));
    expect(await titlesOf(learner)).toEqual(['Hỏi hay ngã', 'Ba phiên', 'Mười phút']);
  });

  it('reads an error type only from the sessions with at least 5 chances of it, the ones that can move its task', async () => {
    const few = await createUser({ email: 'few@example.com' });
    const enough = await createUser({ email: 'enough@example.com' });
    await createTemplates(...templates);
    const lastSessions = Array.from({ length: WEAKNESS_SESSIONS }, (_, minute) => new Date(Date.UTC(2026, 2, 9, 0, minute)));
    await TypingSessionModel.create(
      lastSessions.flatMap((completedAt, index) => {
        const errorCounts = { D_MISSING: index === 0 ? 1 : 0 };
        return [
          // 1 to 4 chances of a missed đ in each session, 50 in all, and one đ missed: no session counts for Chữ đ.
          countedSession(few._id, completedAt, { errorCounts, opportunityCounts: { D_MISSING: 1 + (index % 4) } }),
          // The same miss in sessions with 5 chances each, which can move it.
          countedSession(enough._id, completedAt, { errorCounts, opportunityCounts: { D_MISSING: MIN_FOCUS_CHANCES } })
        ];
      })
    );
    vi.spyOn(Math, 'random').mockReturnValue(0);

    expect(await titlesOf(few)).toEqual(['Ba phiên', 'Mười phút', 'Gõ nhanh']);
    expect(await titlesOf(enough)).toEqual(['Chữ đ', 'Ba phiên', 'Mười phút']);
  });
});

describe('the progress of the tasks', () => {
  // Typing picks its passage from the database, which the tests start empty.
  beforeEach(async () => {
    await seedPassages(PASSAGE_LIST);
  });

  it('moves the sessions, minutes, wpm and accuracy tasks after each counted session', async () => {
    const learner = await createUser({});
    await createTemplates(
      { title: 'Hai phiên', type: 'sessions', target: 2 },
      { title: 'Bốn phút', type: 'minutes', target: 4 },
      { title: 'Gõ đều', type: 'wpm', target: 11 },
      { title: 'Chính xác', type: 'accuracy', target: 96 }
    );
    await updateAppSettings({ dailyTaskCount: 4 });
    expect(await progressOf(learner)).toEqual({
      'Hai phiên': [0, false],
      'Bốn phút': [0, false],
      'Gõ đều': [0, false],
      'Chính xác': [0, false]
    });

    // One wrong word of 23 in two minutes: 22 correct words, 11 WPM, 95.7 % accuracy.
    await typeCounted(learner, 1);
    expect(await progressOf(learner)).toEqual({
      'Hai phiên': [1, false],
      'Bốn phút': [2, false],
      'Gõ đều': [11, true],
      'Chính xác': [95.7, false]
    });

    // All 23 words right: 11.5 WPM and 100 %.
    await typeCounted(learner);
    expect(await progressOf(learner)).toEqual({
      'Hai phiên': [2, true],
      'Bốn phút': [4, true],
      'Gõ đều': [11.5, true],
      'Chính xác': [100, true]
    });
  });

  it('changes nothing for a session that is not counted', async () => {
    const learner = await createUser({});
    await createTemplates({ title: 'Một phiên', type: 'sessions', target: 1 }, { title: 'Gõ chậm', type: 'wpm', target: 5 });
    await tasksOf(learner);
    const auth = bearerFor(learner);
    const session = await start(auth);

    // 10 words only (5 WPM): saved, not counted.
    expect((await complete(auth, session._id, session.targetWords.slice(0, 10))).body.isCounted).toBe(false);

    expect(await progressOf(learner)).toEqual({ 'Một phiên': [0, false], 'Gõ chậm': [0, false] });
    expect((await storedDay(learner._id))!.progress).toMatchObject({ sessions: 0, durationMs: 0, bestWpm: 0, bestAccuracy: 0 });
  });

  it('counts the sessions completed that day before the tasks were made', async () => {
    const learner = await createUser({});
    await createTemplates(
      { title: 'Ba phiên', type: 'sessions', target: 3 },
      { title: 'Hai phút', type: 'minutes', target: 2 },
      { title: 'Gõ nhanh', type: 'wpm', target: 40 },
      { title: 'Chính xác', type: 'accuracy', target: 98 }
    );
    await updateAppSettings({ dailyTaskCount: 4 });
    await TypingSessionModel.create([
      // This morning in Vietnam: two counted sessions.
      countedSession(learner._id, new Date('2026-03-10T01:00:00.000Z'), { durationMs: 90_000, wpm: 35, accuracy: 97 }),
      countedSession(learner._id, new Date('2026-03-10T02:00:00.000Z'), { durationMs: 45_000, wpm: 41.5, accuracy: 92 }),
      // 23:59:59.999 yesterday in Vietnam, and a session that is not counted: left out.
      countedSession(learner._id, new Date('2026-03-09T16:59:59.999Z'), { durationMs: 600_000, wpm: 80, accuracy: 100 }),
      countedSession(learner._id, new Date('2026-03-10T03:00:00.000Z'), { isCounted: false, durationMs: 600_000, wpm: 90, accuracy: 100 })
    ]);

    // 135 000 ms are 2.25 minutes, shown as 2.2.
    expect(await progressOf(learner)).toEqual({
      'Ba phiên': [2, false],
      'Hai phút': [2.2, true],
      'Gõ nhanh': [41.5, true],
      'Chính xác': [97, false]
    });
  });

  it('measures a focused accuracy task only on the sessions with at least 5 chances of its error type', async () => {
    const learner = await createUser({});
    await createTemplates(
      { title: 'Hỏi hay ngã', type: 'accuracy', target: 80, errorType: 'HOI_NGA_CONFUSION' },
      { title: 'Dấu thanh', type: 'accuracy', target: 90, errorType: 'TONE_WRONG' },
      { title: 'Chính xác', type: 'accuracy', target: 90 }
    );

    // The passage gives 23 chances of a wrong tone but only 2 of a hỏi/ngã mix-up (khuỷu, thuỷ): too few for that task.
    await typeCounted(learner);
    expect(await progressOf(learner)).toEqual({ 'Hỏi hay ngã': [0, false], 'Dấu thanh': [100, true], 'Chính xác': [100, true] });

    // Then 4 chances without a mix-up (too few again), 8 chances with 2 mix-ups (75 %), 5 with 1 (80 %, the target).
    const sessions = [
      { chances: 4, errors: 0, shown: [0, false] },
      { chances: 8, errors: 2, shown: [75, false] },
      { chances: 5, errors: 1, shown: [80, true] }
    ];
    for (const { chances, errors, shown } of sessions) {
      const completedAt = new Date();
      await TypingSessionModel.create(
        countedSession(learner._id, completedAt, {
          errorCounts: { HOI_NGA_CONFUSION: errors },
          opportunityCounts: { HOI_NGA_CONFUSION: chances }
        })
      );
      // What `completeSession` does once it has saved a counted session.
      await recordDailyTaskProgress(String(learner._id), completedAt);
      expect((await progressOf(learner))['Hỏi hay ngã']).toEqual(shown);
    }
  });
});

describe('recording a session again', () => {
  beforeEach(async () => {
    await seedPassages(PASSAGE_LIST);
  });

  it('gives the same numbers when the same session is recorded twice', async () => {
    const learner = await createUser({});
    await createTemplates({ title: 'Ba phiên', type: 'sessions', target: 3 });
    const completedAt = new Date();
    await TypingSessionModel.create(
      countedSession(learner._id, completedAt, {
        durationMs: 75_000,
        wpm: 33,
        accuracy: 96,
        errorCounts: { TONE_WRONG: 1 },
        opportunityCounts: { TONE_WRONG: 20 }
      })
    );

    await recordDailyTaskProgress(String(learner._id), completedAt);
    const once = (await storedDay(learner._id))!.progress;
    await recordDailyTaskProgress(String(learner._id), completedAt);

    expect((await storedDay(learner._id))!.progress).toEqual(once);
    expect(once).toEqual({ sessions: 1, durationMs: 75_000, bestWpm: 33, bestAccuracy: 96, bestErrorAccuracy: { TONE_WRONG: 95 } });
  });

  it('never takes the numbers of the day back', async () => {
    const learner = await createUser({});
    await createTemplates({ title: 'Ba phiên', type: 'sessions', target: 3 });
    const completedAt = new Date();
    const [, faster] = await TypingSessionModel.create([
      countedSession(learner._id, completedAt),
      countedSession(learner._id, completedAt, { wpm: 50 })
    ]);
    await recordDailyTaskProgress(String(learner._id), completedAt);

    // A late write from a request that read the day before the faster session was saved: here, the day without it.
    await TypingSessionModel.deleteOne({ _id: faster._id });
    await recordDailyTaskProgress(String(learner._id), completedAt);

    expect((await storedDay(learner._id))!.progress).toMatchObject({ sessions: 2, durationMs: 120_000, bestWpm: 50 });
  });

  it('counts a session completed twice in a row once (200, then 409)', async () => {
    const learner = await createUser({});
    await createTemplates({ title: 'Ba phiên', type: 'sessions', target: 3 }, { title: 'Năm phút', type: 'minutes', target: 5 });
    const auth = bearerFor(learner);
    const session = await start(auth);

    expect((await complete(auth, session._id, session.targetWords)).status).toBe(200);
    const again = await complete(auth, session._id, session.targetWords);

    expect(again.status).toBe(409);
    expect((await storedDay(learner._id))!.progress).toMatchObject({ sessions: 1, durationMs: 120_000 });
    expect(await progressOf(learner)).toEqual({ 'Ba phiên': [1, false], 'Năm phút': [2, false] });
  });

  it('counts once a session completed by two requests at the same time (one 200, one 409)', async () => {
    const learner = await createUser({});
    await createTemplates({ title: 'Ba phiên', type: 'sessions', target: 3 }, { title: 'Năm phút', type: 'minutes', target: 5 });
    const auth = bearerFor(learner);
    const session = await start(auth);

    const responses = await Promise.all([
      complete(auth, session._id, session.targetWords),
      complete(auth, session._id, session.targetWords)
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect((await storedDay(learner._id))!.progress).toMatchObject({ sessions: 1, durationMs: 120_000 });
    expect(await UserDailyTasksModel.countDocuments()).toBe(1);
  });
});

describe("the learner's day", () => {
  beforeEach(async () => {
    await seedPassages(PASSAGE_LIST);
  });

  it('puts a session completed at 23:59:59.999 in Vietnam on that day, and one at midnight on a new day with its own tasks', async () => {
    const learner = await createUser({});
    await createTemplates({ title: 'Một phiên', type: 'sessions', target: 1 }, { title: 'Hai phiên', type: 'sessions', target: 2 });

    // 16:59:59.999 UTC is 23:59:59.999 on 10 March in Vietnam.
    vi.setSystemTime(new Date('2026-03-10T16:59:59.999Z'));
    await typeCounted(learner);
    expect((await tasksOf(learner)).body.date).toBe('2026-03-10');

    // 17:00 UTC is midnight: 11 March has tasks of its own, none done yet.
    vi.setSystemTime(new Date('2026-03-10T17:00:00.000Z'));
    const midnight = await tasksOf(learner);
    expect(midnight.body.date).toBe('2026-03-11');
    expect(midnight.body.tasks.map((task: TaskBody) => task.progress)).toEqual([0, 0]);
    await typeCounted(learner);

    expect(await daysOf(learner._id)).toEqual([
      ['2026-03-10', 1],
      ['2026-03-11', 1]
    ]);
  });

  it("cuts the day at the learner's own midnight in another zone", async () => {
    const newYork = await createUser({ email: 'ny@example.com' });
    const vietnam = await createUser({ email: 'vn@example.com' });
    await UserModel.updateOne({ _id: newYork._id }, { $set: { 'settings.timezone': 'America/New_York' } });
    await createTemplates({ title: 'Một phiên', type: 'sessions', target: 1 });

    // New York is on summer time (UTC-4) from 8 March 2026: its 11 March starts at 04:00 UTC.
    vi.setSystemTime(new Date('2026-03-11T03:59:59.999Z'));
    await typeCounted(newYork);
    expect((await tasksOf(newYork)).body.date).toBe('2026-03-10');
    expect((await tasksOf(vietnam)).body.date).toBe('2026-03-11');

    vi.setSystemTime(new Date('2026-03-11T04:00:00.000Z'));
    expect((await tasksOf(newYork)).body).toMatchObject({ date: '2026-03-11', tasks: [{ progress: 0, completed: false }] });
    await typeCounted(newYork);

    expect(await daysOf(newYork._id)).toEqual([
      ['2026-03-10', 1],
      ['2026-03-11', 1]
    ]);
  });

  it('uses the default zone (Asia/Ho_Chi_Minh) for a learner who never sent one', async () => {
    // 17:30 UTC on 10 March is 00:30 on 11 March in Vietnam.
    vi.setSystemTime(new Date('2026-03-10T17:30:00.000Z'));
    const old = await createUser({});
    await UserModel.collection.updateOne({ _id: old._id }, { $unset: { 'settings.timezone': '' } });
    await createTemplates({ title: 'Một phiên', type: 'sessions', target: 1 });

    await typeCounted(old);

    expect((await tasksOf(old)).body).toMatchObject({ date: '2026-03-11', tasks: [{ progress: 1, completed: true }] });
    expect(await daysOf(old._id)).toEqual([['2026-03-11', 1]]);
  });

  it('uses the default zone for a stored zone this server does not know, before and after a counted session', async () => {
    // 17:30 UTC on 10 March is 00:30 on 11 March in Vietnam.
    vi.setSystemTime(new Date('2026-03-10T17:30:00.000Z'));
    const odd = await createUser({});
    await UserModel.collection.updateOne({ _id: odd._id }, { $set: { 'settings.timezone': 'Mars/Olympus' } });
    await createTemplates({ title: 'Một phiên', type: 'sessions', target: 1 });
    expect((await tasksOf(odd)).body).toMatchObject({ date: '2026-03-11', tasks: [{ progress: 0, completed: false }] });

    await typeCounted(odd);

    const response = await tasksOf(odd);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ date: '2026-03-11', tasks: [{ progress: 1, completed: true }] });
    expect(await storedDay(odd._id, '2026-03-11')).toMatchObject({ timeZone: 'Asia/Ho_Chi_Minh', progress: { sessions: 1 } });
  });

  it('finds the sessions at both ends of a day in every zone Intl takes, offsets beyond UTC+14 included', async () => {
    await createTemplates({ title: 'Một phiên', type: 'sessions', target: 1 });
    const edges = [
      // UTC+14: 11 March starts at 10:00 UTC on 10 March.
      { timezone: 'Pacific/Kiritimati', completedAt: '2026-03-10T10:00:00.000Z', date: '2026-03-11' },
      // UTC-12 (the sign of the Etc names is the other way round): 10 March ends at 12:00 UTC on 11 March.
      { timezone: 'Etc/GMT+12', completedAt: '2026-03-11T11:59:59.999Z', date: '2026-03-10' },
      // An offset, which the settings take like any zone Intl knows: 11 March starts 15 hours before its UTC midnight.
      { timezone: '+15:00', completedAt: '2026-03-10T09:00:00.000Z', date: '2026-03-11' }
    ];

    for (const [index, { timezone, completedAt, date }] of edges.entries()) {
      const learner = await createUser({ email: `edge${index}@example.com` });
      vi.setSystemTime(new Date(completedAt));
      expect((await setZone(learner, timezone)).status).toBe(200);
      await TypingSessionModel.create(countedSession(learner._id, new Date(completedAt)));

      expect((await tasksOf(learner)).body).toMatchObject({ date, tasks: [{ progress: 1, completed: true }] });
    }
  });
});

describe('a change of time zone', () => {
  beforeEach(async () => {
    await seedPassages(PASSAGE_LIST);
  });

  /** Two counted sessions at 17:30 and 17:40 UTC on 10 March: on 11 March in Vietnam, the default zone. */
  const typeTwoOnVietnamEleventh = async (learner: Learner) => {
    for (const time of ['2026-03-10T17:30:00.000Z', '2026-03-10T17:40:00.000Z']) {
      vi.setSystemTime(new Date(time));
      await typeCounted(learner);
    }
    expect(await storedDay(learner._id, '2026-03-11')).toMatchObject({ timeZone: 'Asia/Ho_Chi_Minh', progress: { sessions: 2 } });
  };

  it('works the numbers of the day out again in the new zone, then counts its sessions from there', async () => {
    const learner = await createUser({});
    await createTemplates({ title: 'Hai phiên', type: 'sessions', target: 2 });
    await typeTwoOnVietnamEleventh(learner);

    // The learner moves to UTC, where both sessions are on 10 March.
    expect((await setZone(learner, 'UTC')).status).toBe(200);
    vi.setSystemTime(new Date('2026-03-11T08:00:00.000Z'));

    expect((await tasksOf(learner)).body).toMatchObject({ date: '2026-03-11', tasks: [{ progress: 0, completed: false }] });
    expect(await storedDay(learner._id, '2026-03-11')).toMatchObject({ timeZone: 'UTC', progress: { sessions: 0 } });
    await typeCounted(learner);
    expect((await tasksOf(learner)).body.tasks).toMatchObject([{ progress: 1, completed: false }]);
  });

  it('never counts a session in the numbers of two days', async () => {
    const learner = await createUser({});
    await createTemplates({ title: 'Ba phiên', type: 'sessions', target: 3 });
    await typeTwoOnVietnamEleventh(learner);

    // In UTC the two sessions are on 10 March, still today there: that day gets them.
    expect((await setZone(learner, 'UTC')).status).toBe(200);
    vi.setSystemTime(new Date('2026-03-10T18:00:00.000Z'));
    expect((await tasksOf(learner)).body).toMatchObject({ date: '2026-03-10', tasks: [{ progress: 2 }] });
    // The first counted session of 11 March in UTC cuts that day again: the two sessions leave it.
    vi.setSystemTime(new Date('2026-03-11T08:00:00.000Z'));
    await typeCounted(learner);

    expect(await daysOf(learner._id)).toEqual([
      ['2026-03-10', 2],
      ['2026-03-11', 1]
    ]);
    expect((await UserDailyTasksModel.find({ owner: learner._id }).lean()).map((day) => day.timeZone)).toEqual(['UTC', 'UTC']);
  });

  it('shows numbers of the new zone at once when a request made the day before the zone was saved', async () => {
    const learner = await createUser({});
    await createTemplates({ title: 'Hai phiên', type: 'sessions', target: 2 }, { title: 'Gõ nhanh', type: 'wpm', target: 40 });
    await TypingSessionModel.create([
      // 01:00 on 10 March in Vietnam, still 9 March in UTC.
      countedSession(learner._id, new Date('2026-03-09T18:00:00.000Z'), { wpm: 50 }),
      // 10 March in both zones.
      countedSession(learner._id, new Date('2026-03-10T07:00:00.000Z'), { wpm: 30 })
    ]);
    // The page asks for the tasks while the browser's zone is on its way: the day is made in Vietnam.
    expect(await progressOf(learner)).toEqual({ 'Hai phiên': [2, true], 'Gõ nhanh': [50, true] });

    expect((await setZone(learner, 'UTC')).status).toBe(200);

    // The refresh after the save: 10 March of UTC, without the session of 9 March and its speed.
    expect((await tasksOf(learner)).body.date).toBe('2026-03-10');
    expect(await progressOf(learner)).toEqual({ 'Hai phiên': [1, false], 'Gõ nhanh': [30, false] });
    expect(await storedDay(learner._id)).toMatchObject({ timeZone: 'UTC', progress: { sessions: 1, bestWpm: 30 } });
  });

  it('works the same numbers out again under another name of the same zone', async () => {
    const learner = await createUser({});
    await createTemplates({ title: 'Hai phiên', type: 'sessions', target: 2 });
    await TypingSessionModel.create(countedSession(learner._id, new Date('2026-03-10T07:00:00.000Z')));
    const before = await tasksOf(learner);

    // Chrome names Vietnam Asia/Saigon.
    expect((await setZone(learner, 'Asia/Saigon')).status).toBe(200);

    expect((await tasksOf(learner)).body).toEqual(before.body);
    expect(await storedDay(learner._id)).toMatchObject({ timeZone: 'Asia/Saigon', progress: { sessions: 1 } });
  });

  it('cuts the day in the new zone once: a late request that read it in the old zone never takes it back', async () => {
    const learner = await createUser({});
    await createTemplates({ title: 'Ba phiên', type: 'sessions', target: 3 });
    // 10 March in Vietnam and in UTC alike.
    await TypingSessionModel.create(countedSession(learner._id, new Date('2026-03-10T07:00:00.000Z')));
    await tasksOf(learner);
    expect((await setZone(learner, 'UTC')).status).toBe(200);
    // A request reads the day, still cut in Vietnam, and the sessions of the day: only the first one.
    const readEarly = await UserDailyTasksModel.findOne({ owner: learner._id, date: '2026-03-10' });

    // Meanwhile a counted session cuts the day in UTC, with both sessions.
    const [later] = await TypingSessionModel.create([countedSession(learner._id, new Date('2026-03-10T07:30:00.000Z'))]);
    await recordDailyTaskProgress(String(learner._id), later.completedAt!);
    expect(await storedDay(learner._id)).toMatchObject({ timeZone: 'UTC', progress: { sessions: 2 } });

    // Then the early request writes what it read: here, the day without the later session.
    await TypingSessionModel.deleteOne({ _id: later._id });
    vi.spyOn(UserDailyTasksModel, 'findOne').mockResolvedValueOnce(readEarly);
    await tasksOf(learner);

    expect(await storedDay(learner._id)).toMatchObject({ timeZone: 'UTC', progress: { sessions: 2 } });
  });
});

describe('a daily task write that fails', () => {
  beforeEach(async () => {
    await seedPassages(PASSAGE_LIST);
  });

  it('answers 200 when the tasks cannot be made: the session stays completed and counted in DailyProgress, the error is logged', async () => {
    const learner = await createUser({});
    await createTemplates({ title: 'Một phiên', type: 'sessions', target: 1 });
    const auth = bearerFor(learner);
    const session = await start(auth);
    vi.spyOn(UserDailyTasksModel, 'findOneAndUpdate').mockRejectedValueOnce(new Error('Database offline'));
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await complete(auth, session._id, session.targetWords);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'completed', isCounted: true });
    expect(logged).toHaveBeenCalledWith(expect.stringContaining('Daily tasks not updated'), expect.any(Error));
    expect(await DailyProgressModel.findOne({ owner: learner._id }).lean()).toMatchObject({ date: '2026-03-10', sessions: 1 });
    expect(await UserDailyTasksModel.countDocuments()).toBe(0);
    // The first request of the day makes the tasks with the session in them.
    expect(await progressOf(learner)).toEqual({ 'Một phiên': [1, true] });
  });

  it('catches up with the next counted session of the day when the numbers cannot be written', async () => {
    const learner = await createUser({});
    await createTemplates({ title: 'Hai phiên', type: 'sessions', target: 2 });
    await tasksOf(learner);
    vi.spyOn(UserDailyTasksModel, 'updateOne').mockRejectedValueOnce(new Error('Database offline'));
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect((await typeCounted(learner)).status).toBe(200);
    expect(logged).toHaveBeenCalledWith(expect.stringContaining('Daily tasks not updated'), expect.any(Error));
    expect(await progressOf(learner)).toEqual({ 'Hai phiên': [0, false] });

    // The next counted session works the day out again from both sessions.
    await typeCounted(learner);
    expect(await progressOf(learner)).toEqual({ 'Hai phiên': [2, true] });
    expect(await DailyProgressModel.findOne({ owner: learner._id }).lean()).toMatchObject({ sessions: 2 });
  });
});
