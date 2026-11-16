import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppSettingModel } from '../../src/models/app-setting.model';
import { DailyTaskModel } from '../../src/models/daily-task.model';
import { MatchModel } from '../../src/models/match.model';
import { MinigamePlayModel } from '../../src/models/minigame-play.model';
import { TypingSessionModel } from '../../src/models/typing-session.model';
import { UserModel } from '../../src/models/user.model';
import { updateDailyTask } from '../../src/services/admin-daily-task.service';
import { updateAppSettings } from '../../src/services/app-setting.service';
import { recordDailyTaskProgress } from '../../src/services/user-daily-tasks.service';
import type { UpdateDailyTaskInput } from '../../src/validators/admin-daily-task.validator';
import { api } from '../helpers/api';
import { bearerFor, createUser } from '../helpers/user-factory';

// Builds the indexes first: the unique `key` of the settings, for the test that saves them twice at the same time.
beforeAll(() => Promise.all([AppSettingModel.init(), DailyTaskModel.init()]));

const input = { title: 'Khởi động', type: 'sessions', target: 3 };

const signInAdmin = async () => bearerFor(await createUser({ email: 'admin@example.com', role: 'admin', displayName: 'Admin' }));

const create = (auth: string, body: object = input) => api().post('/api/admin/daily-tasks').set('Authorization', auth).send(body);

const update = (auth: string, id: string, body: object) =>
  api().patch(`/api/admin/daily-tasks/${id}`).set('Authorization', auth).send(body);

const readSettings = (auth: string) => api().get('/api/admin/daily-tasks/settings').set('Authorization', auth);

const saveSettings = (auth: string, body: object) =>
  api().put('/api/admin/daily-tasks/settings').set('Authorization', auth).send(body);

/** The fields named by a 400 `{ errors: [{ field, message }] }`. */
const fieldsOf = (response: { body: { errors?: { field: string }[] } }) => (response.body.errors ?? []).map((error) => error.field);

describe('admin daily tasks access', () => {
  it('is open to admins only: learners get 403 and anonymous visitors 401', async () => {
    const learnerAuth = bearerFor(await createUser({ email: 'learner@example.com' }));
    const auth = await signInAdmin();
    const { _id: id } = (await create(auth)).body;
    const requests = [
      () => api().get('/api/admin/daily-tasks'),
      () => api().post('/api/admin/daily-tasks').send(input),
      () => api().get(`/api/admin/daily-tasks/${id}`),
      () => api().patch(`/api/admin/daily-tasks/${id}`).send({ title: 'Hijacked' }),
      () => api().delete(`/api/admin/daily-tasks/${id}`),
      () => api().get('/api/admin/daily-tasks/settings'),
      () => api().put('/api/admin/daily-tasks/settings').send({ dailyTaskCount: 5 })
    ];

    for (const request of requests) {
      expect((await request().set('Authorization', learnerAuth)).status).toBe(403);
      expect((await request()).status).toBe(401);
    }
    expect(await DailyTaskModel.countDocuments({ title: 'Khởi động' })).toBe(1);
    expect(await AppSettingModel.countDocuments()).toBe(0);
  });
});

describe('POST /api/admin/daily-tasks', () => {
  it('creates an active task with an empty description, without the fields it does not know', async () => {
    const auth = await signInAdmin();

    const response = await create(auth, { ...input, title: '  Khởi động  ', owner: '64b7f0a5c2a5f1a1a1a1a1a1', streak: 9 });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ title: 'Khởi động', description: '', type: 'sessions', target: 3, isActive: true });
    expect(response.body).not.toHaveProperty('owner');
    expect(response.body).not.toHaveProperty('streak');
    expect(response.body).not.toHaveProperty('__v');
    expect(await DailyTaskModel.countDocuments()).toBe(1);
  });

  it('takes a description, an inactive task and the largest target of each type', async () => {
    const auth = await signInAdmin();
    const largest = { sessions: 20, minigames: 10 };

    for (const [type, target] of Object.entries(largest)) {
      const response = await create(auth, { title: `Max ${type}`, type, target, description: ' Cố lên ', isActive: false });
      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({ type, target, description: 'Cố lên', isActive: false });
    }
  });

  it('refuses a target above the most of its type, naming the field', async () => {
    const auth = await signInAdmin();

    for (const [type, target] of [['sessions', 21], ['minigames', 11]] as const) {
      const response = await create(auth, { ...input, type, target });
      expect(response.status).toBe(400);
      expect(fieldsOf(response)).toEqual(['target']);
    }
    expect((await create(auth, { ...input, type: 'sessions', target: 21 })).body.errors[0].message).toBe('At most 20 for type sessions');
    expect((await create(auth, { ...input, type: 'minigames', target: 11 })).body.errors[0].message).toBe('At most 10 for type minigames');
    expect(await DailyTaskModel.countDocuments()).toBe(0);
  });

  it('refuses a missing or long title, a long description, an unknown type and a target that is not a whole number from 1', async () => {
    const auth = await signInAdmin();
    const bodies = [
      { ...input, title: '   ' },
      { type: 'sessions', target: 3 },
      { ...input, title: 'x'.repeat(121) },
      { ...input, description: 'x'.repeat(301) },
      { ...input, type: 'words' },
      { ...input, target: 0 },
      { ...input, target: 2.5 },
      { ...input, target: '3' },
      { title: 'No target', type: 'sessions' }
    ];

    for (const body of bodies) expect((await create(auth, body)).status).toBe(400);
    expect(await DailyTaskModel.countDocuments()).toBe(0);
  });
});

