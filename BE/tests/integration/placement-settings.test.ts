import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppSettingModel } from '../../src/models/app-setting.model';
import { PassageModel } from '../../src/models/passage.model';
import { api } from '../helpers/api';
import { bearerFor, createUser } from '../helpers/user-factory';

beforeAll(() => AppSettingModel.init());

const START = new Date('2026-03-10T08:00:00.000Z');
const WORDS = Array.from({ length: 30 }, (_, index) => `chữ${index + 1}`);

let passageId: string;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(START);
  passageId = String((await PassageModel.create({ title: 'Bài xếp hạng', content: WORDS.join(' '), source: 'Tự viết', status: 'published', visibility: 'public', isPlacement: true }))._id);
});

afterEach(() => {
  vi.useRealTimers();
});

const signInAdmin = async () => bearerFor(await createUser({ email: 'admin@example.com', role: 'admin', displayName: 'Admin' }));
const readSetting = (auth: string) => api().get('/api/admin/placement/settings').set('Authorization', auth);
const saveSetting = (auth: string, body: object) => api().put('/api/admin/placement/settings').set('Authorization', auth).send(body);

/** A 3-minute placement session with `wrong` words typed wrong out of 30, completed after the 3 minutes. */
const playWithWrong = async (auth: string, wrong: number) => {
  const session = (await api().post('/api/sessions').set('Authorization', auth).send({ mode: 'placement', passageId, timeLimitSeconds: 180 })).body;
  await api().patch(`/api/sessions/${session._id}/begin`).set('Authorization', auth);
  vi.setSystemTime(new Date(START.getTime() + 180_000));
  const typedWords = WORDS.map((word, index) => (index < wrong ? `${word}x` : word));
  return api().patch(`/api/sessions/${session._id}/complete`).set('Authorization', auth).send({ typedWords });
};

describe('the placement settings of the admin', () => {
  it('is open to admins only: learners get 403 and anonymous visitors 401', async () => {
    const learner = bearerFor(await createUser({ email: 'learner@example.com' }));
    const requests = [() => api().get('/api/admin/placement/settings'), () => api().put('/api/admin/placement/settings').send({ minAccuracy: 80 })];

    for (const request of requests) {
      expect((await request().set('Authorization', learner)).status).toBe(403);
      expect((await request()).status).toBe(401);
    }
    expect(await AppSettingModel.countDocuments()).toBe(0);
  });

  it('answers 90 while no admin has saved anything, without writing', async () => {
    const response = await readSetting(await signInAdmin());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ minAccuracy: 90 });
    expect(await AppSettingModel.countDocuments()).toBe(0);
  });

  it('saves the minimum accuracy and answers it again', async () => {
    const auth = await signInAdmin();

    const saved = await saveSetting(auth, { minAccuracy: 80 });

    expect(saved.status).toBe(200);
    expect(saved.body).toEqual({ minAccuracy: 80 });
    expect((await readSetting(auth)).body).toEqual({ minAccuracy: 80 });
  });

  it('keeps the daily task setting when it saves this one', async () => {
    const auth = await signInAdmin();
    await api().put('/api/admin/daily-tasks/settings').set('Authorization', auth).send({ dailyTaskCount: 5 });

    await saveSetting(auth, { minAccuracy: 80 });

    expect((await api().get('/api/admin/daily-tasks/settings').set('Authorization', auth)).body).toEqual({ dailyTaskCount: 5 });
  });

  it.each([[49], [101], [90.5], ['90'], [null]])('rejects %j: a whole number from 50 to 100 only', async (value) => {
    const auth = await signInAdmin();

    expect((await saveSetting(auth, { minAccuracy: value })).status).toBe(400);
    expect((await saveSetting(auth, {})).status).toBe(400);
    expect(await AppSettingModel.countDocuments()).toBe(0);
  });

  it('accepts the two ends, 50 and 100', async () => {
    const auth = await signInAdmin();

    expect((await saveSetting(auth, { minAccuracy: 50 })).status).toBe(200);
    expect((await saveSetting(auth, { minAccuracy: 100 })).status).toBe(200);
  });
});

describe('GET /api/placement/settings', () => {
  it('tells any signed-in learner the minimum accuracy in use, and needs a sign-in', async () => {
    const admin = await signInAdmin();
    const learner = bearerFor(await createUser({ email: 'learner@example.com' }));

    expect((await api().get('/api/placement/settings')).status).toBe(401);
    expect((await api().get('/api/placement/settings').set('Authorization', learner)).body).toEqual({ minAccuracy: 90 });
    await saveSetting(admin, { minAccuracy: 75 });
    expect((await api().get('/api/placement/settings').set('Authorization', learner)).body).toEqual({ minAccuracy: 75 });
  });
});

describe('the minimum accuracy decides who is on the leaderboard', () => {
  const boardNames = async (viewer: string) =>
    ((await api().get(`/api/placement/leaderboard?passageId=${passageId}`).set('Authorization', viewer)).body.items as { displayName: string }[]).map((item) => item.displayName);

  it('shows a session of 86.7% accuracy once the admin has lowered the minimum to 80', async () => {
    const admin = await signInAdmin();
    const learner = bearerFor(await createUser({ email: 'learner@example.com', displayName: 'Lan' }));
    await saveSetting(admin, { minAccuracy: 80 });

    const response = await playWithWrong(learner, 4); // 26 of 30 right

    expect(response.body.accuracy).toBeLessThan(90);
    expect(await boardNames(learner)).toEqual(['Lan']);
  });

  it('leaves out a session of 93.3% accuracy once the admin has raised the minimum to 95', async () => {
    const admin = await signInAdmin();
    const learner = bearerFor(await createUser({ email: 'learner@example.com', displayName: 'Lan' }));
    await saveSetting(admin, { minAccuracy: 95 });

    const response = await playWithWrong(learner, 2); // 28 of 30 right

    expect(response.body.accuracy).toBeGreaterThan(90);
    expect(await boardNames(learner)).toEqual([]);
  });

  it('keeps the old 90% before an admin saves anything, and shows exactly the minimum', async () => {
    const learner = bearerFor(await createUser({ email: 'learner@example.com', displayName: 'Lan' }));

    const response = await playWithWrong(learner, 3); // 27 of 30 right: exactly 90%

    expect(response.body.accuracy).toBe(90);
    expect(await boardNames(learner)).toEqual(['Lan']);
  });
});
