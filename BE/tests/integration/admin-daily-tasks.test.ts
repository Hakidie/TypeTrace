import { beforeAll, describe, expect, it } from 'vitest';
import { AppSettingModel } from '../../src/models/app-setting.model';
import { DailyTaskModel } from '../../src/models/daily-task.model';
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
    const largest = { sessions: 20, minutes: 120, wpm: 200, accuracy: 100 };

    for (const [type, target] of Object.entries(largest)) {
      const response = await create(auth, { title: `Max ${type}`, type, target, description: ' Cố lên ', isActive: false });
      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({ type, target, description: 'Cố lên', isActive: false });
    }
  });

  it('refuses a target above the most of its type, naming the field', async () => {
    const auth = await signInAdmin();

    for (const [type, target] of [['sessions', 21], ['minutes', 121], ['wpm', 201], ['accuracy', 101]] as const) {
      const response = await create(auth, { ...input, type, target });
      expect(response.status).toBe(400);
      expect(fieldsOf(response)).toEqual(['target']);
    }
    expect((await create(auth, { ...input, type: 'accuracy', target: 101 })).body.errors[0].message).toBe('At most 100 for type accuracy');
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
    await create(auth, { title: 'Gõ nhanh', type: 'wpm', target: 40 });
    await create(auth, { title: 'Chính xác', type: 'accuracy', target: 95, description: 'Gõ cẩn thận từng chữ' });
    await create(auth, { title: 'Luyện đều', type: 'minutes', target: 10, isActive: false });
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
    expect(await titles(auth, 'type=accuracy')).toEqual(['Chính xác']);
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
    const task = (await create(auth, { ...input, type: 'wpm', target: 150 })).body;

    // Only the type: 150 % accuracy cannot be reached.
    const typeOnly = await update(auth, task._id, { type: 'accuracy' });
    expect(typeOnly.status).toBe(400);
    expect(fieldsOf(typeOnly)).toEqual(['target']);
    // Only the target, above the most of the type the task has.
    expect((await update(auth, task._id, { target: 201 })).status).toBe(400);
    expect(await DailyTaskModel.findById(task._id).lean()).toMatchObject({ type: 'wpm', target: 150 });

    const both = await update(auth, task._id, { type: 'accuracy', target: 95 });
    expect(both.status).toBe(200);
    expect(both.body).toMatchObject({ type: 'accuracy', target: 95 });
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
