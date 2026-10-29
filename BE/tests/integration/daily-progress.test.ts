import { Types } from 'mongoose';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PASSAGE_LIST } from '../../src/data/passages';
import { DailyProgressModel } from '../../src/models/daily-progress.model';
import { PassageModel } from '../../src/models/passage.model';
import { TypingSessionModel } from '../../src/models/typing-session.model';
import { DEFAULT_TIMEZONE, UserModel } from '../../src/models/user.model';
import {
  DAILY_MISSION_SESSIONS,
  rebuildDailyProgress,
  recordCountedSession
} from '../../src/services/daily-progress.service';
import { seedPassages } from '../../src/services/passage-seed.service';
import { api } from '../helpers/api';
import { bearerFor, createUser } from '../helpers/user-factory';

// Rows written at the same time rely on the unique { owner, date } index: wait until it is built.
beforeAll(() => DailyProgressModel.init());

const setZone = (owner: unknown, timezone: string) =>
  UserModel.updateOne({ _id: owner }, { $set: { 'settings.timezone': timezone } });

/** The days of one learner, oldest first, without the timestamps. */
const daysOf = async (owner: unknown) =>
  (await DailyProgressModel.find({ owner }).sort({ date: 1 }).lean()).map(({ date, sessions, missionCompletedAt }) => ({
    date,
    sessions,
    ...(missionCompletedAt && { missionCompletedAt })
  }));

/** `count` instants one hour apart on 10 March 2026, from 09:00 in Vietnam. */
const hoursOf10March = (count: number) => Array.from({ length: count }, (_, index) => new Date(Date.UTC(2026, 2, 10, 2 + index)));

describe('DailyProgress model', () => {
  it('keeps one row per learner and day (unique { owner, date })', async () => {
    const owner = new Types.ObjectId();
    await DailyProgressModel.create({ owner, date: '2026-03-10', sessions: 1 });

    await expect(DailyProgressModel.create({ owner, date: '2026-03-10', sessions: 1 })).rejects.toThrow(/duplicate key/);
    // Another day of the same learner, and the same day of another learner, are rows of their own.
    await DailyProgressModel.create([
      { owner, date: '2026-03-11', sessions: 1 },
      { owner: new Types.ObjectId(), date: '2026-03-10', sessions: 1 }
    ]);
    expect(await DailyProgressModel.countDocuments()).toBe(3);
  });
});

describe('recordCountedSession (SCRUM-31)', () => {
  it("creates the learner's day, adds to it, and sets missionCompletedAt once the mission is done", async () => {
    const user = await createUser({});
    const times = hoursOf10March(DAILY_MISSION_SESSIONS + 1);

    for (const [index, time] of times.entries()) {
      await recordCountedSession(String(user._id), time);

      const reached = index + 1 >= DAILY_MISSION_SESSIONS;
      expect(await daysOf(user._id)).toEqual([
        {
          date: '2026-03-10',
          sessions: index + 1,
          // Set by the session that reached the goal, and never moved by a later one.
          ...(reached && { missionCompletedAt: times[DAILY_MISSION_SESSIONS - 1] })
        }
      ]);
    }
  });

  it("puts the session on the learner's own day: the default zone (Asia/Ho_Chi_Minh) or the one they sent", async () => {
    const vietnam = await createUser({ email: 'vn@example.com' });
    const london = await createUser({ email: 'london@example.com' });
    await setZone(london._id, 'UTC');

    for (const user of [vietnam, london]) {
      await recordCountedSession(String(user._id), new Date('2026-03-10T16:59:59.999Z'));
      await recordCountedSession(String(user._id), new Date('2026-03-10T17:00:00.000Z'));
    }

    expect(await daysOf(vietnam._id)).toMatchObject([
      { date: '2026-03-10', sessions: 1 },
      { date: '2026-03-11', sessions: 1 }
    ]);
    expect(await daysOf(london._id)).toMatchObject([{ date: '2026-03-10', sessions: 2 }]);
  });

  it('uses the default zone for an old account without one and for a zone this server does not know', async () => {
    const old = await createUser({ email: 'old@example.com' });
    await UserModel.collection.updateOne({ _id: old._id }, { $unset: { 'settings.timezone': '' } });
    const odd = await createUser({ email: 'odd@example.com' });
    await UserModel.collection.updateOne({ _id: odd._id }, { $set: { 'settings.timezone': 'Mars/Olympus' } });

    for (const user of [old, odd]) await recordCountedSession(String(user._id), new Date('2026-03-10T17:00:00.000Z'));

    expect(DEFAULT_TIMEZONE).toBe('Asia/Ho_Chi_Minh');
    expect(await daysOf(old._id)).toMatchObject([{ date: '2026-03-11', sessions: 1 }]);
    expect(await daysOf(odd._id)).toMatchObject([{ date: '2026-03-11', sessions: 1 }]);
  });

  it('adds up sessions counted at the same moment in a single row', async () => {
    const user = await createUser({});
    const at = new Date('2026-03-10T05:00:00.000Z');

    await Promise.all(Array.from({ length: 10 }, () => recordCountedSession(String(user._id), at)));

    const days = await DailyProgressModel.find({ owner: user._id });
    expect(days).toHaveLength(1);
    expect(days[0]).toMatchObject({ date: '2026-03-10', sessions: 10 });
    expect(days[0].missionCompletedAt).toEqual(at);
  });

  it("keeps each learner's days apart", async () => {
    const me = await createUser({ email: 'me@example.com' });
    const other = await createUser({ email: 'other@example.com' });
    const at = new Date('2026-03-10T05:00:00.000Z');

    await Promise.all([recordCountedSession(String(me._id), at), recordCountedSession(String(other._id), at)]);

    expect(await daysOf(me._id)).toMatchObject([{ date: '2026-03-10', sessions: 1 }]);
    expect(await daysOf(other._id)).toMatchObject([{ date: '2026-03-10', sessions: 1 }]);
  });
});

