/**
 * Creates ready-to-use demo accounts, and typing sessions for `demo@example.com` (a placement test and practice sessions over
 * the last months, for the charts and the error profile of the profile page). Safe to run many times: existing accounts are
 * left untouched and the sessions are made once (demo sessions seeded before the error profile get its counts). Run with
 * `npm run seed`.
 */
import mongoose from 'mongoose';
import { connectDb } from '../config/db';
import { env } from '../config/env';
import { ErrorCounts, TypingSessionModel } from '../models/typing-session.model';
import { UserModel } from '../models/user.model';
import { recordCountedSession, usableTimeZone } from '../services/daily-progress.service';
import { addMonths } from '../services/monthly-progress.service';
import { hashPassword } from '../utils/hash';
import { addDays, localDateKey } from '../utils/local-date';
import { WordError } from '../utils/vietnamese-errors';

export const DEMO_ACCOUNTS = [
  { email: 'demo@example.com', password: 'demo1234', displayName: 'Demo User', role: 'user' },
  { email: 'admin@example.com', password: 'admin1234', displayName: 'Demo Admin', role: 'admin' }
] as const;

/** Extra regular accounts so the admin user table has enough rows to search and paginate. */
export const DEMO_STUDENTS = Array.from({ length: 12 }, (_, index) => {
  const number = String(index + 1).padStart(2, '0');
  return {
    email: `student${number}@example.com`,
    password: 'student1234',
    displayName: `Student ${number}`,
    role: 'user',
    // A few unverified accounts make the "verified" filter visible in the demo.
    isEmailVerified: index % 4 !== 3
  } as const;
});

export const seedDemoAccounts = async () => {
  const created: string[] = [];
  const accounts = [...DEMO_ACCOUNTS.map((account) => ({ ...account, isEmailVerified: true })), ...DEMO_STUDENTS];
  for (const account of accounts) {
    const exists = await UserModel.exists({ email: account.email });
    if (exists) continue;

    await UserModel.create({
      email: account.email,
      password: await hashPassword(account.password),
      displayName: account.displayName,
      role: account.role,
      isEmailVerified: account.isEmailVerified
    });
    created.push(account.email);
  }
  return created;
};

/** Marks the sessions of the seed (`passageId`): a learner who has any is not seeded again. */
export const DEMO_SESSION_PASSAGE_ID = 'demo-seed';

/** [months before the current one (0 = this month), day of the month, WPM, errors]. The placement test is the first one. Months 6 and 3 ago have none: the chart keeps the figures of the month before. */
const DEMO_MONTHS: readonly (readonly [number, number, number, number])[] = [
  [8, 12, 28, 14],
  [8, 20, 31, 12],
  [7, 5, 33, 11],
  [7, 19, 35, 10],
  [5, 8, 38, 9],
  [4, 3, 40, 8],
  [4, 22, 43, 7],
  [2, 10, 47, 6],
  [2, 24, 49, 5],
  [1, 6, 51, 5],
  [1, 18, 54, 4]
];

/** [days before today, WPM, errors]: the last days, for the week and the month of the chart. */
const DEMO_RECENT_DAYS: readonly (readonly [number, number, number])[] = [
  [6, 54, 4],
  [5, 55, 4],
  [3, 57, 3],
  [3, 59, 2],
  [1, 58, 3],
  [0, 61, 2]
];

/**
 * How many chances of each error type a word of the starter passages gives (`tagWord` over the 20 passages: every word a
 * letter and a tone, half of them a vowel mark, about one in five hỏi or ngã, one in nine đ).
 */
const DEMO_CHANCES_PER_WORD: ErrorCounts = {
  BASE_LETTER: 1,
  D_MISSING: 0.11,
  MARK_WRONG: 0.5,
  TONE_WRONG: 1,
  HOI_NGA_CONFUSION: 0.18
};

/** The demo learner's weak point, getting better: hỏi and ngã mixed up in 2 of 5 chances while slow, under 1 in 5 from 45 WPM on. */
const demoHoiNgaRate = (wpm: number) => (wpm < 45 ? 0.4 : 0.17);

/**
 * The error counts of a demo session at `wpm` WPM (one minute, so `wpm` words) with `errors` errors (SCRUM-27): the chances in
 * the shares of the starter passages, the hỏi/ngã errors first (`demoHoiNgaRate`), the rest shared by tone, vowel mark, đ
 * and letter (4:3:1:2). The demo learner's error profile then has hỏi/ngã weak and improving, and the other types ok.
 */
