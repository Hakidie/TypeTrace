import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionMode, TypingSessionModel } from '../../src/models/typing-session.model';
import { UserModel } from '../../src/models/user.model';
import { api } from '../helpers/api';
import { bearerFor, createUser } from '../helpers/user-factory';

type Owner = { _id: unknown; email: string };

const monthlyOf = (user: Owner) => api().get('/api/profile/monthly-progress').set('Authorization', bearerFor(user));

/** A finished session of `owner`; `errors` all go to one error type, the total is what the chart sums. */
const session = (
  owner: Owner,
  mode: SessionMode,
  completedAt: string,
  wpm: number,
  errors = 0,
  isCounted = true
) =>
  TypingSessionModel.create({
    owner: owner._id,
    mode,
    passageId: 'p1',
    targetWords: ['a'],
    status: 'completed',
    completedAt: new Date(completedAt),
    wpm,
    isCounted,
    errorCounts: { BASE_LETTER: errors }
  });

/** The 12 months of a window that ends in February 2026, oldest first. */
const WINDOW = [
  '2025-03', '2025-04', '2025-05', '2025-06', '2025-07', '2025-08',
  '2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02'
];

const empty = (month: string) => ({ month, avgWpm: null, totalErrors: null, carriedOver: false });
const point = (month: string, avgWpm: number, totalErrors: number, carriedOver = false) => ({
  month,
  avgWpm,
  totalErrors,
  carriedOver
});

