import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TypingSessionModel } from '../../src/models/typing-session.model';
import { UserModel } from '../../src/models/user.model';
import { buildErrorTrend, type ErrorDayTotals } from '../../src/services/error-trend.service';
import { api } from '../helpers/api';
import { bearerFor, createUser } from '../helpers/user-factory';

type Owner = { _id: unknown; email: string };

const trendOf = (user: Owner, query: Record<string, string> = {}) =>
  api().get('/api/profile/error-trend').query(query).set('Authorization', bearerFor(user));

/** A counted session finished at `completedAt` with `[errors, chances]` of the Vietnamese types given. */
const session = (owner: Owner, completedAt: string, counts: Record<string, readonly [number, number]>, fields: Record<string, unknown> = {}) =>
  TypingSessionModel.create({
    owner: owner._id,
    mode: 'practice',
    passageId: 'p1',
    targetWords: ['a'],
    status: 'completed',
    isCounted: true,
    completedAt: new Date(completedAt),
    wpm: 30,
    accuracy: 95,
    errorCounts: Object.fromEntries(Object.entries(counts).map(([type, [errors]]) => [type, errors])),
    opportunityCounts: Object.fromEntries(Object.entries(counts).map(([type, [, chances]]) => [type, chances])),
    ...fields
  });

const VI_TYPES = ['BASE_LETTER', 'D_MISSING', 'MARK_WRONG', 'TONE_WRONG', 'HOI_NGA_CONFUSION'];
const pointOf = (body: { points: { key: string; rates: Record<string, number | null> }[] }, key: string) => body.points.find((point) => point.key === key)!;

describe('buildErrorTrend (SCRUM-30, pure)', () => {
  const day = (errors: Record<string, number>, opportunities: Record<string, number>): ErrorDayTotals => ({ errors, opportunities });

  it('gives each period the total errors over the total chances of its days, a gap where there was no chance', () => {
    const days = new Map([
      ['2026-03-02', day({ TONE_WRONG: 1, BASE_LETTER: 0 }, { TONE_WRONG: 10, BASE_LETTER: 20 })],
      ['2026-03-03', day({ TONE_WRONG: 2 }, { TONE_WRONG: 10 })],
      ['2026-03-09', day({ TONE_WRONG: 0 }, { TONE_WRONG: 0 })]
    ]);

    const points = buildErrorTrend('month', ['2026-03-01', '2026-03-08'], days, ['TONE_WRONG', 'BASE_LETTER'], '2026-03-10');

    // Pooled, not an average of the days: 3 errors in 20 chances.
    expect(points[0]).toEqual({ key: '2026-03-01', rates: { TONE_WRONG: 15, BASE_LETTER: 0 } });
    // The second block had a session but no chance of either type: a gap, never 0.
    expect(points[1]).toEqual({ key: '2026-03-08', rates: { TONE_WRONG: null, BASE_LETTER: null } });
  });

  it('leaves out the periods that have not started and caps a rate at 100', () => {
    const days = new Map([['2026-03-09', day({ MARK_WRONG: 9 }, { MARK_WRONG: 3 })]]);

    const points = buildErrorTrend('week', ['2026-03-09', '2026-03-10', '2026-03-11'], days, ['MARK_WRONG'], '2026-03-10');

    expect(points.map((point) => point.key)).toEqual(['2026-03-09', '2026-03-10']);
    expect(points[0].rates.MARK_WRONG).toBe(100);
  });
});

