import { TypingSessionModel } from '../models/typing-session.model';
import { WordModel } from '../models/word.model';
import { WordError, type WordErrorType } from '../utils/vietnamese-errors';

/** How many words one round of word rain gets, and how many come from the learner's weak spots (half). */
export const RAIN_WORD_COUNT = 80;
/** The learner's error profile is read from this many of their latest counted sessions. */
export const RAIN_RECENT_SESSIONS = 10;
export const RAIN_FOCUS_TAGS = 2;
/** Short enough to read while it falls, long enough to be a word. */
const MIN_LENGTH = 2;
const MAX_LENGTH = 12;

/** The error types the learner made most often in their recent counted sessions, most frequent first. */
const focusFor = async (userId: string): Promise<WordErrorType[]> => {
  const sessions = await TypingSessionModel.find({ owner: userId, status: 'completed', isCounted: true })
    .sort({ completedAt: -1 })
    .limit(RAIN_RECENT_SESSIONS)
    .select({ errorCounts: 1 })
    .lean();
  const totals = Object.values(WordError).map((type) => ({
    type,
    count: sessions.reduce((sum, session) => sum + (session.errorCounts?.[type] ?? 0), 0)
  }));
  return totals
    .filter(({ count }) => count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, RAIN_FOCUS_TAGS)
    .map(({ type }) => type);
};

/** Random active words of a readable length (and carrying one of `tags`, when given). Only the text leaves the server. */
const sampleWords = async (size: number, tags?: WordErrorType[]) => {
  const words = await WordModel.aggregate<{ text: string }>([
    {
      $match: {
        isActive: true,
        ...(tags && { tags: { $in: tags } }),
        $expr: { $and: [{ $gte: [{ $strLenCP: '$text' }, MIN_LENGTH] }, { $lte: [{ $strLenCP: '$text' }, MAX_LENGTH] }] }
      }
    },
    { $sample: { size } },
    { $project: { _id: 0, text: 1 } }
  ]);
  return words.map(({ text }) => text);
};

const shuffle = <T>(items: T[]) => {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
};

/** The words of one round: half from the learner's weak error types (when they have any), the rest at random. */
export const rainWordsFor = async (userId: string) => {
  const focus = await focusFor(userId);
  const focused = focus.length ? await sampleWords(RAIN_WORD_COUNT / 2, focus) : [];
  const others = await sampleWords(RAIN_WORD_COUNT);
  const words = [...new Set([...focused, ...others])].slice(0, RAIN_WORD_COUNT);
  return { words: shuffle(words), focus };
};
