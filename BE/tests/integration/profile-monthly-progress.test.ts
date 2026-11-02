import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionMode, TypingSessionModel } from '../../src/models/typing-session.model';
import { UserModel } from '../../src/models/user.model';
import { chartKeys } from '../../src/services/monthly-progress.service';
import { api } from '../helpers/api';
import { bearerFor, createUser } from '../helpers/user-factory';

type Owner = { _id: unknown; email: string };

const monthlyOf = (user: Owner, range?: string, date?: string) =>
  api()
    .get('/api/profile/monthly-progress')
    .query({ ...(range ? { range } : {}), ...(date ? { date } : {}) })
    .set('Authorization', bearerFor(user));

/** A finished session of `owner`, with its speed and its accuracy (0-100). */
const session = (
  owner: Owner,
  mode: SessionMode,
  completedAt: string,
  wpm: number,
  accuracy = 95,
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
    accuracy,
    isCounted
  });

/** The 12 months of a window that ends in March 2026 (the current month), oldest first. */
const WINDOW = [
  '2025-04', '2025-05', '2025-06', '2025-07', '2025-08', '2025-09',
  '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03'
];

const empty = (key: string) => ({ key, avgWpm: null, avgAccuracy: null, carriedOver: false });
const point = (key: string, avgWpm: number, avgAccuracy: number, carriedOver = false) => ({
  key,
  avgWpm,
  avgAccuracy,
  carriedOver
});