describe('GET /api/admin/daily-tasks', () => {
  const seed = async () => {
    const auth = await signInAdmin();
    await create(auth, { title: 'Gõ nhanh', type: 'sessions', target: 4 });
    await create(auth, { title: 'Chính xác', type: 'minigames', target: 5, description: 'Gõ cẩn thận từng chữ' });
    await create(auth, { title: 'Luyện đều', type: 'sessions', target: 10, isActive: false });
    return auth;
  };

  const titles = async (auth: string, query: string) => {
    const response = await api().get(`/api/admin/daily-tasks?${query}`).set('Authorization', auth);
    expect(response.status).toBe(200);
    return response.body.items.map((task: { title: string }) => task.title);
  };

  it('lists the newest first, with pagination', async () => {
    const auth = await seed();

    const response = await api().get('/api/admin/daily-tasks?limit=2').set('Authorization', auth);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ page: 1, limit: 2, total: 3, totalPages: 2 });
    expect(response.body.items.map((task: { title: string }) => task.title)).toEqual(['Luyện đều', 'Chính xác']);
  });

  it('searches title and description with accents optional, and filters by type and by active', async () => {
    const auth = await seed();

    expect(await titles(auth, `q=${encodeURIComponent('go nhanh')}`)).toEqual(['Gõ nhanh']);
    expect(await titles(auth, `q=${encodeURIComponent('can than')}`)).toEqual(['Chính xác']);
    expect(await titles(auth, 'q=.*')).toEqual([]);
    expect(await titles(auth, 'type=minigames')).toEqual(['Chính xác']);
    expect(await titles(auth, 'isActive=false')).toEqual(['Luyện đều']);
    expect(await titles(auth, 'isActive=true&sort=title')).toEqual(['Chính xác', 'Gõ nhanh']);
  });

  it('sorts titles in Vietnamese order: Đ right after D', async () => {
    const auth = await signInAdmin();
    for (const title of ['Vượt tốc', 'Đều đặn', 'Dẻo dai', 'Ánh sáng']) await create(auth, { ...input, title });

    expect(await titles(auth, 'sort=title')).toEqual(['Ánh sáng', 'Dẻo dai', 'Đều đặn', 'Vượt tốc']);
    expect(await titles(auth, 'sort=-title')).toEqual(['Vượt tốc', 'Đều đặn', 'Dẻo dai', 'Ánh sáng']);
  });

  it('refuses a sort or a filter it does not know', async () => {
    const auth = await signInAdmin();

    for (const query of ['sort=target', 'sort=__v', 'type=words', 'isActive=yes', 'limit=101']) {
      expect((await api().get(`/api/admin/daily-tasks?${query}`).set('Authorization', auth)).status).toBe(400);
    }
  });
});

