import { QueryFilter, Types } from 'mongoose';
import { notEnglish, PassageModel, splitWords } from '../models/passage.model';
import { ErrorCounts, SessionWord, TypingSessionDocument, TypingSessionModel } from '../models/typing-session.model';
import { badRequest, conflict, notFound } from '../utils/app-error';
import { paginate } from '../utils/pagination';
import { titleSearchPattern } from '../utils/passage-text';
import { classifyWord, tagWord, WordError, WordErrorType } from '../utils/vietnamese-errors';
import { CompleteSessionInput, CreateSessionInput, ListSessionsQuery } from '../validators/typing-session.validator';
import { recordTry } from './daily.service';
import { learnerPassageFilter, samplePassage } from './passage.service';

/** Sessions with fewer words, or faster than this, are saved but kept out of the error profile (ASSUMPTION). */
export const MIN_COUNTED_WORDS = 20;
export const MAX_COUNTED_WPM = 200;
/** A session lasts at most 3 minutes. The page stops the clock and sends what was typed; the server does not trust it. */
export const MAX_SESSION_MS = 3 * 60 * 1000;
/** Time allowed for the request to arrive after the page stopped the clock. */
export const SESSION_GRACE_MS = 5000;

/** A session belongs to one learner: another user's session answers 404, even for admins. */
const ownedBy = (userId: string, id?: string) => ({ ...(id ? { _id: id } : {}), owner: userId });

const emptyCounts = (): ErrorCounts =>
  Object.fromEntries(Object.values(WordError).map((type) => [type, 0])) as ErrorCounts;

const round1 = (value: number) => Math.round(value * 10) / 10;

/** Grades typed words against the target words at the same position. Extra words are rejected by the caller. */
export const gradeWords = (targetWords: string[], typedWords: string[], typedAtMs?: number[]): SessionWord[] =>
  typedWords.map((typed, index) => ({
    index,
    target: targetWords[index],
    typed,
    errorTypes: classifyWord(targetWords[index], typed),
    ...(typedAtMs && { typedAtMs: typedAtMs[index] })
  }));

/** Counts how often each error happened and how often it could have happened. */
export const countErrors = (words: SessionWord[]) => {
  const errorCounts = emptyCounts();
  const opportunityCounts = emptyCounts();
  for (const word of words) {
    word.errorTypes.forEach((type: WordErrorType) => (errorCounts[type] += 1));
    tagWord(word.target).forEach((type) => (opportunityCounts[type] += 1));
  }
  return { errorCounts, opportunityCounts };
};

/** WPM = correct words per minute (ASSUMPTION). A minimum of one second keeps instant submissions finite. */
export const computeWpm = (correctWords: number, durationMs: number) =>
  round1(correctWords / (Math.max(durationMs, 1000) / 60000));

/** A session that ran past the time limit (plus the grace) is saved but not counted: its words cannot be trusted. */
export const isSessionCounted = (wordCount: number, wpm: number, durationMs = 0) =>
  wordCount >= MIN_COUNTED_WORDS && wpm <= MAX_COUNTED_WPM && durationMs <= MAX_SESSION_MS + SESSION_GRACE_MS;

/**
 * The passage a session types. With a `passageId` it is that passage, if it belongs to the mode (see `learnerPassageFilter`); for the placement test it is a random
 * placement passage; otherwise it is a random public practice passage. Only published passages are used.
 */
type PickedPassage = { _id: Types.ObjectId; title: string; content: string };
const pickedFields = { title: 1, content: 1 } as const;

const pickPassage = async (userId: string, { mode, passageId }: CreateSessionInput) => {
  if (passageId) {
    const passage = await PassageModel.findOne({ _id: passageId, ...learnerPassageFilter(userId, mode) });
    if (!passage) throw badRequest('Unknown passage');
    return passage;
  }
  if (mode === 'placement') {
    const placement = await samplePassage<PickedPassage>({ isPlacement: true, ...notEnglish }, pickedFields);
    if (!placement) throw notFound('No placement passage');
    return placement;
  }
  const random = await samplePassage<PickedPassage>({ visibility: 'public', isPlacement: false, ...notEnglish }, pickedFields);
  if (!random) throw notFound('No passage available');
  return random;
};

/** Starts a session. A session the learner left in progress becomes `abandoned`. */
export const startSession = async (userId: string, input: CreateSessionInput) => {
  const passage = await pickPassage(userId, input);

  await TypingSessionModel.updateMany({ owner: userId, status: 'in_progress' }, { status: 'abandoned' });
  return TypingSessionModel.create({
    owner: userId,
    mode: input.mode,
    passageId: String(passage._id),
    passageTitle: passage.title,
    targetWords: splitWords(passage.content)
  });
};