export const demoErrorCounts = (wpm: number, errors: number) => {
  const opportunityCounts = Object.fromEntries(
    Object.values(WordError).map((type) => [type, Math.round(wpm * DEMO_CHANCES_PER_WORD[type])])
  ) as ErrorCounts;
  const hoiNga = Math.min(errors, Math.round(opportunityCounts.HOI_NGA_CONFUSION * demoHoiNgaRate(wpm)));
  const rest = errors - hoiNga;
  const tone = Math.round(rest * 0.4);
  const mark = Math.round(rest * 0.3);
  const dMissing = Math.round(rest * 0.1);
  const errorCounts: ErrorCounts = {
    BASE_LETTER: rest - tone - mark - dMissing,
    D_MISSING: dMissing,
    MARK_WRONG: mark,
    TONE_WRONG: tone,
    HOI_NGA_CONFUSION: hoiNga
  };
  return { errorCounts, opportunityCounts };
};

/**
 * Gives `demo@example.com` a counted placement test 8 months ago and counted practice sessions since, getting faster and cleaner,
 * with two months without a session and sessions on the last days: every range of the profile chart (a year, a month, a week)
 * shows something, with a month that keeps the figures of the one before. The days are the learner's own (their time zone) and
 * count for their streak and heatmap. Each session has errors and chances of every type (`demoErrorCounts`), for the error
 * profile. Does nothing when the learner already has the sessions. Answers how many it made.
 */
export const seedDemoSessions = async (now = new Date()) => {
  const user = await UserModel.findOne({ email: DEMO_ACCOUNTS[0].email });
  if (!user) return 0;
  if (await TypingSessionModel.exists({ owner: user._id, passageId: DEMO_SESSION_PASSAGE_ID })) return 0;

  const today = localDateKey(now, usableTimeZone(user.settings?.timezone));
  const plan = [
    ...DEMO_MONTHS.map(([monthsAgo, day, wpm, errors], index) => ({
      day: `${addMonths(today.slice(0, 7), -monthsAgo)}-${String(day).padStart(2, '0')}`,
      mode: index === 0 ? ('placement' as const) : ('practice' as const),
      wpm,
      errors
    })),
    ...DEMO_RECENT_DAYS.map(([daysAgo, wpm, errors]) => ({ day: addDays(today, -daysAgo), mode: 'practice' as const, wpm, errors }))
  ];

  for (const { day, mode, wpm, errors } of plan) {
    // 10:00 in Vietnam; never later than now, so no session is in the future.
    const completedAt = new Date(Math.min(new Date(`${day}T03:00:00.000Z`).getTime(), now.getTime()));
    await TypingSessionModel.create({
      owner: user._id,
      mode,
      passageId: DEMO_SESSION_PASSAGE_ID,
      passageTitle: mode === 'placement' ? 'Demo placement test' : 'Demo practice',
      targetWords: Array.from({ length: wpm }, () => 'từ'),
      status: 'completed',
      startedAt: new Date(completedAt.getTime() - 60_000),
      completedAt,
      durationMs: 60_000,
      timeLimitSeconds: 60,
      wpm,
      accuracy: Math.max(80, Math.round((100 - errors * 1.2) * 10) / 10),
      ...demoErrorCounts(wpm, errors),
      isCounted: true
    });
    await recordCountedSession(user._id, completedAt);
  }
  return plan.length;
};

/**
 * Gives the demo sessions seeded before the error profile (SCRUM-27: no chances, every error a BASE_LETTER) the counts of
 * `demoErrorCounts`, from their WPM and their errors, so the error profile of a database seeded earlier shows something
 * too. Answers how many it changed; a session is changed once.
 */
export const fillDemoErrorCounts = async () => {
  const sessions = await TypingSessionModel.find({ passageId: DEMO_SESSION_PASSAGE_ID, opportunityCounts: { $exists: false } })
    .select('wpm errorCounts')
    .lean();
  for (const session of sessions) {
    const errors = Object.values(session.errorCounts ?? {}).reduce((sum, count) => sum + (count ?? 0), 0);
    await TypingSessionModel.updateOne(
      { _id: session._id, opportunityCounts: { $exists: false } },
      { $set: demoErrorCounts(session.wpm ?? 0, errors) }
    );
  }
  return sessions.length;
};

const run = async () => {
  // The demo admin has a public password: never create it on a real deployment.
  if (env.nodeEnv === 'production') throw new Error('Refusing to seed demo accounts when NODE_ENV=production.');
  await connectDb();
  const created = await seedDemoAccounts();
  const sessions = await seedDemoSessions();
  const filled = await fillDemoErrorCounts();
  console.log(created.length ? `Created: ${created.join(', ')}` : 'Demo accounts already exist.');
  console.log(sessions ? `Created ${sessions} typing sessions for ${DEMO_ACCOUNTS[0].email} (placement test and practice).` : 'Demo typing sessions already exist.');
  if (filled) console.log(`Added the error counts of the error profile to ${filled} demo sessions seeded before it.`);
  for (const account of DEMO_ACCOUNTS) console.log(`  ${account.email} / ${account.password}`);
  console.log(`  + ${DEMO_STUDENTS.length} students: student01..${DEMO_STUDENTS.length}@example.com / student1234`);
  await mongoose.disconnect();
};

if (require.main === module) {
  run().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
