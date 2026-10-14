import { defaultPassageId, findPassage } from '../config/passages';
import { ErrorCounts, SessionWord, TypingSessionModel } from '../models/typing-session.model';
import { badRequest, conflict, notFound } from '../utils/app-error';
import { paginate } from '../utils/pagination';
import { classifyWord, tagWord, WordError, WordErrorType } from '../utils/vietnamese-errors';
import { CompleteSessionInput, CreateSessionInput, ListSessionsQuery } from '../validators/typing-session.validator';

/** Sessions with fewer words, or faster than this, are saved but kept out of the error profile (ASSUMPTION). */
export const MIN_COUNTED_WORDS = 20;
export const MAX_COUNTED_WPM = 200;

/** A session belongs to one learner: another user's session answers 404, even for admins. */
const ownedBy = (userId: string, id?: string) => ({ ...(id ? { _id: id } : {}), owner: userId });

const emptyCounts = (): ErrorCounts =>
  Object.fromEntries(Object.values(WordError).map((type) => [type, 0])) as ErrorCounts;

const round1 = (value: number) => Math.round(value * 10) / 10;

/** Grades typed words against the target words at the same position. Extra words are rejected by the caller. */
export const gradeWords = (targetWords: string[], typedWords: string[]): SessionWord[] =>
  typedWords.map((typed, index) => ({
    index,
    target: targetWords[index],
    typed,
    errorTypes: classifyWord(targetWords[index], typed)
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

export const isSessionCounted = (wordCount: number, wpm: number) =>
  wordCount >= MIN_COUNTED_WORDS && wpm <= MAX_COUNTED_WPM;

/** Starts a session. A session the learner left in progress becomes `abandoned`. */
export const startSession = async (userId: string, { mode, passageId }: CreateSessionInput) => {
  const passage = findPassage(passageId ?? defaultPassageId);
  if (!passage) throw badRequest('Unknown passage');

  await TypingSessionModel.updateMany({ owner: userId, status: 'in_progress' }, { status: 'abandoned' });
  return TypingSessionModel.create({
    owner: userId,
    mode,
    passageId: passage.id,
    targetWords: passage.text.split(/\s+/).filter(Boolean)
  });
};

export const getSession = async (userId: string, id: string) => {
  const session = await TypingSessionModel.findOne(ownedBy(userId, id));
  if (!session) throw notFound('Session not found');
  return session;
};

export const listSessions = (userId: string, { status, ...pagination }: ListSessionsQuery) =>
  paginate(TypingSessionModel, { owner: userId, ...(status ? { status } : {}) }, pagination);

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

/** Re-grades the typed words and stores WPM, accuracy and error counts. Anything else the client says is ignored. */
export const completeSession = async (userId: string, id: string, { typedWords }: CompleteSessionInput) => {
  const session = await getSession(userId, id);
  if (session.status !== 'in_progress') throw conflict('Session is not in progress');
  if (typedWords.length > session.targetWords.length) throw badRequest('More words than the passage has');

  const now = new Date();
  const durationMs = now.getTime() - (session.beganAt ?? session.startedAt).getTime();
  const words = gradeWords(session.targetWords, typedWords);
  const correctWords = words.filter((word) => word.errorTypes.length === 0).length;
  const wpm = computeWpm(correctWords, durationMs);

  session.set({
    status: 'completed',
    words,
    completedAt: now,
    durationMs,
    wpm,
    accuracy: round1((correctWords / words.length) * 100),
    ...countErrors(words),
    isCounted: isSessionCounted(words.length, wpm)
  });
  return session.save();
};

export const abandonSession = async (userId: string, id: string) => {
  const session = await getSession(userId, id);
  if (session.status !== 'in_progress') throw conflict('Session is not in progress');
  session.status = 'abandoned';
  return session.save();
};
