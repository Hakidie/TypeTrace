import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DailyProgressModel } from '../../src/models/daily-progress.model';
import { TypingSessionModel } from '../../src/models/typing-session.model';
import { UserModel } from '../../src/models/user.model';
import {
  DEMO_ACCOUNTS,
  DEMO_SESSION_PASSAGE_ID,
  DEMO_STUDENTS,
  demoErrorCounts,
  fillDemoErrorCounts,
  seedDemoAccounts,
  seedDemoSessions
} from '../../src/scripts/seed';
import { getErrorProfile } from '../../src/services/error-profile.service';
import { getMonthlyProgress } from '../../src/services/monthly-progress.service';
import { getCurrentSubscription } from '../../src/services/subscription.service';
import { comparePassword } from '../../src/utils/hash';
import { WordError } from '../../src/utils/vietnamese-errors';

describe('seedDemoAccounts plans', () => {
  it('makes student01 premium for a month and everyone else free', async () => {
    await seedDemoAccounts();

    const premium = await getCurrentSubscription(String((await UserModel.findOne({ email: 'student01@example.com' }))!._id));
    expect(premium.plan).toBe('premium');
    expect(premium.expiresAt!.getTime()).toBeGreaterThan(Date.now());
    for (const email of ['demo@example.com', 'admin@example.com', 'student02@example.com']) {
      expect((await getCurrentSubscription(String((await UserModel.findOne({ email }))!._id))).plan).toBe('free');
    }
  });

  it('does not give premium again when the accounts already exist', async () => {
    await seedDemoAccounts();
    await seedDemoAccounts();

    const student = (await UserModel.findOne({ email: 'student01@example.com' }))!;
    const { SubscriptionModel } = await import('../../src/models/subscription.model');
    expect(await SubscriptionModel.countDocuments({ user: student._id, plan: 'premium' })).toBe(1);
  });
});

describe('seedDemoAccounts', () => {
  it('creates verified demo accounts with the documented passwords', async () => {
    const created = await seedDemoAccounts();
    expect(created).toEqual([...DEMO_ACCOUNTS, ...DEMO_STUDENTS].map((account) => account.email));

    for (const account of DEMO_ACCOUNTS) {
      const user = await UserModel.findOne({ email: account.email });
      expect(user?.isEmailVerified).toBe(true);
      expect(await comparePassword(account.password, user!.password)).toBe(true);
    }
  });

  it('adds sample students, some unverified, all with the documented password', async () => {
    await seedDemoAccounts();
    const students = await UserModel.find({ email: /^student/ });
    expect(students).toHaveLength(DEMO_STUDENTS.length);
    expect(students.some((student) => !student.isEmailVerified)).toBe(true);
    expect(await comparePassword('student1234', students[0].password)).toBe(true);
  });

  it('is idempotent', async () => {
    await seedDemoAccounts();
    expect(await seedDemoAccounts()).toEqual([]);
    expect(await UserModel.countDocuments()).toBe(DEMO_ACCOUNTS.length + DEMO_STUDENTS.length);
  });
});

