import { beforeAll, describe, expect, it } from 'vitest';
import {
  AppSettingModel,
  DEFAULT_AI_LESSONS_PER_DAY,
  DEFAULT_AI_LESSONS_PER_MINUTE,
  MAX_AI_LESSONS_PER_DAY,
  MAX_AI_LESSONS_PER_MINUTE
} from '../../src/models/app-setting.model';
import { api } from '../helpers/api';
import { bearerFor, createUser } from '../helpers/user-factory';

beforeAll(() => AppSettingModel.init());

const signInAdmin = async () => bearerFor(await createUser({ email: 'admin@example.com', role: 'admin', displayName: 'Admin' }));
const readSetting = (auth: string) => api().get('/api/admin/ai/settings').set('Authorization', auth);
const saveSetting = (auth: string, body: object) => api().put('/api/admin/ai/settings').set('Authorization', auth).send(body);

describe('the AI settings of the admin (SCRUM-153)', () => {
  it('is open to admins only: learners get 403 and anonymous visitors 401', async () => {
    const learner = bearerFor(await createUser({ email: 'learner@example.com' }));
    const requests = [() => api().get('/api/admin/ai/settings'), () => api().put('/api/admin/ai/settings').send({ lessonsPerDay: 5, lessonsPerMinute: 3 })];

    for (const request of requests) {
      expect((await request().set('Authorization', learner)).status).toBe(403);
      expect((await request()).status).toBe(401);
    }
    expect(await AppSettingModel.countDocuments()).toBe(0);
  });

  it('answers the default while no admin has saved anything, without writing', async () => {
    const response = await readSetting(await signInAdmin());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ lessonsPerDay: DEFAULT_AI_LESSONS_PER_DAY, lessonsPerMinute: DEFAULT_AI_LESSONS_PER_MINUTE });
    expect(await AppSettingModel.countDocuments()).toBe(0);
  });

  it('saves the limit, and reads it back', async () => {
    const admin = await signInAdmin();

    const saved = await saveSetting(admin, { lessonsPerDay: 5, lessonsPerMinute: 3 });

    expect(saved.status).toBe(200);
    expect(saved.body).toEqual({ lessonsPerDay: 5, lessonsPerMinute: 3 });
    expect((await readSetting(admin)).body).toEqual({ lessonsPerDay: 5, lessonsPerMinute: 3 });
  });

  it('accepts 0, which turns the AI off', async () => {
    expect((await saveSetting(await signInAdmin(), { lessonsPerDay: 0, lessonsPerMinute: 1 })).body).toEqual({ lessonsPerDay: 0, lessonsPerMinute: 1 });
  });

  it.each([[-1], [1.5], [MAX_AI_LESSONS_PER_DAY + 1], ['5'], [null]])('refuses a daily limit of %j and saves nothing', async (value) => {
    const response = await saveSetting(await signInAdmin(), { lessonsPerDay: value, lessonsPerMinute: 5 });

    expect(response.status).toBe(400);
    expect(await AppSettingModel.countDocuments()).toBe(0);
  });

  it.each([[0], [1.5], [MAX_AI_LESSONS_PER_MINUTE + 1], ['5'], [null]])('refuses a per-minute limit of %j and saves nothing', async (value) => {
    const response = await saveSetting(await signInAdmin(), { lessonsPerDay: 5, lessonsPerMinute: value });

    expect(response.status).toBe(400);
    expect(await AppSettingModel.countDocuments()).toBe(0);
  });

  it('keeps the other settings when it saves', async () => {
    const admin = await signInAdmin();
    await api().put('/api/admin/daily-tasks/settings').set('Authorization', admin).send({ dailyTaskCount: 5 });

    await saveSetting(admin, { lessonsPerDay: 7, lessonsPerMinute: 4 });

    expect((await api().get('/api/admin/daily-tasks/settings').set('Authorization', admin)).body).toEqual({ dailyTaskCount: 5 });
  });
});