describe('GET /api/profile/monthly-progress (SCRUM-240)', () => {
  // Today is fixed: 10 March 2026, 15:00 in Vietnam. The last month of the chart is the current one, March 2026.
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

  it('answers 12 months without data for a learner with no sessions, the last one being the current month', async () => {
    const user = await createUser({});

    const response = await monthlyOf(user);

    expect(response.status).toBe(200);
    expect(response.body.points).toEqual(WINDOW.map(empty));
  });

  it('has no data before the first counted placement session', async () => {
    const user = await createUser({});
    await session(user, 'practice', '2025-12-05T03:00:00.000Z', 40, 92);
    await session(user, 'practice', '2026-01-05T03:00:00.000Z', 45, 91, false);

    expect((await monthlyOf(user)).body.points).toEqual(WINDOW.map(empty));
  });

  it('starts at the month of the first counted placement session and averages every counted session after it', async () => {
    const user = await createUser({});
    await session(user, 'practice', '2025-08-20T03:00:00.000Z', 99, 50); // before the start: ignored
    await session(user, 'placement', '2025-10-03T03:00:00.000Z', 30, 94);
    await session(user, 'practice', '2025-10-20T03:00:00.000Z', 50, 90); // same month as the start
    await session(user, 'daily', '2025-11-10T03:00:00.000Z', 60, 92);
    await session(user, 'practice', '2025-11-11T03:00:00.000Z', 40, 96);
    await session(user, 'placement', '2025-12-10T03:00:00.000Z', 70, 100); // a second placement: one more session

    const { points: months } = (await monthlyOf(user)).body;

    expect(months.slice(0, 6)).toEqual(WINDOW.slice(0, 6).map(empty));
    expect(months.slice(6)).toEqual([
      point('2025-10', 40, 92),
      point('2025-11', 50, 94),
      point('2025-12', 70, 100),
      point('2026-01', 70, 100, true),
      point('2026-02', 70, 100, true),
      point('2026-03', 70, 100, true)
    ]);
  });

  it('rounds the averages of the sessions of a month to one decimal', async () => {
    const user = await createUser({});
    await session(user, 'placement', '2026-02-05T03:00:00.000Z', 40, 90);
    await session(user, 'practice', '2026-02-10T03:00:00.000Z', 41, 91);
    await session(user, 'practice', '2026-02-12T03:00:00.000Z', 41, 91);

    expect((await monthlyOf(user)).body.points[10]).toEqual(point('2026-02', 40.7, 90.7));
  });

  it('ignores sessions that are not counted and other learners, and includes the current month', async () => {
    const user = await createUser({});
    const other = await createUser({ email: 'other@example.com' });
    await session(user, 'placement', '2026-01-04T03:00:00.000Z', 30, 90);
    await session(user, 'practice', '2026-01-05T03:00:00.000Z', 200, 10, false); // not counted
    await session(user, 'practice', '2026-03-05T03:00:00.000Z', 90, 80); // the current month: it counts
    await session(other, 'placement', '2026-01-06T03:00:00.000Z', 80, 70);

    const { points: months } = (await monthlyOf(user)).body;

    expect(months[9]).toEqual(point('2026-01', 30, 90));
    expect(months[10]).toEqual(point('2026-02', 30, 90, true));
    expect(months[11]).toEqual(point('2026-03', 90, 80));
  });

  it('shows the current month alone when the first placement session is in it', async () => {
    const user = await createUser({});
    await session(user, 'placement', '2026-03-02T03:00:00.000Z', 30, 90);

    expect((await monthlyOf(user)).body.points).toEqual([...WINDOW.slice(0, 11).map(empty), point('2026-03', 30, 90)]);
  });

  it('keeps the figures of the month before for a month without a session, over several months', async () => {
    const user = await createUser({});
    await session(user, 'placement', '2025-05-10T03:00:00.000Z', 30, 92);
    await session(user, 'practice', '2025-09-10T03:00:00.000Z', 44, 90);
    await session(user, 'practice', '2025-09-12T03:00:00.000Z', 46, 94);

    const { points: months } = (await monthlyOf(user)).body;

    expect(months[0]).toEqual(empty('2025-04'));
    expect(months.slice(1, 5)).toEqual([
      point('2025-05', 30, 92),
      point('2025-06', 30, 92, true),
      point('2025-07', 30, 92, true),
      point('2025-08', 30, 92, true)
    ]);
    expect(months[5]).toEqual(point('2025-09', 45, 92)); // a month with sessions after the gap is real again
    expect(months.slice(6)).toEqual(WINDOW.slice(6).map((key) => point(key, 45, 92, true)));
  });

  it('carries the last month before the window when the first month of the window has no session', async () => {
    const user = await createUser({});
    await session(user, 'placement', '2024-11-10T03:00:00.000Z', 35, 90);
    await session(user, 'practice', '2025-01-10T03:00:00.000Z', 38, 85); // the last month with data before the window
    await session(user, 'practice', '2025-06-10T03:00:00.000Z', 50, 97);

    const { points: months } = (await monthlyOf(user)).body;

    expect(months[0]).toEqual(point('2025-04', 38, 85, true));
    expect(months[1]).toEqual(point('2025-05', 38, 85, true));
    expect(months[2]).toEqual(point('2025-06', 50, 97));
  });

  it("cuts the months in the learner's time zone", async () => {
    const vietnam = await createUser({});
    const utc = await createUser({ email: 'utc@example.com' });
    await UserModel.updateOne({ _id: utc._id }, { $set: { 'settings.timezone': 'UTC' } });
    // 18:00 UTC on 31 January is 01:00 on 1 February in Vietnam (UTC+7).
    for (const user of [vietnam, utc]) {
      await session(user, 'placement', '2025-12-10T03:00:00.000Z', 30, 100);
      await session(user, 'practice', '2026-01-31T18:00:00.000Z', 60, 90);
    }

    const vietnamMonths = (await monthlyOf(vietnam)).body.points;
    const utcMonths = (await monthlyOf(utc)).body.points;

    expect(vietnamMonths.slice(8)).toEqual([
      point('2025-12', 30, 100),
      point('2026-01', 30, 100, true),
      point('2026-02', 60, 90),
      point('2026-03', 60, 90, true)
    ]);
    expect(utcMonths.slice(8)).toEqual([
      point('2025-12', 30, 100),
      point('2026-01', 60, 90),
      point('2026-02', 60, 90, true),
      point('2026-03', 60, 90, true)
    ]);
  });

  it('never sends the owner or other private fields', async () => {
    const user = await createUser({});
    await session(user, 'placement', '2026-02-10T03:00:00.000Z', 30, 90);

    const response = await monthlyOf(user);

    expect(Object.keys(response.body).sort()).toEqual(['points', 'range']);
    expect(Object.keys(response.body.points[11]).sort()).toEqual(['avgAccuracy', 'avgWpm', 'carriedOver', 'key']);
  });

  it('is a year by default, and says which range it answers', async () => {
    const user = await createUser({});

    expect((await monthlyOf(user)).body.range).toBe('year');
    expect((await monthlyOf(user, 'year')).body.points).toHaveLength(12);
  });

  it('answers 400 for an unknown range', async () => {
    const user = await createUser({});

    expect((await monthlyOf(user, 'decade')).status).toBe(400);
  });

  describe('range=month: the current month in blocks of 7 days', () => {
    const BLOCKS = ['2026-03-01', '2026-03-08', '2026-03-15', '2026-03-22', '2026-03-29'];

    it('answers the blocks of the month, empty for a learner with no placement', async () => {
      const user = await createUser({});

      const response = await monthlyOf(user, 'month');

      expect(response.body.range).toBe('month');
      expect(response.body.points).toEqual(BLOCKS.slice(0, 2).map(empty)); // today is the 10th: the later blocks are left out
    });

    it('averages the sessions of a block, and leaves out the blocks that have not started', async () => {
      const user = await createUser({});
      await session(user, 'placement', '2026-03-01T03:00:00.000Z', 20, 90);
      await session(user, 'practice', '2026-03-02T03:00:00.000Z', 40, 94);
      await session(user, 'practice', '2026-03-06T03:00:00.000Z', 60, 98);
      await session(user, 'practice', '2026-03-09T03:00:00.000Z', 50, 96);

      expect((await monthlyOf(user, 'month')).body.points).toEqual([
        point('2026-03-01', 40, 94),
        point('2026-03-08', 50, 96) // today is the 10th: the blocks of the 15th, 22nd and 29th are left out
      ]);
    });

    it('keeps the figures of the block before for a block without a session, from the month before too', async () => {
      const user = await createUser({});
      await session(user, 'placement', '2026-02-24T03:00:00.000Z', 35, 92);

      expect((await monthlyOf(user, 'month')).body.points.slice(0, 2)).toEqual([
        point('2026-03-01', 35, 92, true),
        point('2026-03-08', 35, 92, true)
      ]);
    });

    it('starts at the block of the first placement session', async () => {
      const user = await createUser({});
      await session(user, 'placement', '2026-03-09T03:00:00.000Z', 30, 91);

      expect((await monthlyOf(user, 'month')).body.points).toEqual([empty('2026-03-01'), point('2026-03-08', 30, 91)]);
    });
  });

  describe('range=week: the last 7 days, one point a day', () => {
    const DAYS = ['2026-03-04', '2026-03-05', '2026-03-06', '2026-03-07', '2026-03-08', '2026-03-09', '2026-03-10'];

    it('answers 7 days ending today, empty for a learner with no placement', async () => {
      const user = await createUser({});

      expect((await monthlyOf(user, 'week')).body.points).toEqual(DAYS.map(empty));
    });

    it('starts at the day of the first placement and keeps the figures of the day before on a day without a session', async () => {
      const user = await createUser({});
      await session(user, 'placement', '2026-03-05T03:00:00.000Z', 30, 92);
      await session(user, 'practice', '2026-03-08T03:00:00.000Z', 60, 90);
      await session(user, 'practice', '2026-03-08T05:00:00.000Z', 70, 94);

      expect((await monthlyOf(user, 'week')).body.points).toEqual([
        empty('2026-03-04'),
        point('2026-03-05', 30, 92),
        point('2026-03-06', 30, 92, true),
        point('2026-03-07', 30, 92, true),
        point('2026-03-08', 65, 92),
        point('2026-03-09', 65, 92, true),
        point('2026-03-10', 65, 92, true)
      ]);
    });

    it('carries the last day before the week when the whole week has no session', async () => {
      const user = await createUser({});
      await session(user, 'placement', '2026-02-20T03:00:00.000Z', 35, 90);
      await session(user, 'practice', '2026-03-01T03:00:00.000Z', 45, 94);

      expect((await monthlyOf(user, 'week')).body.points).toEqual(DAYS.map((key) => point(key, 45, 94, true)));
    });

    it("cuts the days in the learner's time zone", async () => {
      const user = await createUser({});
      // 18:00 UTC on 8 March is 01:00 on 9 March in Vietnam.
      await session(user, 'placement', '2026-03-05T03:00:00.000Z', 30, 100);
      await session(user, 'practice', '2026-03-08T18:00:00.000Z', 60, 90);

      const points = (await monthlyOf(user, 'week')).body.points;

      expect(points[4]).toEqual(point('2026-03-08', 30, 100, true));
      expect(points[5]).toEqual(point('2026-03-09', 60, 90));
    });
  });
});