describe('GET /api/admin/daily-tasks: the learners who completed each task in the last 24 hours', () => {
  // Now is 10 March 2026, 08:30 UTC: the hours run from 9 March 09:00 to 10 March 08:00 UTC, the current one.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-03-10T08:30:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** A counted session of `learner` completed at `time` (UTC), recorded on their daily tasks like `completeSession` does. */
  const typeAt = async (learner: { _id: unknown }, time: string, fields: Record<string, unknown> = {}) => {
    const completedAt = new Date(time);
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
    await recordDailyTaskProgress(learner._id, completedAt);
  };

  type Completions = { learners: number; hours: { hour: string; learners: number }[] };

  /** By title: the learners in all and the hours that had some, `{ [hour]: learners }`. */
  const completionsOf = async (auth: string) => {
    const response = await api().get('/api/admin/daily-tasks').set('Authorization', auth);
    expect(response.status).toBe(200);
    return Object.fromEntries(
      response.body.items.map(({ title, completions }: { title: string; completions: Completions }) => [
        title,
        {
          learners: completions.learners,
          hours: Object.fromEntries(completions.hours.filter((hour) => hour.learners > 0).map((hour) => [hour.hour, hour.learners]))
        }
      ])
    );
  };

  it('answers the last 24 whole hours, oldest first and the current one last, with nobody while nobody completed the task', async () => {
    const auth = await signInAdmin();
    await create(auth, { title: 'Hai phiên', type: 'sessions', target: 2 });

    const { body } = await api().get('/api/admin/daily-tasks').set('Authorization', auth);

    const { learners, hours } = body.items[0].completions as Completions;
    expect(learners).toBe(0);
    expect(hours).toHaveLength(24);
    expect(hours[0]).toEqual({ hour: '2026-03-09T09:00:00.000Z', learners: 0 });
    expect(hours[23]).toEqual({ hour: '2026-03-10T08:00:00.000Z', learners: 0 });
    expect(hours.every((hour) => hour.learners === 0)).toBe(true);
  });

  it('counts each learner in the hour of the session that completed the task, never in a later one', async () => {
    const auth = await signInAdmin();
    await create(auth, { title: 'Hai phiên', type: 'sessions', target: 2 });
    await create(auth, { title: 'Một phiên', type: 'sessions', target: 1 });
    await create(auth, { title: 'Chăm chỉ', type: 'sessions', target: 20 });
    await updateAppSettings({ dailyTaskCount: 3 });
    const an = await createUser({ email: 'an@example.com' });
    const binh = await createUser({ email: 'binh@example.com' });

    // Her first session completes one of her tasks, her second the other one; the third changes nothing.
    await typeAt(an, '2026-03-10T01:10:00.000Z');
    await typeAt(an, '2026-03-10T03:20:00.000Z');
    await typeAt(an, '2026-03-10T07:00:00.000Z');
    // In the current hour.
    await typeAt(binh, '2026-03-10T08:10:00.000Z');

    expect(await completionsOf(auth)).toEqual({
      'Hai phiên': { learners: 1, hours: { '2026-03-10T03:00:00.000Z': 1 } },
      'Một phiên': { learners: 2, hours: { '2026-03-10T01:00:00.000Z': 1, '2026-03-10T08:00:00.000Z': 1 } },
      'Chăm chỉ': { learners: 0, hours: {} }
    });
  });

  it('counts a minigames task in the hour of the finish of its last needed minigame or duel', async () => {
    const auth = await signInAdmin();
    await create(auth, { title: 'Hai trò', type: 'minigames', target: 2 });
    const an = await createUser({ email: 'an@example.com' });
    const binh = await createUser({ email: 'binh@example.com' });
    const finishPlay = async (learner: { _id: unknown }, time: string) => {
      const finishedAt = new Date(time);
      await MinigamePlayModel.create({ owner: learner._id, game: 'rain', startedAt: new Date(finishedAt.getTime() - 60_000), finished: true, finishedAt });
      await recordDailyTaskProgress(learner._id, finishedAt);
    };

    await finishPlay(an, '2026-03-10T01:10:00.000Z');
    // A won duel is her second minigame: that completes the task, at the end of the duel.
    const endedAt = new Date('2026-03-10T03:20:00.000Z');
    await MatchModel.create({
      code: 'DUELAN',
      kind: 'rain',
      status: 'finished',
      flagged: false,
      passageTitle: 'Rain',
      targetWords: ['a'],
      endedAt,
      players: [{ user: an._id, displayName: 'An', avatar: an.avatar, result: 'win' }]
    });
    await recordDailyTaskProgress(an._id, endedAt);
    // He played only one.
    await finishPlay(binh, '2026-03-10T05:00:00.000Z');

    expect(await completionsOf(auth)).toEqual({ 'Hai trò': { learners: 1, hours: { '2026-03-10T03:00:00.000Z': 1 } } });
  });

  it('leaves out a task completed before the 24 hours, and counts a learner once in all when two of their days completed it', async () => {
    const auth = await signInAdmin();
    await create(auth, { title: 'Một phiên', type: 'sessions', target: 1 });
    const chi = await createUser({ email: 'chi@example.com' });
    const dung = await createUser({ email: 'dung@example.com' });
    // New York is UTC-4 in March: his evening and the night after it are two of his days.
    await UserModel.updateOne({ _id: dung._id }, { 'settings.timezone': 'America/New_York' });

    // Chi's 9 March (in Vietnam) was completed at 06:00 UTC, before the 24 hours: her session at 12:00 changes nothing.
    await typeAt(chi, '2026-03-09T06:00:00.000Z');
    await typeAt(chi, '2026-03-09T12:00:00.000Z');
    // Her 10 March.
    await typeAt(chi, '2026-03-10T02:00:00.000Z');
    // 9 March at 19:30, then 10 March at 01:00 in New York.
    await typeAt(dung, '2026-03-09T23:30:00.000Z');
    await typeAt(dung, '2026-03-10T05:00:00.000Z');

    expect(await completionsOf(auth)).toEqual({
      'Một phiên': {
        learners: 2,
        hours: { '2026-03-09T23:00:00.000Z': 1, '2026-03-10T02:00:00.000Z': 1, '2026-03-10T05:00:00.000Z': 1 }
      }
    });
  });
});