describe('GET /api/profile/error-trend (SCRUM-30)', () => {
  // Today is fixed: Tuesday 10 March 2026, 15:00 in Vietnam.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-03-10T08:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('answers 401 without a token', async () => {
    expect((await api().get('/api/profile/error-trend')).status).toBe(401);
  });

  it('answers the five Vietnamese types and a gap for every period of a learner with no sessions', async () => {
    const user = await createUser({});

    const { status, body } = await trendOf(user, { range: 'month' });

    expect(status).toBe(200);
    expect(body).toMatchObject({ range: 'month', language: 'vi', types: VI_TYPES });
    expect(body.points.map((point: { key: string }) => point.key)).toEqual(['2026-03-01', '2026-03-08']);
    for (const point of body.points) expect(Object.values(point.rates).every((rate) => rate === null)).toBe(true);
  });

  it('gives each block of the month the pooled rate of its counted sessions', async () => {
    const user = await createUser({});
    await session(user, '2026-03-02T03:00:00.000Z', { TONE_WRONG: [1, 10], BASE_LETTER: [0, 20] });
    await session(user, '2026-03-03T03:00:00.000Z', { TONE_WRONG: [2, 10] });
    await session(user, '2026-03-09T03:00:00.000Z', { TONE_WRONG: [5, 10] });

    const { body } = await trendOf(user, { range: 'month' });

    expect(pointOf(body, '2026-03-01').rates).toMatchObject({ TONE_WRONG: 15, BASE_LETTER: 0, D_MISSING: null });
    expect(pointOf(body, '2026-03-08').rates).toMatchObject({ TONE_WRONG: 50, BASE_LETTER: null });
  });

  it('counts only counted, completed sessions of the learner in the language asked, never another learner\'s', async () => {
    const user = await createUser({});
    const other = await createUser({ email: 'other@example.com' });
    await session(user, '2026-03-02T03:00:00.000Z', { TONE_WRONG: [1, 10] });
    await session(user, '2026-03-03T03:00:00.000Z', { TONE_WRONG: [9, 10] }, { isCounted: false });
    await session(user, '2026-03-04T03:00:00.000Z', { TONE_WRONG: [9, 10] }, { status: 'abandoned' });
    await session(user, '2026-03-05T03:00:00.000Z', { TONE_WRONG: [9, 10] }, { language: 'en' });
    await session(other, '2026-03-06T03:00:00.000Z', { TONE_WRONG: [9, 10] });

    const { body } = await trendOf(user, { range: 'month' });

    expect(pointOf(body, '2026-03-01').rates.TONE_WRONG).toBe(10);
  });

  it('answers the six English types for an English language, from the English sessions only', async () => {
    const user = await createUser({});
    await session(user, '2026-03-02T03:00:00.000Z', { TONE_WRONG: [9, 10] });
    await session(user, '2026-03-03T03:00:00.000Z', { LETTER_MISSING: [1, 4], CASE_WRONG: [0, 2] }, { language: 'en' });

    const { body } = await trendOf(user, { range: 'month', language: 'en' });

    expect(body.language).toBe('en');
    expect(body.types).toEqual(['LETTER_WRONG', 'LETTER_MISSING', 'LETTER_EXTRA', 'LETTERS_SWAPPED', 'CASE_WRONG', 'PUNCTUATION_WRONG']);
    expect(pointOf(body, '2026-03-01').rates).toMatchObject({ LETTER_MISSING: 25, CASE_WRONG: 0, LETTER_WRONG: null });
  });

  it('cuts the days in the learner\'s time zone', async () => {
    const user = await createUser({});
    await UserModel.updateOne({ _id: user._id }, { 'settings.timezone': 'America/Los_Angeles' });
    // 1 March 2026, 03:00 UTC is still 28 February in Los Angeles: February, so the March block 1-7 has nothing.
    await session(user, '2026-03-01T03:00:00.000Z', { TONE_WRONG: [1, 10] });

    const march = await trendOf(user, { range: 'month' });
    const year = await trendOf(user, { range: 'year' });

    expect(pointOf(march.body, '2026-03-01').rates.TONE_WRONG).toBeNull();
    expect(pointOf(year.body, '2026-02').rates.TONE_WRONG).toBe(10);
  });

  it('shows the period that holds a day when date is given, as the WPM chart does', async () => {
    const user = await createUser({});
    await session(user, '2026-01-15T03:00:00.000Z', { TONE_WRONG: [2, 8] });

    const { body } = await trendOf(user, { range: 'year', date: '2026-01-20' });

    // January to December of 2026, without the months that have not started.
    expect(body.points.map((point: { key: string }) => point.key)).toEqual(['2026-01', '2026-02', '2026-03']);
    expect(pointOf(body, '2026-01').rates.TONE_WRONG).toBe(25);
  });

  it('rejects an unknown range, a bad date and a bad language with 400', async () => {
    const user = await createUser({});

    expect((await trendOf(user, { range: 'decade' })).status).toBe(400);
    expect((await trendOf(user, { date: '2026-02-30' })).status).toBe(400);
    expect((await trendOf(user, { language: 'fr' })).status).toBe(400);
  });

  it('sends nothing but the periods, the types and their rates', async () => {
    const user = await createUser({});
    await session(user, '2026-03-02T03:00:00.000Z', { TONE_WRONG: [1, 10] });

    const { body } = await trendOf(user, { range: 'week' });

    expect(Object.keys(body).sort()).toEqual(['language', 'points', 'range', 'types']);
    expect(JSON.stringify(body)).not.toContain('@');
  });
});