describe('date=: a chosen year, month or week', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-03-10T08:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the calendar year that holds the day, January to the current month, the months not started left out', async () => {
    const user = await createUser({});
    await session(user, 'placement', '2026-01-12T03:00:00.000Z', 30, 92);
    await session(user, 'practice', '2026-03-02T03:00:00.000Z', 50, 96);

    const points = (await monthlyOf(user, 'year', '2026-03-10')).body.points;

    expect(points).toEqual([point('2026-01', 30, 92), point('2026-02', 30, 92, true), point('2026-03', 50, 96)]);
  });

  it('shows a past year with the figures of the months before it carried in', async () => {
    const user = await createUser({});
    await session(user, 'placement', '2025-02-12T03:00:00.000Z', 30, 92);

    const points = (await monthlyOf(user, 'year', '2025-06-15')).body.points;

    expect(points[0]).toEqual(empty('2025-01'));
    expect(points[1]).toEqual(point('2025-02', 30, 92));
    expect(points[11]).toEqual(point('2025-12', 30, 92, true));
  });

  it('shows the month that holds the day, in blocks of 7 days', async () => {
    const user = await createUser({});
    await session(user, 'placement', '2026-02-09T03:00:00.000Z', 40, 90);

    const points = (await monthlyOf(user, 'month', '2026-02-20')).body.points;

    expect(points).toEqual([empty('2026-02-01'), point('2026-02-08', 40, 90), point('2026-02-15', 40, 90, true), point('2026-02-22', 40, 90, true)]);
  });

  it('shows the week of the day, counted from the 1st of the month (days 8-14 for the 10th)', async () => {
    const user = await createUser({});
    await session(user, 'placement', '2026-02-20T03:00:00.000Z', 30, 92);
    await session(user, 'practice', '2026-03-09T03:00:00.000Z', 50, 96);

    const points = (await monthlyOf(user, 'week', '2026-03-05')).body.points; // days 1-7
    const next = (await monthlyOf(user, 'week', '2026-03-10')).body.points; // days 8-14

    expect(points.map((p: { key: string }) => p.key)).toEqual(['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06', '2026-03-07']);
    expect(points[0]).toEqual(point('2026-03-01', 30, 92, true));
    expect(next).toEqual([point('2026-03-08', 30, 92, true), point('2026-03-09', 50, 96), point('2026-03-10', 50, 96, true)]);
  });

  it('leaves out the days that have not come', async () => {
    const user = await createUser({});
    await session(user, 'placement', '2026-03-09T03:00:00.000Z', 30, 92);

    const points = (await monthlyOf(user, 'week', '2026-03-10')).body.points; // days 8-14, today is the 10th

    expect(points.map((p: { key: string }) => p.key)).toEqual(['2026-03-08', '2026-03-09', '2026-03-10']);
    expect(points[2]).toEqual(point('2026-03-10', 30, 92, true));
  });

  it('ends the last week at the end of the month', async () => {
    const user = await createUser({});

    expect((await monthlyOf(user, 'week', '2026-02-28')).body.points.map((p: { key: string }) => p.key)).toEqual(['2026-02-22', '2026-02-23', '2026-02-24', '2026-02-25', '2026-02-26', '2026-02-27', '2026-02-28']);
    expect((await monthlyOf(user, 'week', '2026-01-30')).body.points.map((p: { key: string }) => p.key)).toEqual(['2026-01-29', '2026-01-30', '2026-01-31']);
  });

  it('answers 400 for a date that is not a day', async () => {
    const user = await createUser({});

    expect((await monthlyOf(user, 'week', '2026-02-30')).status).toBe(400);
    expect((await monthlyOf(user, 'week', 'yesterday')).status).toBe(400);
  });
});