describe('GET /api/admin/daily-tasks/:id', () => {
  it('answers one task, 404 for an unknown id and 400 for a malformed one', async () => {
    const auth = await signInAdmin();
    const task = (await create(auth)).body;

    const response = await api().get(`/api/admin/daily-tasks/${task._id}`).set('Authorization', auth);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ _id: task._id, title: 'Khởi động', type: 'sessions', target: 3 });
    expect((await api().get('/api/admin/daily-tasks/64b7f0a5c2a5f1a1a1a1a1a1').set('Authorization', auth)).status).toBe(404);
    expect((await api().get('/api/admin/daily-tasks/not-an-id').set('Authorization', auth)).status).toBe(400);
  });
});

describe('PATCH /api/admin/daily-tasks/:id', () => {
  it('changes the fields sent and keeps the others', async () => {
    const auth = await signInAdmin();
    const task = (await create(auth, { ...input, description: 'Ba phiên' })).body;

    const response = await update(auth, task._id, { title: 'Khởi động nhẹ', isActive: false });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ title: 'Khởi động nhẹ', isActive: false, description: 'Ba phiên', type: 'sessions', target: 3 });
  });

  it('checks the target against the type the task ends up with', async () => {
    const auth = await signInAdmin();
    const task = (await create(auth, { ...input, type: 'sessions', target: 15 })).body;

    // Only the type: 15 minigames cannot be played in a day.
    const typeOnly = await update(auth, task._id, { type: 'minigames' });
    expect(typeOnly.status).toBe(400);
    expect(fieldsOf(typeOnly)).toEqual(['target']);
    // Only the target, above the most of the type the task has.
    expect((await update(auth, task._id, { target: 21 })).status).toBe(400);
    expect(await DailyTaskModel.findById(task._id).lean()).toMatchObject({ type: 'sessions', target: 15 });

    const both = await update(auth, task._id, { type: 'minigames', target: 5 });
    expect(both.status).toBe(200);
    expect(both.body).toMatchObject({ type: 'minigames', target: 5 });
  });

  it('refuses an empty or bad body, and answers 404 for an unknown task', async () => {
    const auth = await signInAdmin();
    const task = (await create(auth)).body;

    expect((await update(auth, task._id, {})).status).toBe(400);
    expect((await update(auth, task._id, { title: '' })).status).toBe(400);
    expect((await update(auth, task._id, { target: -1 })).status).toBe(400);
    expect((await update(auth, task._id, { isActive: 'no' })).status).toBe(400);
    expect((await update(auth, '64b7f0a5c2a5f1a1a1a1a1a1', { title: 'Ghost' })).status).toBe(404);
    expect(await DailyTaskModel.findById(task._id).lean()).toMatchObject(input);
  });
});