describe('GET /api/profile/monthly-progress (SCRUM-240)', () => {
  // Today is fixed: 10 March 2026, 15:00 in Vietnam. The last month of the chart is February 2026.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-03-10T08:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('answers 401 without a token', async () => {
    expect((await api().get('/api/profile/monthly-progress')).status).toBe(401);
  });

  it('answers 12 months without data for a learner with no sessions, the last one being last month', async () => {
    const user = await createUser({});

    const response = await monthlyOf(user);

    expect(response.status).toBe(200);
    expect(response.body.months).toEqual(WINDOW.map(empty));
  });

  it('has no data before the first counted placement session', async () => {
    const user = await createUser({});
    await session(user, 'practice', '2025-12-05T03:00:00.000Z', 40, 2);
    await session(user, 'practice', '2026-01-05T03:00:00.000Z', 45, 1, false);

    expect((await monthlyOf(user)).body.months).toEqual(WINDOW.map(empty));
  });

  it('starts at the month of the first counted placement session and averages every counted session after it', async () => {
    const user = await createUser({});
    await session(user, 'practice', '2025-08-20T03:00:00.000Z', 99, 9); // before the start: ignored
    await session(user, 'placement', '2025-10-03T03:00:00.000Z', 30, 4);
    await session(user, 'practice', '2025-10-20T03:00:00.000Z', 50, 2); // same month as the start
    await session(user, 'daily', '2025-11-10T03:00:00.000Z', 60, 1);
    await session(user, 'practice', '2025-11-11T03:00:00.000Z', 40, 3);
    await session(user, 'placement', '2025-12-10T03:00:00.000Z', 70, 0); // a second placement: one more session

    const { months } = (await monthlyOf(user)).body;

    expect(months.slice(0, 7)).toEqual(WINDOW.slice(0, 7).map(empty));
    expect(months.slice(7)).toEqual([
      point('2025-10', 40, 6),
      point('2025-11', 50, 4),
      point('2025-12', 70, 0),
      point('2026-01', 70, 0, true),
      point('2026-02', 70, 0, true)
    ]);
  });

  it('sums the five error types of a session', async () => {
    const user = await createUser({});
    await TypingSessionModel.create({
      owner: user._id,
      mode: 'placement',
      passageId: 'p1',
      targetWords: ['a'],
      status: 'completed',
      completedAt: new Date('2026-02-10T03:00:00.000Z'),
      wpm: 41.5,
      isCounted: true,
      errorCounts: { BASE_LETTER: 1, D_MISSING: 2, MARK_WRONG: 3, TONE_WRONG: 4, HOI_NGA_CONFUSION: 5 }
    });

    expect((await monthlyOf(user)).body.months[11]).toEqual(point('2026-02', 41.5, 15));
  });

  it('ignores sessions that are not counted, the current month and other learners', async () => {
    const user = await createUser({});
    const other = await createUser({ email: 'other@example.com' });
    await session(user, 'placement', '2026-01-04T03:00:00.000Z', 30, 1);
    await session(user, 'practice', '2026-01-05T03:00:00.000Z', 200, 50, false); // not counted
    await session(user, 'practice', '2026-03-05T03:00:00.000Z', 90, 9); // this month
    await session(other, 'placement', '2026-01-06T03:00:00.000Z', 80, 7);

    const { months } = (await monthlyOf(user)).body;

    expect(months[10]).toEqual(point('2026-01', 30, 1));
    expect(months[11]).toEqual(point('2026-02', 30, 1, true));
  });

  it('shows no data when the first placement session is in the current month', async () => {
    const user = await createUser({});
    await session(user, 'placement', '2026-03-02T03:00:00.000Z', 30, 1);

    expect((await monthlyOf(user)).body.months).toEqual(WINDOW.map(empty));
  });

  it('keeps the figures of the month before for a month without a session, over several months', async () => {
    const user = await createUser({});
    await session(user, 'placement', '2025-05-10T03:00:00.000Z', 30, 5);
    await session(user, 'practice', '2025-09-10T03:00:00.000Z', 44, 2);
    await session(user, 'practice', '2025-09-12T03:00:00.000Z', 46, 4);

    const { months } = (await monthlyOf(user)).body;

    expect(months.slice(0, 2)).toEqual([empty('2025-03'), empty('2025-04')]);
    expect(months.slice(2, 6)).toEqual([
      point('2025-05', 30, 5),
      point('2025-06', 30, 5, true),
      point('2025-07', 30, 5, true),
      point('2025-08', 30, 5, true)
    ]);
    expect(months[6]).toEqual(point('2025-09', 45, 6)); // a month with sessions after the gap is real again
    expect(months.slice(7)).toEqual(WINDOW.slice(7).map((month) => point(month, 45, 6, true)));
  });

  it('carries the last month before the window when the first month of the window has no session', async () => {
    const user = await createUser({});
    await session(user, 'placement', '2024-11-10T03:00:00.000Z', 35, 3);
    await session(user, 'practice', '2025-01-10T03:00:00.000Z', 38, 8); // the last month with data before the window
    await session(user, 'practice', '2025-06-10T03:00:00.000Z', 50, 1);

    const { months } = (await monthlyOf(user)).body;

    expect(months[0]).toEqual(point('2025-03', 38, 8, true));
    expect(months[2]).toEqual(point('2025-05', 38, 8, true));
    expect(months[3]).toEqual(point('2025-06', 50, 1));
  });

  it("cuts the months in the learner's time zone", async () => {
    const vietnam = await createUser({});
    const utc = await createUser({ email: 'utc@example.com' });
    await UserModel.updateOne({ _id: utc._id }, { $set: { 'settings.timezone': 'UTC' } });
    // 18:00 UTC on 31 January is 01:00 on 1 February in Vietnam (UTC+7).
    for (const user of [vietnam, utc]) {
      await session(user, 'placement', '2025-12-10T03:00:00.000Z', 30, 0);
      await session(user, 'practice', '2026-01-31T18:00:00.000Z', 60, 6);
    }

    const vietnamMonths = (await monthlyOf(vietnam)).body.months;
    const utcMonths = (await monthlyOf(utc)).body.months;

    expect(vietnamMonths.slice(9)).toEqual([point('2025-12', 30, 0), point('2026-01', 30, 0, true), point('2026-02', 60, 6)]);
    expect(utcMonths.slice(9)).toEqual([point('2025-12', 30, 0), point('2026-01', 60, 6), point('2026-02', 60, 6, true)]);
  });

  it('never sends the owner or other private fields', async () => {
    const user = await createUser({});
    await session(user, 'placement', '2026-02-10T03:00:00.000Z', 30, 1);

    const response = await monthlyOf(user);

    expect(Object.keys(response.body)).toEqual(['months']);
    expect(Object.keys(response.body.months[11]).sort()).toEqual(['avgWpm', 'carriedOver', 'month', 'totalErrors']);
  });
});