describe('rebuildDailyProgress (npm run rebuild:progress)', () => {
  const session = (owner: unknown, completedAt: Date, fields: Record<string, unknown> = {}) => ({
    owner,
    passageId: 'p1',
    targetWords: ['a'],
    status: 'completed',
    isCounted: true,
    completedAt,
    ...fields
  });

  it('builds the same rows as live recording', async () => {
    const user = await createUser({});
    const times = [
      ...hoursOf10March(DAILY_MISSION_SESSIONS + 1),
      new Date('2026-03-10T17:00:00.000Z'), // 00:00 on 11 March in Vietnam
      new Date('2026-03-13T01:00:00.000Z')
    ];
    for (const time of times) await recordCountedSession(String(user._id), time);
    await TypingSessionModel.create(times.map((time) => session(user._id, time)));
    const live = await daysOf(user._id);

    await DailyProgressModel.deleteMany({});
    const result = await rebuildDailyProgress();

    expect(await daysOf(user._id)).toEqual(live);
    expect(live.map((day) => day.date)).toEqual(['2026-03-10', '2026-03-11', '2026-03-13']);
    expect(result).toEqual({ learners: 1, days: 3, removed: 0 });
  });

  it('counts only completed, counted sessions', async () => {
    const user = await createUser({});
    const at = new Date('2026-03-10T05:00:00.000Z');
    await TypingSessionModel.create([
      session(user._id, at),
      session(user._id, at, { isCounted: false }),
      session(user._id, at, { status: 'abandoned' }),
      session(user._id, at, { status: 'in_progress', completedAt: undefined })
    ]);

    await rebuildDailyProgress();

    expect(await daysOf(user._id)).toMatchObject([{ date: '2026-03-10', sessions: 1 }]);
  });

  it("cuts each learner's days in the zone they use now", async () => {
    const vietnam = await createUser({ email: 'vn@example.com' });
    const london = await createUser({ email: 'london@example.com' });
    await setZone(london._id, 'UTC');
    const at = new Date('2026-03-10T17:30:00.000Z');
    await TypingSessionModel.create([session(vietnam._id, at), session(london._id, at)]);

    await rebuildDailyProgress();

    expect(await daysOf(vietnam._id)).toMatchObject([{ date: '2026-03-11', sessions: 1 }]);
    expect(await daysOf(london._id)).toMatchObject([{ date: '2026-03-10', sessions: 1 }]);
  });

  it('corrects wrong rows and removes the rows no session supports', async () => {
    const user = await createUser({});
    const idle = await createUser({ email: 'idle@example.com' }); // no counted session
    const times = hoursOf10March(DAILY_MISSION_SESSIONS);
    await TypingSessionModel.create(times.map((time) => session(user._id, time)));
    await DailyProgressModel.create([
      { owner: user._id, date: '2026-03-10', sessions: 7, missionCompletedAt: new Date('2026-03-10T15:00:00.000Z') },
      { owner: user._id, date: '2026-03-09', sessions: 2 },
      { owner: idle._id, date: '2026-03-10', sessions: 1 },
      { owner: new Types.ObjectId(), date: '2026-03-10', sessions: 1 } // a learner who no longer exists
    ]);

    const result = await rebuildDailyProgress();

    expect(await DailyProgressModel.countDocuments()).toBe(1);
    expect(await daysOf(user._id)).toEqual([
      { date: '2026-03-10', sessions: DAILY_MISSION_SESSIONS, missionCompletedAt: times[DAILY_MISSION_SESSIONS - 1] }
    ]);
    expect(result).toEqual({ learners: 1, days: 1, removed: 3 });
  });

  it('gives the same rows when it runs twice', async () => {
    const vietnam = await createUser({ email: 'vn@example.com' });
    const london = await createUser({ email: 'london@example.com' });
    await setZone(london._id, 'UTC');
    const times = [...hoursOf10March(3), new Date('2026-03-10T17:30:00.000Z'), new Date('2026-04-01T08:00:00.000Z')];
    await TypingSessionModel.create(times.flatMap((time) => [session(vietnam._id, time), session(london._id, time)]));

    const first = await rebuildDailyProgress();
    const rowsAfterFirst = [await daysOf(vietnam._id), await daysOf(london._id)];
    const second = await rebuildDailyProgress();

    expect([await daysOf(vietnam._id), await daysOf(london._id)]).toEqual(rowsAfterFirst);
    expect(first).toEqual({ learners: 2, days: 5, removed: 0 });
    expect(second).toEqual(first);
    expect(await DailyProgressModel.countDocuments()).toBe(5);
  });
});