describe('two saves of one task at the same time', () => {
  /**
   * Two PATCHes that both read the task before either saves: `first`, then `second` on a copy of the task read before
   * `first` was saved. Answers the task as stored afterwards.
   */
  const saveBoth = async (task: object, first: UpdateDailyTaskInput, second: UpdateDailyTaskInput) => {
    const { _id: id } = await DailyTaskModel.create(task);
    const copies = [await DailyTaskModel.findById(id), await DailyTaskModel.findById(id)];
    vi.spyOn(DailyTaskModel, 'findById').mockResolvedValueOnce(copies[0]).mockResolvedValueOnce(copies[1]);
    await updateDailyTask(String(id), first);
    await updateDailyTask(String(id), second);
    return DailyTaskModel.findById(id).lean();
  };

  const sessionsTask = { title: 'Luyện gõ', type: 'sessions', target: 15 };
  const toMinigames: UpdateDailyTaskInput = { type: 'minigames', target: 5 };
  const more: UpdateDailyTaskInput = { target: 18 };

  it('keeps the type and target of one of them, never the type of one with the target of the other', async () => {
    // Each save is valid on the task it read, but 18 minigames is not: the task keeps the whole set of the last save.
    const minigamesFirst = await saveBoth(sessionsTask, toMinigames, more);
    expect(minigamesFirst).toMatchObject({ type: 'sessions', target: 18 });

    expect(await saveBoth(sessionsTask, more, toMinigames)).toMatchObject({ type: 'minigames', target: 5 });
  });

  it('leaves the type and target to the other save when a save changes none of them', async () => {
    const stored = await saveBoth(sessionsTask, toMinigames, { isActive: false, title: 'Chơi game' });

    expect(stored).toMatchObject({ title: 'Chơi game', type: 'minigames', target: 5, isActive: false });
  });
});

describe('DELETE /api/admin/daily-tasks/:id', () => {
  it('deletes the task for good and leaves the others, then answers 404', async () => {
    const auth = await signInAdmin();
    const task = (await create(auth)).body;
    const other = (await create(auth, { ...input, title: 'Giữ lại' })).body;
    const remove = () => api().delete(`/api/admin/daily-tasks/${task._id}`).set('Authorization', auth);

    expect((await remove()).status).toBe(204);
    expect(await DailyTaskModel.exists({ _id: task._id })).toBeNull();
    expect(await DailyTaskModel.exists({ _id: other._id })).not.toBeNull();
    expect((await remove()).status).toBe(404);
  });
});

describe('daily task settings', () => {
  it('answers the default count while nothing is saved, without saving it', async () => {
    const auth = await signInAdmin();

    const response = await readSettings(auth);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ dailyTaskCount: 3 });
    expect(await AppSettingModel.countDocuments()).toBe(0);
  });

  it('saves the count in the one settings document and reads it back', async () => {
    const auth = await signInAdmin();

    const first = await saveSettings(auth, { dailyTaskCount: 5, key: 'other' });
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ dailyTaskCount: 5 });
    expect((await saveSettings(auth, { dailyTaskCount: 10 })).body).toEqual({ dailyTaskCount: 10 });

    expect((await readSettings(auth)).body).toEqual({ dailyTaskCount: 10 });
    expect(await AppSettingModel.countDocuments()).toBe(1);
    expect(await AppSettingModel.findOne().lean()).toMatchObject({ key: 'global', dailyTaskCount: 10 });
  });

  it('keeps one document when two admins save at the same time', async () => {
    const auth = await signInAdmin();

    const responses = await Promise.all([saveSettings(auth, { dailyTaskCount: 4 }), saveSettings(auth, { dailyTaskCount: 6 })]);

    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(await AppSettingModel.countDocuments()).toBe(1);
  });

  it('refuses a count that is not a whole number from 1 to 10, and keeps the saved one', async () => {
    const auth = await signInAdmin();
    await saveSettings(auth, { dailyTaskCount: 4 });
    const bodies = [{ dailyTaskCount: 0 }, { dailyTaskCount: 11 }, { dailyTaskCount: 2.5 }, { dailyTaskCount: '5' }, { dailyTaskCount: null }, {}];

    for (const body of bodies) expect((await saveSettings(auth, body)).status).toBe(400);
    expect((await readSettings(auth)).body).toEqual({ dailyTaskCount: 4 });
  });
});