export const getSession = async (userId: string, id: string) => {
  const session = await TypingSessionModel.findOne(ownedBy(userId, id));
  if (!session) throw notFound('Session not found');
  return session;
};

/** What a card of the history shows. `words` is read only to draw the speed line; it is not sent (`targetWords` is not read at all). */
const LIST_FIELDS = 'mode passageTitle status wpm accuracy durationMs timeLimitSeconds isCounted startedAt completedAt createdAt words';

/** The learner's sessions, each with its speed `timeline` (as in the stats) instead of its words. */
export const listSessions = async (userId: string, { status, q, mode, timeLimitSeconds, ...pagination }: ListSessionsQuery) => {
  const filter: QueryFilter<TypingSessionDocument> = { owner: userId };
  if (status) filter.status = status;
  if (q) filter.passageTitle = titleSearchPattern(q);
  if (mode) filter.mode = mode;
  if (timeLimitSeconds) filter.timeLimitSeconds = timeLimitSeconds;
  const page = await paginate(TypingSessionModel, filter, pagination, { select: LIST_FIELDS });
  return {
    ...page,
    items: page.items.map((session) => {
      const { words, ...summary } = session.toJSON();
      return { ...summary, timeline: timelineStatus(words, session.durationMs ?? 0) };
    })
  };
};

/** The learner pressed the first key: the clock starts now. Calling it again keeps the first time. */
export const beginSession = async (userId: string, id: string) => {
  const session = await getSession(userId, id);
  if (session.status !== 'in_progress') throw conflict('Session is not in progress');
  if (!session.beganAt) {
    session.beganAt = new Date();
    await session.save();
  }
  return session;
};

/**
 * The times the page sent for each finished word must rise, and none may be later than the session: the server measured
 * `durationMs` from the `begin` request, which reaches it a little after the first key, so the grace of a slow request is allowed.
 */
const assertValidTimes = (typedAtMs: number[], durationMs: number) => {
  const rising = typedAtMs.every((time, index) => index === 0 || time >= typedAtMs[index - 1]);
  if (!rising) throw badRequest('Word times must not go back');
  if (typedAtMs.some((time) => time > durationMs + SESSION_GRACE_MS)) throw badRequest('A word time is after the end of the session');
};

/** Re-grades the typed words and stores WPM, accuracy and error counts. Anything else the client says is ignored. */
export const completeSession = async (userId: string, id: string, { typedWords, typedAtMs, timeLimitSeconds }: CompleteSessionInput) => {
  const session = await getSession(userId, id);
  if (session.status !== 'in_progress') throw conflict('Session is not in progress');
  if (typedWords.length > session.targetWords.length) throw badRequest('More words than the passage has');

  const now = new Date();
  const elapsedMs = now.getTime() - (session.beganAt ?? session.startedAt).getTime();
  // Within the grace the learner finished on time (the request was only slow): the clock stops at the limit.
  const durationMs = elapsedMs <= MAX_SESSION_MS + SESSION_GRACE_MS ? Math.min(elapsedMs, MAX_SESSION_MS) : elapsedMs;
  if (typedAtMs) assertValidTimes(typedAtMs, durationMs);
  const words = gradeWords(session.targetWords, typedWords, typedAtMs);
  const correctWords = words.filter((word) => word.errorTypes.length === 0).length;
  const wpm = computeWpm(correctWords, durationMs);

  session.set({
    status: 'completed',
    words,
    completedAt: now,
    timeLimitSeconds,
    durationMs,
    wpm,
    accuracy: round1((correctWords / words.length) * 100),
    ...countErrors(words),
    isCounted: isSessionCounted(words.length, wpm, elapsedMs)
  });
  const saved = await session.save();
  // A try of the daily challenge also updates the learner's day: best score, streak and coins.
  if (saved.mode === 'daily') await recordTry(saved);
  return saved;
};

/** The line chart takes one point every second, and a session shorter than 10 seconds is too short to draw. */
export const TIMELINE_STEP_SECONDS = 1;
export const MIN_TIMELINE_MS = 10_000;
/** Each point looks at the words finished in the last 10 seconds: a 1 second window only shows 0, 60 or 120 WPM, and a 5 second one moves in steps of 12 WPM per word, which draws flat stretches. */
export const TIMELINE_WINDOW_SECONDS = 10;

export interface TimelinePoint {
  second: number;
  wpm: number;
  /** Wrong words among the words finished in the window. */
  errors: number;
}

/**
 * WPM and error rate at every second and at the end of the session, over a sliding window: only the words finished in the
 * last `TIMELINE_WINDOW_SECONDS` count (fewer at the start, where the window is cut at 0). WPM is correct words per minute
 * of the window (`computeWpm`), the number of errors is the wrong words among them. So it shows the
 * pace at that moment, not the average since the start. A time after the end counts as the end.
 */
