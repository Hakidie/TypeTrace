import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DailyProgressModel } from '../../src/models/daily-progress.model';
import { UserModel } from '../../src/models/user.model';
import { DAILY_MISSION_SESSIONS, recordCountedSession } from '../../src/services/daily-progress.service';
import { api } from '../helpers/api';
import { bearerFor, createUser } from '../helpers/user-factory';

const streakOf = (user: { _id: unknown; email: string }) =>
  api().get('/api/profile/streak').set('Authorization', bearerFor(user));

/** A day with counted sessions, the mission done (`DAILY_MISSION_SESSIONS` is reached by live recording). */
const day = (owner: unknown, date: string, sessions = DAILY_MISSION_SESSIONS) => ({
  owner,
  date,
  sessions,
  missionCompletedAt: new Date(`${date}T03:00:00.000Z`)
});

const emptyToday = (date: string) => ({ date, sessions: 0, missionGoal: DAILY_MISSION_SESSIONS, missionCompleted: false });

describe('GET /api/profile/streak (SCRUM-31)', () => {
  // Today is fixed, so no test runs across a midnight: 10 March 2026, 15:00 in Vietnam.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-03-10T08:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("counts the days in a row ending today, with today's sessions and the mission", async () => {
    const user = await createUser({});
    await DailyProgressModel.create([day(user._id, '2026-03-08'), day(user._id, '2026-03-09'), day(user._id, '2026-03-10', 3)]);

    const response = await streakOf(user);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      current: 3,
      longest: 3,
      today: { date: '2026-03-10', sessions: 3, missionGoal: DAILY_MISSION_SESSIONS, missionCompleted: true }
    });
  });

  it('keeps the streak alive from yesterday while today has no session yet', async () => {
    const user = await createUser({});
    await DailyProgressModel.create([day(user._id, '2026-03-08'), day(user._id, '2026-03-09')]);

    expect((await streakOf(user)).body).toEqual({ current: 2, longest: 2, today: emptyToday('2026-03-10') });
  });

  it('breaks the streak when the last session was two days ago, and keeps the longest run', async () => {
    const user = await createUser({});
    const february = ['2026-02-25', '2026-02-26', '2026-02-27', '2026-02-28', '2026-03-01'];
    await DailyProgressModel.create([...february.map((date) => day(user._id, date)), day(user._id, '2026-03-07'), day(user._id, '2026-03-08')]);

    expect((await streakOf(user)).body).toEqual({ current: 0, longest: 5, today: emptyToday('2026-03-10') });
  });

  it('marks the mission done once today reaches the goal of counted sessions', async () => {
    const user = await createUser({});

    for (let done = 1; done <= DAILY_MISSION_SESSIONS; done += 1) {
      await recordCountedSession(String(user._id), new Date());
      expect((await streakOf(user)).body).toEqual({
        current: 1,
        longest: 1,
        today: { date: '2026-03-10', sessions: done, missionGoal: DAILY_MISSION_SESSIONS, missionCompleted: done >= DAILY_MISSION_SESSIONS }
      });
    }
  });

  it("counts only the learner's own days", async () => {
    const me = await createUser({ email: 'me@example.com' });
    const other = await createUser({ email: 'other@example.com' });
    await DailyProgressModel.create([day(other._id, '2026-03-09'), day(other._id, '2026-03-10', 5), day(me._id, '2026-02-01')]);

    expect((await streakOf(me)).body).toEqual({ current: 0, longest: 1, today: emptyToday('2026-03-10') });
  });

  it("takes today in the learner's own zone", async () => {
    // 17:30 UTC on 10 March is 00:30 on 11 March in Vietnam.
    vi.setSystemTime(new Date('2026-03-10T17:30:00.000Z'));
    const vietnam = await createUser({ email: 'vn@example.com' });
    const london = await createUser({ email: 'london@example.com' });
    await UserModel.updateOne({ _id: london._id }, { $set: { 'settings.timezone': 'UTC' } });
    await DailyProgressModel.create([vietnam._id, london._id].flatMap((owner) => [day(owner, '2026-03-09'), day(owner, '2026-03-10')]));

    // Vietnam: today (11 March) has no session yet, the streak is alive from yesterday.
    expect((await streakOf(vietnam)).body).toEqual({ current: 2, longest: 2, today: emptyToday('2026-03-11') });
    // UTC: it is still 10 March.
    expect((await streakOf(london)).body).toMatchObject({ current: 2, longest: 2, today: { date: '2026-03-10', missionCompleted: true } });
  });

  it('answers zeros for a new learner and 401 without a token', async () => {
    const user = await createUser({});

    expect((await streakOf(user)).body).toEqual({ current: 0, longest: 0, today: emptyToday('2026-03-10') });
    expect((await api().get('/api/profile/streak')).status).toBe(401);
  });

  it('answers 404 when the signed-in user no longer exists', async () => {
    const user = await createUser({});
    await UserModel.deleteOne({ _id: user._id });

    const response = await streakOf(user);

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('User not found');
  });
});