describe('the coins of a task (SCRUM-301)', () => {
  it('are 0 on a new task, and can be set on create and update, from 0 to 100', async () => {
    const auth = await signInAdmin();

    const made = await create(auth);
    expect(made.status).toBe(201);
    expect(made.body.coins).toBe(0);

    expect((await create(auth, { ...input, coins: 100 })).body.coins).toBe(100);
    const changed = await update(auth, made.body._id, { coins: 25 });
    expect(changed.status).toBe(200);
    expect(changed.body.coins).toBe(25);
    expect((await update(auth, made.body._id, { coins: 0 })).body.coins).toBe(0);
  });

  it('refuse a negative number, one above 100 and a number that is not whole, naming the field', async () => {
    const auth = await signInAdmin();
    const made = await create(auth);

    for (const coins of [-1, 101, 2.5, '10', null]) {
      const created = await create(auth, { ...input, coins });
      expect(created.status).toBe(400);
      expect(fieldsOf(created)).toEqual(['coins']);
      const updated = await update(auth, made.body._id, { coins });
      expect(updated.status).toBe(400);
      expect(fieldsOf(updated)).toEqual(['coins']);
    }
    expect((await DailyTaskModel.findById(made.body._id))!.coins).toBe(0);
  });

  it('are listed with each task', async () => {
    const auth = await signInAdmin();
    await create(auth, { ...input, coins: 30 });

    const list = await api().get('/api/admin/daily-tasks').set('Authorization', auth);

    expect(list.body.items[0].coins).toBe(30);
  });
});

describe('GET /api/admin/daily-tasks/completions-over-time: the learners who completed tasks, by period', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-03-10T08:30:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const typeAt = async (learner: { _id: unknown }, time: string) => {
    const completedAt = new Date(time);
    await TypingSessionModel.create({
      owner: learner._id,
      passageId: 'p1',
      targetWords: ['a'],
      status: 'completed',
      isCounted: true,
      completedAt,
      durationMs: 60_000,
      wpm: 30,
      accuracy: 95
    });
    await recordDailyTaskProgress(learner._id, completedAt);
  };

  const read = (auth: string, query = '') => api().get(`/api/admin/daily-tasks/completions-over-time${query}`).set('Authorization', auth);

  it('counts the learners (once each) and the tasks completed on each day, up to today', async () => {
    const auth = await signInAdmin();
    await create(auth, { title: 'Một phiên', type: 'sessions', target: 1 });
    await create(auth, { title: 'Hai phiên', type: 'sessions', target: 2 });
    await updateAppSettings({ dailyTaskCount: 2 });
    const an = await createUser({ email: 'an@example.com' });
    const binh = await createUser({ email: 'binh@example.com' });

    // An completes both tasks on the 9th and the first one on the 10th; Bình completes one task on the 10th.
    await typeAt(an, '2026-03-09T03:00:00.000Z');
    await typeAt(an, '2026-03-09T04:00:00.000Z');
    await typeAt(an, '2026-03-10T03:00:00.000Z');
    await typeAt(binh, '2026-03-10T04:00:00.000Z');

    const response = await read(auth, '?range=week&date=2026-03-10');
    expect(response.status).toBe(200);
    expect(response.body.range).toBe('week');
    // The 8th to the 10th: the days after today are left out.
    const taskId = (title: string) => response.body.tasks.find((task: { title: string }) => task.title === title).taskId;
    // The one with the most learners first.
    expect(response.body.tasks.map((task: { title: string }) => task.title)).toEqual(['Một phiên', 'Hai phiên']);
    expect(response.body.points).toEqual([
      { key: '2026-03-08', learners: 0, tasks: 0, byTask: [] },
      {
        key: '2026-03-09',
        learners: 1,
        tasks: 2,
        byTask: expect.arrayContaining([
          { taskId: taskId('Một phiên'), learners: 1 },
          { taskId: taskId('Hai phiên'), learners: 1 }
        ])
      },
      { key: '2026-03-10', learners: 2, tasks: 2, byTask: [{ taskId: taskId('Một phiên'), learners: 2 }] }
    ]);

    // A month is one point for a block of 7 days: each learner once in it.
    const month = await read(auth, '?range=month&date=2026-03-10');
    expect(month.body.points.find((point: { key: string }) => point.key === '2026-03-08')).toMatchObject({ key: '2026-03-08', learners: 2, tasks: 4 });
  });

  it('is open to admins only', async () => {
    const learnerAuth = bearerFor(await createUser({ email: 'learner@example.com' }));
    expect((await read(learnerAuth)).status).toBe(403);
    expect((await api().get('/api/admin/daily-tasks/completions-over-time')).status).toBe(401);
  });

  it('refuses an unknown range', async () => {
    const auth = await signInAdmin();
    expect((await read(auth, '?range=decade')).status).toBe(400);
  });
});
