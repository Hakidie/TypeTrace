import { beforeEach, describe, expect, it } from 'vitest';
import { PASSAGE_LIST } from '../../src/data/passages';
import { DailyChallengeModel, DailyEntryModel } from '../../src/models/daily.model';
import { PassageModel } from '../../src/models/passage.model';
import { TypingSessionModel } from '../../src/models/typing-session.model';
import { UserModel } from '../../src/models/user.model';
import { coinsFor, dayBefore, dayKey, scoreOf } from '../../src/services/daily.service';
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

/** Opens a try, makes it 30 seconds old and sends `typed` (the first 20 words of the passage by default). */
const playTry = async (authorization: string, change: (words: string[]) => string[] = (words) => words.slice(0, 20)) => {
  const session = (await startTry(authorization)).body;
  await TypingSessionModel.updateOne({ _id: session._id }, { beganAt: new Date(Date.now() - 30_000) });
  return completeTry(authorization, session._id, change(session.targetWords));
};
const completeTry = (authorization: string, id: string, typedWords: string[]) =>
  api().patch(`/api/sessions/${id}/complete`).set('Authorization', authorization).send({ typedWords });
const coinsOf = async (id: unknown) => (await UserModel.findById(id))!.coins;
/** 20 words with the first `wrong` of them mistyped. */
const withMistakes = (wrong: number) => (words: string[]) => words.slice(0, 20).map((word, index) => (index < wrong ? `${word}x` : word));

describe('daily challenge scoring', () => {
  it('scores a counted try', async () => {
    const auth = bearerFor(await createUser());

    const done = (await playTry(auth)).body;

    const { body } = await today(auth);
    expect(body.best.score).toBe(scoreOf(done.wpm, done.accuracy));
    expect(body.lastTry).toMatchObject({ counted: true, newBest: true, score: body.best.score });
    expect(body.rank).toBe(1);
    expect(body.streak).toBe(1);
  });

  it('keeps the best of three tries', async () => {
    const auth = bearerFor(await createUser());
    await playTry(auth);
    const first = (await today(auth)).body.best.score;

    await playTry(auth, withMistakes(5));

    const { body } = await today(auth);
    expect(body.best.score).toBe(first);
    expect(body.lastTry.newBest).toBe(false);
    expect(body.lastTry.score).toBeLessThan(first);
  });

  it('gives coins once a day, on the first counted try', async () => {
    const user = await createUser();
    const auth = bearerFor(user);

    await playTry(auth);
    expect(await coinsOf(user._id)).toBe(20);
    expect((await today(auth)).body.lastTry.coins).toBe(20);

    await playTry(auth);
    expect(await coinsOf(user._id)).toBe(20);
    expect((await today(auth)).body.lastTry.coins).toBe(0);
  });

  it('grows the streak on consecutive days and resets it after a gap', async () => {
    const user = await createUser();
    await DailyEntryModel.create({ user: user._id, date: dayBefore(dayKey()), counted: true, streak: 5, bestScore: 40, bestAt: new Date() });
    const other = await createUser({ email: 'gap@example.com' });
    await DailyEntryModel.create({ user: other._id, date: dayBefore(dayBefore(dayKey())), counted: true, streak: 5, bestScore: 40, bestAt: new Date() });

    await playTry(bearerFor(user));
    await playTry(bearerFor(other));

    expect((await today(bearerFor(user))).body.streak).toBe(6);
    expect(await coinsOf(user._id)).toBe(45);
    expect((await today(bearerFor(other))).body.streak).toBe(1);
  });

  it('caps the coins at 50', async () => {
    const user = await createUser();
    await DailyEntryModel.create({ user: user._id, date: dayBefore(dayKey()), counted: true, streak: 8, bestScore: 40, bestAt: new Date() });

    await playTry(bearerFor(user));

    expect(coinsFor(9)).toBe(50);
    expect(await coinsOf(user._id)).toBe(50);
  });

  it('does not score an uncounted try', async () => {
    const user = await createUser();
    const auth = bearerFor(user);

    await playTry(auth, (words) => words.slice(0, 3));

    const { body } = await today(auth);
    expect(body).toMatchObject({ best: null, rank: null, triesLeft: 2, streak: 0 });
    expect(body.lastTry.counted).toBe(false);
    expect(await coinsOf(user._id)).toBe(0);
  });

  it('counts a try for the day it started', async () => {
    const auth = bearerFor(await createUser());
    const session = (await startTry(auth)).body;
    // Started yesterday just before midnight, sent today.
    await TypingSessionModel.updateOne({ _id: session._id }, { dailyDate: dayBefore(dayKey()), beganAt: new Date(Date.now() - 30_000) });
    await DailyEntryModel.updateOne({ date: dayKey() }, { date: dayBefore(dayKey()) });

    await completeTry(auth, session._id, session.targetWords.slice(0, 20));

    const entry = await DailyEntryModel.findOne({ date: dayBefore(dayKey()) });
    expect(entry?.counted).toBe(true);
    expect((await today(auth)).body.best).toBeNull();
  });

  it('gives the coins once when two tries complete together', async () => {
    const user = await createUser();
    const auth = bearerFor(user);
    const first = (await startTry(auth)).body;
    // A second try still open at the same time (as from two tabs).
    const second = await TypingSessionModel.create({ ...first, _id: undefined, status: 'in_progress' });
    await TypingSessionModel.updateMany({ owner: user._id }, { status: 'in_progress', beganAt: new Date(Date.now() - 30_000) });

    await Promise.all([completeTry(auth, first._id, first.targetWords.slice(0, 20)), completeTry(auth, String(second._id), first.targetWords.slice(0, 20))]);

    expect(await coinsOf(user._id)).toBe(20);
  });
});