describe('PATCH /api/sessions/:id/complete puts a counted session in the learner day', () => {
  // Typing picks its passage from the database, which the tests start empty.
  beforeEach(async () => {
    await seedPassages(PASSAGE_LIST);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Starts a session on a passage of 23 words, as if it was opened `msAgo` milliseconds ago. */
  const start = async (authorization: string, msAgo: number) => {
    const passage = (await PassageModel.findOne({ title: 'Tiếng Việt rất đẹp' }))!;
    const { body } = await api().post('/api/sessions').set('Authorization', authorization).send({ passageId: String(passage._id) });
    await TypingSessionModel.findByIdAndUpdate(body._id, { startedAt: new Date(Date.now() - msAgo) });
    return body as { _id: string; targetWords: string[] };
  };

  /** All 23 words in two minutes (about 11.5 WPM): a counted session. */
  const startCounted = (authorization: string) => start(authorization, 120_000);

  const complete = (authorization: string, id: string, typedWords: string[]) =>
    api().patch(`/api/sessions/${id}/complete`).set('Authorization', authorization).send({ typedWords });

  it("adds each counted session to today in the learner's zone and marks the mission done at the goal", async () => {
    // 15:00 on 10 March in Vietnam: no midnight between the sessions.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-03-10T08:00:00.000Z'));
    const user = await createUser({});
    const auth = bearerFor(user);

    for (let done = 1; done <= DAILY_MISSION_SESSIONS + 1; done += 1) {
      const session = await startCounted(auth);
      const response = await complete(auth, session._id, session.targetWords);
      expect(response.body.isCounted).toBe(true);

      const days = await daysOf(user._id);
      expect(days).toHaveLength(1);
      expect(days[0]).toMatchObject({ date: '2026-03-10', sessions: done });
      expect('missionCompletedAt' in days[0]).toBe(done >= DAILY_MISSION_SESSIONS);
    }
  });

  it('puts a session on the day it was completed, also when it was started the day before', async () => {
    // Started at 23:59 on 10 March in Vietnam (16:59 UTC), completed at 00:01 on the 11th.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-03-10T17:01:00.000Z'));
    const user = await createUser({});
    const session = await start(bearerFor(user), 120_000);

    const response = await complete(bearerFor(user), session._id, session.targetWords);

    expect(response.body.isCounted).toBe(true);
    expect(await daysOf(user._id)).toEqual([
      {
        date: '2026-03-11',
        sessions: 1,
        ...(1 >= DAILY_MISSION_SESSIONS && { missionCompletedAt: new Date(response.body.completedAt) })
      }
    ]);
  });

  it('answers 200 when the day cannot be written: the session stays completed and counted, the error is logged', async () => {
    const user = await createUser({});
    const auth = bearerFor(user);
    const session = await startCounted(auth);
    vi.spyOn(DailyProgressModel, 'findOneAndUpdate').mockRejectedValueOnce(new Error('Database offline'));
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await complete(auth, session._id, session.targetWords);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'completed', isCounted: true });
    expect(await DailyProgressModel.countDocuments()).toBe(0);
    expect(logged).toHaveBeenCalledWith(expect.stringContaining('npm run rebuild:progress'), expect.any(Error));
    // A retry finds the session completed: the rebuild is what adds the day.
    expect((await complete(auth, session._id, session.targetWords)).status).toBe(409);
  });

  it('adds nothing for a session that is not counted', async () => {
    const auth = bearerFor(await createUser({}));
    // Starting a session abandons the one in progress: each is completed before the next starts.
    const tooFast = await start(auth, 0); // all 23 words within a second
    expect((await complete(auth, tooFast._id, tooFast.targetWords)).body.isCounted).toBe(false);
    const tooShort = await startCounted(auth); // 10 words only
    expect((await complete(auth, tooShort._id, tooShort.targetWords.slice(0, 10))).body.isCounted).toBe(false);
    const tooLong = await start(auth, 240_000); // past the 3 minutes
    expect((await complete(auth, tooLong._id, tooLong.targetWords)).body.isCounted).toBe(false);

    expect(await DailyProgressModel.countDocuments()).toBe(0);
  });

  it("puts the session on the day of the learner's own zone", async () => {
    // 17:30 UTC on 10 March is already 00:30 on 11 March in Vietnam.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-03-10T17:30:00.000Z'));
    const vietnam = await createUser({ email: 'vn@example.com' });
    const london = await createUser({ email: 'london@example.com' });
    await api().patch('/api/profile/settings').set('Authorization', bearerFor(london)).send({ timezone: 'UTC' });

    for (const user of [vietnam, london]) {
      const session = await startCounted(bearerFor(user));
      expect((await complete(bearerFor(user), session._id, session.targetWords)).body.isCounted).toBe(true);
    }

    expect(await daysOf(vietnam._id)).toMatchObject([{ date: '2026-03-11', sessions: 1 }]);
    expect(await daysOf(london._id)).toMatchObject([{ date: '2026-03-10', sessions: 1 }]);
  });

  it('counts a session once when it is completed twice in a row (200, then 409)', async () => {
    const user = await createUser({});
    const auth = bearerFor(user);
    const session = await startCounted(auth);

    expect((await complete(auth, session._id, session.targetWords)).status).toBe(200);
    const again = await complete(auth, session._id, session.targetWords);

    expect(again.status).toBe(409);
    expect(again.body.message).toBe('Session is not in progress');
    expect(await daysOf(user._id)).toMatchObject([{ sessions: 1 }]);
  });

  it('completes and counts a session once when two requests arrive at the same time (one 200, one 409)', async () => {
    const user = await createUser({});
    const auth = bearerFor(user);
    const session = await startCounted(auth);

    const responses = await Promise.all([
      complete(auth, session._id, session.targetWords),
      complete(auth, session._id, session.targetWords)
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(responses.find((response) => response.status === 409)!.body.message).toBe('Session is not in progress');
    expect((await TypingSessionModel.findById(session._id))!.status).toBe('completed');
    expect(await daysOf(user._id)).toMatchObject([{ sessions: 1 }]);
  });
});

describe('an account that never sent a time zone', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('has its days, streak and activity in the default zone (Asia/Ho_Chi_Minh)', async () => {
    // 17:30 UTC on 10 March is already 00:30 on 11 March in Vietnam.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-03-10T17:30:00.000Z'));
    const old = await createUser({});
    await UserModel.collection.updateOne({ _id: old._id }, { $unset: { 'settings.timezone': '' } });
    await recordCountedSession(String(old._id), new Date());

    const activity = await api().get('/api/sessions/activity').set('Authorization', bearerFor(old));
    const streak = await api().get('/api/profile/streak').set('Authorization', bearerFor(old));

    expect(activity.body).toEqual({
      timezone: 'Asia/Ho_Chi_Minh',
      sessions: [{ date: '2026-03-11', sessions: 1 }]
    });
    expect(streak.body).toMatchObject({ current: 1, longest: 1, today: { date: '2026-03-11', sessions: 1 } });
  });
});
