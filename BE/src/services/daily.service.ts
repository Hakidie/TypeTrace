import { DEFAULT_AVATAR } from '../data/avatar-catalog';
import { DailyChallengeModel, DailyEntryDocument, DailyEntryModel } from '../models/daily.model';
import { notEnglish } from '../models/passage.model';
import { TypingSessionModel } from '../models/typing-session.model';
import { UserModel } from '../models/user.model';
import { conflict, notFound } from '../utils/app-error';
import { ANONYMOUS_PLAYER_NAME } from './match.service';
import { samplePassage } from './passage.service';
import { vietnamDayStart } from './rating.service';

/** Tries a learner gets each day, and how long one lasts (the same for everyone, so the scores compare). */
export const DAILY_TRIES = 3;
export const DAILY_SECONDS = 60;
/** How many words of the passage the challenge card shows. */
const PREVIEW_WORDS = 12;
const DAY_MS = 24 * 60 * 60 * 1000;
const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;

/** The day of `now` in Vietnam time, as `YYYY-MM-DD` (the days of the challenge change at 0:00 there). */
export const dayKey = (now = Date.now()) => new Date(vietnamDayStart(now).getTime() + VIETNAM_OFFSET_MS).toISOString().slice(0, 10);
const dayBefore = (date: string) => new Date(Date.parse(date) - DAY_MS).toISOString().slice(0, 10);

/**
 * The passage of `date`. The first request of the day picks a random public practice passage and stores a copy of it;
 * `$setOnInsert` keeps the first pick when two requests do it at once.
 */
const challengeOf = async (date: string) => {
  const stored = await DailyChallengeModel.findOne({ date });
  if (stored) return stored;
  const passage = await samplePassage<{ _id: string; title: string; content: string }>(
    { visibility: 'public', isPlacement: false, ...notEnglish },
    { title: 1, content: 1 }
  );
  if (!passage) throw notFound('No daily challenge today');
  return DailyChallengeModel.findOneAndUpdate(
    { date },
    { $setOnInsert: { date, passageId: String(passage._id), passageTitle: passage.title, words: passage.content.split(/\s+/).filter(Boolean) } },
    { upsert: true, new: true }
  ).orFail();
};

/** Where a counted entry stands on its day: the ones with a higher score, or the same score reached earlier, are above. */
const rankOf = async (entry: DailyEntryDocument) =>
  (await DailyEntryModel.countDocuments({
    date: entry.date,
    counted: true,
    $or: [{ bestScore: { $gt: entry.bestScore } }, { bestScore: entry.bestScore, bestAt: { $lt: entry.bestAt } }]
  })) + 1;

/** Name and avatar of players, never their email (`.lean()` skips `toJSON`, so only these fields are read). */
export const publicPlayers = async (userIds: unknown[]) => {
  const users = await UserModel.find({ _id: { $in: userIds } }).select('displayName avatar').lean();
  const byId = new Map(users.map((user) => [String(user._id), user]));
  return (id: unknown) => {
    const user = byId.get(String(id));
    return { displayName: user?.displayName?.trim() || ANONYMOUS_PLAYER_NAME, avatar: user?.avatar ?? DEFAULT_AVATAR };
  };
};

const winnerOf = async (date: string) => {
  const [top] = await DailyEntryModel.find({ date, counted: true }).sort({ bestScore: -1, bestAt: 1 }).limit(1);
  if (!top) return null;
  const playerOf = await publicPlayers([top.user]);
  return { ...playerOf(top.user), score: top.bestScore };
};

/** The challenge card: today's passage, the learner's tries, best, rank, streak and coins, and yesterday's winner. */
export const getToday = async (userId: string) => {
  const date = dayKey();
  const challenge = await challengeOf(date);
  const [entry, yesterday] = await Promise.all([
    DailyEntryModel.findOne({ user: userId, date }),
    DailyEntryModel.findOne({ user: userId, date: dayBefore(date) })
  ]);
  const counted = entry?.counted ?? false;
  return {
    date,
    passageTitle: challenge.passageTitle,
    preview: challenge.words.slice(0, PREVIEW_WORDS).join(' '),
    seconds: DAILY_SECONDS,
    triesLeft: Math.max(0, DAILY_TRIES - (entry?.tries ?? 0)),
    best: counted ? { score: entry!.bestScore, wpm: entry!.bestWpm, accuracy: entry!.bestAccuracy } : null,
    rank: counted ? await rankOf(entry!) : null,
    // Without a counted try today the streak of yesterday still stands until the day ends.
    streak: counted ? entry!.streak : yesterday?.counted ? yesterday.streak : 0,
    coins: entry?.coins ?? 0,
    lastTry: entry?.lastTry ?? null,
    endsAt: new Date(vietnamDayStart().getTime() + DAY_MS).toISOString(),
    yesterdayWinner: await winnerOf(dayBefore(date))
  };
};

/** Starts a try on today's passage: a typing session in `daily` mode. A try counts as soon as it starts. */
export const startTry = async (userId: string) => {
  const date = dayKey();
  const challenge = await challengeOf(date);
  try {
    // One conditional update, so two tries started at once cannot both pass the limit.
    await DailyEntryModel.updateOne({ user: userId, date, tries: { $lt: DAILY_TRIES } }, { $inc: { tries: 1 } }, { upsert: true });
  } catch (error) {
    // With all the tries used the filter matches nothing and the upsert hits the unique `{ user, date }` index.
    if ((error as { code?: number }).code === 11000) throw conflict('No tries left today');
    throw error;
  }
  await TypingSessionModel.updateMany({ owner: userId, status: 'in_progress' }, { status: 'abandoned' });
  return TypingSessionModel.create({
    owner: userId,
    mode: 'daily',
    dailyDate: date,
    passageId: challenge.passageId,
    passageTitle: challenge.passageTitle,
    targetWords: challenge.words
  });
};