const board = (authorization: string, day?: string) =>
  api().get('/api/daily/leaderboard').query(day ? { day } : {}).set('Authorization', authorization);

describe('daily leaderboard', () => {
  it("ranks today's players without their email", async () => {
    const lan = await createUser({ email: 'lan@example.com', displayName: 'Lan' });
    const minh = await createUser({ email: 'minh@example.com', displayName: 'Minh' });
    const an = await createUser({ email: 'an@example.com' });
    await playTry(bearerFor(lan), withMistakes(4));
    await playTry(bearerFor(minh));
    await playTry(bearerFor(an), withMistakes(4));

    const { body } = await board(bearerFor(lan));

    expect(body.items.map((item: { displayName: string }) => item.displayName)).toEqual(['Minh', 'Lan', 'Anonymous player']);
    expect(body.items.map((item: { rank: number }) => item.rank)).toEqual([1, 2, 3]);
    expect(JSON.stringify(body)).not.toContain('@example.com');
    expect(body.items[1].isMe).toBe(true);
    expect(body.me).toEqual({ rank: 2, score: body.items[1].score });
    expect(body.players).toBe(3);
  });

  it("shows yesterday's board and winner", async () => {
    const user = await createUser({ displayName: 'Tuấn' });
    await DailyEntryModel.create({ user: user._id, date: dayBefore(dayKey()), counted: true, streak: 1, bestScore: 79, bestAt: new Date() });

    expect((await board(bearerFor(user), 'yesterday')).body.items[0]).toMatchObject({ displayName: 'Tuấn', score: 79 });
    expect((await today(bearerFor(user))).body.yesterdayWinner).toMatchObject({ displayName: 'Tuấn', score: 79 });
  });

  it('answers an empty board', async () => {
    const { body } = await board(bearerFor(await createUser()));

    expect(body).toMatchObject({ items: [], me: null, players: 0 });
  });

  it('refuses an unknown day', async () => {
    expect((await board(bearerFor(await createUser()), 'tomorrow')).status).toBe(400);
  });
});

const history = (authorization: string) => api().get('/api/daily/history').set('Authorization', authorization);

describe('daily history', () => {
  it('answers 401 without a token', async () => {
    expect((await api().get('/api/daily/history')).status).toBe(401);
  });

  it('lists the last 14 days, oldest first, with the best counted try of each', async () => {
    const user = await createUser();
    const yesterday = dayBefore(dayKey());
    await DailyEntryModel.create({ user: user._id, date: yesterday, counted: true, streak: 1, bestScore: 40, bestWpm: 42, bestAccuracy: 95.2, bestAt: new Date() });
    await playTry(bearerFor(user));

    const { body } = await history(bearerFor(user));

    expect(body.days).toHaveLength(14);
    expect(body.days[13].date).toBe(dayKey());
    expect(body.days[12]).toEqual({ date: yesterday, score: 40, wpm: 42, accuracy: 95.2 });
    expect(body.days[13].wpm).toBeGreaterThan(0);
  });

  it('leaves the days without a counted try empty', async () => {
    const user = await createUser();
    await DailyEntryModel.create({ user: user._id, date: dayBefore(dayKey()), tries: 1, counted: false });

    const { body } = await history(bearerFor(user));

    expect(body.days[12]).toEqual({ date: dayBefore(dayKey()), score: null, wpm: null, accuracy: null });
    expect(body.days.every((entry: { wpm: number | null }) => entry.wpm === null)).toBe(true);
  });

  it("never shows another player's days", async () => {
    const other = await createUser({ email: 'other@example.com' });
    await DailyEntryModel.create({ user: other._id, date: dayKey(), counted: true, streak: 1, bestScore: 70, bestWpm: 72, bestAccuracy: 97, bestAt: new Date() });

    const { body } = await history(bearerFor(await createUser()));

    expect(body.days[13].wpm).toBeNull();
  });
});
