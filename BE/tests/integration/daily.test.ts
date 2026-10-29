import { beforeEach, describe, expect, it } from 'vitest';
import { PASSAGE_LIST } from '../../src/data/passages';
import { DailyChallengeModel } from '../../src/models/daily.model';
import { PassageModel } from '../../src/models/passage.model';
import { dayKey } from '../../src/services/daily.service';
import { seedPassages } from '../../src/services/passage-seed.service';
import { api } from '../helpers/api';
import { bearerFor, createUser } from '../helpers/user-factory';

const today = (authorization: string) => api().get('/api/daily').set('Authorization', authorization);
const startTry = (authorization: string) => api().post('/api/daily/sessions').set('Authorization', authorization);

beforeEach(async () => {
  await seedPassages(PASSAGE_LIST);
});

describe('daily challenge', () => {
  it('answers 401 without a token', async () => {
    expect((await api().get('/api/daily')).status).toBe(401);
    expect((await api().post('/api/daily/sessions')).status).toBe(401);
  });

  it('shows a fresh day with full tries and no best', async () => {
    const response = await today(bearerFor(await createUser()));

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ date: dayKey(), triesLeft: 3, best: null, rank: null, streak: 0, yesterdayWinner: null, lastTry: null });
    expect(response.body.preview.split(' ').length).toBeLessThanOrEqual(12);
  });

  it('picks one passage for the day, the same for everyone', async () => {
    const first = await today(bearerFor(await createUser()));
    const second = await today(bearerFor(await createUser({ email: 'other@example.com' })));

    expect(second.body.passageTitle).toBe(first.body.passageTitle);
    expect(await DailyChallengeModel.countDocuments()).toBe(1);
  });

  it("keeps the day's passage when the passage bank changes", async () => {
    const auth = bearerFor(await createUser());
    const before = (await today(auth)).body.passageTitle;
    // The day's passage leaves the pool: a new pick would have to be another one.
    await PassageModel.updateOne({ title: before }, { status: 'archived' });

    expect((await today(auth)).body.passageTitle).toBe(before);
  });

  it('answers 404 when there is no public practice passage', async () => {
    await PassageModel.updateMany({ isPlacement: false }, { status: 'archived' });

    const response = await today(bearerFor(await createUser()));

    expect(response.status).toBe(404);
  });

  it("starts a try on today's passage", async () => {
    const auth = bearerFor(await createUser());

    const response = await startTry(auth);

    expect(response.status).toBe(201);
    const challenge = (await DailyChallengeModel.findOne({ date: dayKey() }))!;
    expect(response.body).toMatchObject({ mode: 'daily', dailyDate: dayKey(), targetWords: challenge.words, status: 'in_progress' });
    expect((await today(auth)).body.triesLeft).toBe(2);
  });

  it('refuses a fourth try', async () => {
    const auth = bearerFor(await createUser());
    for (let i = 0; i < 3; i += 1) expect((await startTry(auth)).status).toBe(201);

    const response = await startTry(auth);

    expect(response.status).toBe(409);
    expect((await today(auth)).body.triesLeft).toBe(0);
  });

  it('does not let the sessions route start a daily session', async () => {
    const response = await api().post('/api/sessions').set('Authorization', bearerFor(await createUser())).send({ mode: 'daily' });

    expect(response.status).toBe(400);
  });
});