describe('chartKeys', () => {
  it('has 4 blocks in a month of 28 days and 5 in the others', () => {
    expect(chartKeys('month', '2026-02-10')).toEqual(['2026-02-01', '2026-02-08', '2026-02-15', '2026-02-22']);
    expect(chartKeys('month', '2028-02-10')).toHaveLength(5); // a leap year: 29 days
    expect(chartKeys('month', '2026-04-10')).toHaveLength(5);
    expect(chartKeys('month', '2026-03-31').at(-1)).toBe('2026-03-29');
  });

  it('has the calendar period that holds a chosen day', () => {
    expect(chartKeys('year', '2026-03-10', '2024-08-01')[0]).toBe('2024-01');
    expect(chartKeys('year', '2026-03-10', '2024-08-01')[11]).toBe('2024-12');
    expect(chartKeys('month', '2026-03-10', '2026-02-20')).toHaveLength(4);
    expect(chartKeys('week', '2026-03-10', '2026-03-07')[0]).toBe('2026-03-01'); // weeks count from the 1st: days 1-7
    expect(chartKeys('week', '2026-03-10', '2026-03-08')[0]).toBe('2026-03-08');
    expect(chartKeys('week', '2026-03-10', '2026-03-31')).toEqual(['2026-03-29', '2026-03-30', '2026-03-31']);
  });

  it('has the 12 months ending in the current one, and the 7 days ending today', () => {
    expect(chartKeys('year', '2026-01-15')).toEqual([
      '2025-02', '2025-03', '2025-04', '2025-05', '2025-06', '2025-07',
      '2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01'
    ]);
    expect(chartKeys('week', '2026-03-02')).toEqual([
      '2026-02-24', '2026-02-25', '2026-02-26', '2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02'
    ]);
  });
});