export const timelineOf = (words: SessionWord[], durationMs: number): TimelinePoint[] => {
  const windowMs = TIMELINE_WINDOW_SECONDS * 1000;
  const marks = [...Array(Math.ceil(durationMs / 1000 / TIMELINE_STEP_SECONDS)).keys()]
    .map((step) => (step + 1) * TIMELINE_STEP_SECONDS * 1000)
    .filter((ms) => ms < durationMs);
  return [...marks, durationMs].map((ms) => {
    const finished = words.filter((word) => {
      const time = Math.min(word.typedAtMs ?? 0, durationMs);
      return time <= ms && time > ms - windowMs;
    });
    const wrong = finished.filter((word) => word.errorTypes.length > 0).length;
    return {
      second: round1(ms / 1000),
      wpm: computeWpm(finished.length - wrong, Math.min(ms, windowMs)),
      errors: wrong
    };
  });
};

/** The numbers behind the result charts (SCRUM-186). Worked out again from the graded words: no stored total is trusted. */
export const getSessionStats = async (userId: string, id: string) => {
  const session = await getSession(userId, id);
  if (session.status !== 'completed') throw conflict('Session is not completed');

  const totalWords = session.words.length;
  const wrongWords = session.words.filter((word) => word.errorTypes.length > 0).length;
  const { errorCounts, opportunityCounts } = countErrors(session.words);
  return {
    totalWords,
    correctWords: totalWords - wrongWords,
    wrongWords,
    wrongRate: totalWords === 0 ? 0 : round1((wrongWords / totalWords) * 100),
    /** Types that never had a chance in this passage are left out. */
    errorTypes: Object.values(WordError)
      .filter((type) => opportunityCounts[type] > 0)
      .map((type) => ({
        type,
        errors: errorCounts[type],
        opportunities: opportunityCounts[type],
        rate: round1((errorCounts[type] / opportunityCounts[type]) * 100)
      })),
    isCounted: session.isCounted,
    /** The time the learner chose (3 minutes for an older session): the time axis of the speed chart ends here. */
    timeLimitSeconds: session.timeLimitSeconds ?? MAX_SESSION_MS / 1000,
    timeline: timelineStatus(session.words, session.durationMs ?? 0)
  };
};

/** `no_data`: an older session without word times; `too_short`: under 10 seconds; otherwise `ok` with the points. */
const timelineStatus = (words: SessionWord[], durationMs: number) => {
  if (words.length === 0 || words.some((word) => word.typedAtMs === undefined)) return { status: 'no_data', points: [] };
  if (durationMs < MIN_TIMELINE_MS) return { status: 'too_short', points: [] };
  return { status: 'ok', points: timelineOf(words, durationMs) };
};

export const abandonSession = async (userId: string, id: string) => {
  const session = await getSession(userId, id);
  if (session.status !== 'in_progress') throw conflict('Session is not in progress');
  session.status = 'abandoned';
  return session.save();
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days of the activity heatmaps, in the admin user list and on the profile page (the frontend draws as many cells). */
export const HEATMAP_DAYS = 371;

/**
 * Typing activity of each of `owners`, in two queries for all of them: `stats`, the average speed and accuracy of their
 * completed sessions (absent until one is completed), and `sessions`, their completed sessions per UTC day of the last
 * `HEATMAP_DAYS` days. Returns the activity of one owner.
 */
export const typingActivityOf = async (owners: unknown[]) => {
  const since = new Date(Date.now() - HEATMAP_DAYS * DAY_MS);
  const [averages, days] = await Promise.all([
    TypingSessionModel.aggregate<{ _id: unknown; wpm: number; accuracy: number }>([
      { $match: { owner: { $in: owners }, status: 'completed', wpm: { $exists: true } } },
      { $group: { _id: '$owner', wpm: { $avg: '$wpm' }, accuracy: { $avg: '$accuracy' } } }
    ]),
    TypingSessionModel.aggregate<{ _id: { owner: unknown; date: string }; sessions: number }>([
      { $match: { owner: { $in: owners }, status: 'completed', completedAt: { $gte: since } } },
      {
        $group: {
          _id: { owner: '$owner', date: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt' } } },
          sessions: { $sum: 1 }
        }
      }
    ])
  ]);
  return (owner: unknown) => {
    const id = String(owner);
    const average = averages.find((row) => String(row._id) === id);
    return {
      ...(average && { stats: { wpm: round1(average.wpm), accuracy: round1(average.accuracy) } }),
      sessions: days.filter((row) => String(row._id.owner) === id).map((row) => ({ date: row._id.date, sessions: row.sessions }))
    };
  };
};

/** The learner's own typing activity, for their profile page (SCRUM-157): the same as their row in the admin user list. */
export const getOwnActivity = async (userId: string) => {
  const owner = new Types.ObjectId(userId);
  return (await typingActivityOf([owner]))(owner);
};