describe('seedDemoSessions', () => {
  // Today is fixed: 10 March 2026, 15:00 in Vietnam.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-03-10T08:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const demoId = async () => (await UserModel.findOne({ email: 'demo@example.com' }))!._id;

  it('does nothing without the demo account', async () => {
    expect(await seedDemoSessions()).toBe(0);
  });

  it('gives only the demo account counted sessions, the first one a placement test 8 months ago', async () => {
    await seedDemoAccounts();

    const made = await seedDemoSessions();

    expect(made).toBeGreaterThan(10);
    expect(await TypingSessionModel.countDocuments()).toBe(made);
    const sessions = await TypingSessionModel.find({ owner: await demoId() }).sort({ completedAt: 1 });
    expect(sessions).toHaveLength(made);
    expect(sessions.every((session) => session.isCounted && session.status === 'completed')).toBe(true);
    expect(sessions[0]).toMatchObject({ mode: 'placement' });
    expect(sessions[0].completedAt?.toISOString().slice(0, 7)).toBe('2025-07');
    expect(sessions.filter((session) => session.mode === 'placement')).toHaveLength(1);
    expect(sessions.every((session) => session.completedAt! <= new Date())).toBe(true);
  });

  it('is made once', async () => {
    await seedDemoAccounts();
    const made = await seedDemoSessions();

    expect(await seedDemoSessions()).toBe(0);
    expect(await TypingSessionModel.countDocuments()).toBe(made);
  });

  it('counts the sessions for the days of the demo learner (streak and heatmap)', async () => {
    await seedDemoAccounts();
    await seedDemoSessions();

    const today = await DailyProgressModel.findOne({ owner: await demoId(), date: '2026-03-10' });
    expect(today?.sessions).toBe(1);
  });

  it('fills the chart in every range, with months that keep the figures of the month before', async () => {
    await seedDemoAccounts();
    await seedDemoSessions();
    const id = String(await demoId());

    const year = (await getMonthlyProgress(id, 'year')).points;
    expect(year.map((point) => point.key)[0]).toBe('2025-04');
    expect(year.slice(0, 3).map((point) => point.avgWpm)).toEqual([null, null, null]); // before the placement test (July)
    expect(year.find((point) => point.key === '2025-07')).toMatchObject({ avgWpm: 29.5, carriedOver: false }); // the placement test and one practice
    expect(year.filter((point) => point.carriedOver).map((point) => point.key)).toEqual(['2025-09', '2025-12']); // the two months without a session
    expect(year.at(-1)?.avgWpm).toBeGreaterThan(50);

    const month = (await getMonthlyProgress(id, 'month')).points;
    expect(month.some((point) => point.avgWpm !== null)).toBe(true);
    const week = (await getMonthlyProgress(id, 'week')).points;
    expect(week.every((point) => point.avgWpm !== null)).toBe(true);
  });

  it('gives the demo learner an error profile: hỏi/ngã weak and improving, the other types ok (SCRUM-27)', async () => {
    await seedDemoAccounts();
    await seedDemoSessions();

    const profile = await getErrorProfile(String(await demoId()));

    expect(profile.sessionsUsed).toBe(10);
    expect(profile.weakTypes).toEqual(['HOI_NGA_CONFUSION']);
    expect(profile.types.find((item) => item.type === 'HOI_NGA_CONFUSION')).toMatchObject({ level: 'weak', trend: 'improved' });
    expect(profile.types.filter((item) => item.type !== 'HOI_NGA_CONFUSION').every((item) => item.level === 'ok')).toBe(true);
  });

  it('shares the errors of a demo session between the types, never more of a type than its chances', () => {
    for (let wpm = 28; wpm <= 61; wpm += 1) {
      for (let errors = 0; errors <= 14; errors += 1) {
        const { errorCounts, opportunityCounts } = demoErrorCounts(wpm, errors);
        expect(Object.values(errorCounts).reduce((sum, count) => sum + count, 0)).toBe(errors);
        for (const type of Object.values(WordError)) {
          expect(errorCounts[type]).toBeGreaterThanOrEqual(0);
          expect(errorCounts[type]).toBeLessThanOrEqual(opportunityCounts[type]);
        }
      }
    }
  });

  it('adds the error counts to the demo sessions seeded before the error profile, once', async () => {
    await seedDemoAccounts();
    // A demo session in the shape the seed gave before SCRUM-27: every error a BASE_LETTER, no chances.
    const old = await TypingSessionModel.create({
      owner: await demoId(),
      passageId: DEMO_SESSION_PASSAGE_ID,
      targetWords: ['từ'],
      status: 'completed',
      isCounted: true,
      completedAt: new Date(),
      wpm: 47,
      accuracy: 92.8,
      errorCounts: { BASE_LETTER: 6 }
    });

    expect(await fillDemoErrorCounts()).toBe(1);

    expect((await TypingSessionModel.findById(old._id).lean())!).toMatchObject(demoErrorCounts(47, 6));
    expect(await fillDemoErrorCounts()).toBe(0);
  });
});
