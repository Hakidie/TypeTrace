// Weak spots (SCRUM-28, US3.2): a practice lesson aimed at the learner's errors. Its words come from the word bank: most of them
// train the error types the learner is weak at (or the one they chose), the others none of them. `startSession` stores them as
// the session's `targetWords`, so the lesson is typed, graded and counted like any practice session. Only models and services
// that never import the typing sessions are imported here, so no service cycle can start (see `service-imports.test.ts`).
import { TypingSessionModel } from '../models/typing-session.model';
import { WordModel } from '../models/word.model';
import { forbidden } from '../utils/app-error';
import { WordError, type WordErrorType } from '../utils/vietnamese-errors';
import { getWeakErrorTypes } from './error-profile.service';
import { getPlanOf } from './passage-lock.service';

/** A lesson has 30 to 50 words, a random number in between. */
export const LESSON_MIN_WORDS = 30;
export const LESSON_MAX_WORDS = 50;
/** 60 to 70 % of them train the lesson's error types: whole percents, since a sum of decimals can miss an edge. */
export const LESSON_MIN_FOCUS_PERCENT = 60;
export const LESSON_MAX_FOCUS_PERCENT = 70;
/** Without an error type chosen, a lesson trains the learner's weakest types: at most this many. */
export const LESSON_FOCUS_TYPES = 2;
/** The words of the learner's last lessons come back only when the bank has too few others. */
export const RECENT_LESSONS = 3;

/** A word of the bank, as a lesson reads it. */
export interface BankWord {
  text: string;
  tags: readonly WordErrorType[];
}

/** The tone marks of a word split into letters and marks (NFD): huyền, sắc, ngã, hỏi, nặng. */
const TONE_MARK = /[̣̀́̃̉]/;

/**
 * Whether a word trains `type`. Its tags (`tagWord`) are the errors it gives a chance of, but every word gives a chance of a
 * wrong letter and of a wrong tone: so a tone is trained by a word with a tone mark, and the letters by any word (a lesson for
 * them is made of any words). The other types are the word's tags.
 */
export const trainsErrorType = (word: BankWord, type: WordErrorType) => {
  if (type === WordError.BASE_LETTER) return true;
  if (type === WordError.TONE_WRONG) return TONE_MARK.test(word.text.normalize('NFD'));
  return word.tags.includes(type);
};

export interface LessonInput {
  /** The error types to train, the weakest first. */
  focus: readonly WordErrorType[];
  /** The active words of the bank. */
  words: readonly BankWord[];
  /** The words of the learner's last lessons: used only when the others run out. */
  recentWords: ReadonlySet<string>;
  /** A number in [0, 1): `Math.random`, or a fixed one in the tests. */
  random?: () => number;
}

export interface Lesson {
  /** The error types the lesson trains: those of the focus that have words in the bank. */
  focus: WordErrorType[];
  words: string[];
}

/** A whole number from `min` to `max`, both included. */
const randomInt = (min: number, max: number, random: () => number) => min + Math.floor(random() * (max - min + 1));

/** Puts `items` in a random order (Fisher-Yates) and returns them. */
const shuffle = <T>(items: T[], random: () => number) => {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
};

/** The words of one group (those that train one error type, or the others), in the order they are taken. */
interface WordGroup {
  /** Not in the learner's last lessons: taken first. */
  fresh: string[];
  /** In the learner's last lessons: taken when no group has a fresh word left. */
  recent: string[];
  /** Every word of the group, taken again when the bank is too small for the lesson. */
  all: string[];
  repeats: number;
}

const groupOf = (texts: string[], recentWords: ReadonlySet<string>, random: () => number): WordGroup => {
  const fresh = shuffle(texts.filter((text) => !recentWords.has(text)), random);
  const recent = shuffle(texts.filter((text) => recentWords.has(text)), random);
  return { fresh, recent, all: [...fresh, ...recent], repeats: 0 };
};

/** Takes out of `list` its first word that is not in the lesson yet (none when they all are). */
const takeNew = (list: string[], inLesson: ReadonlySet<string>) => {
  while (list.length) {
    const word = list.shift()!;
    if (!inLesson.has(word)) return word;
  }
  return undefined;
};

/** The first word `take` finds in the groups, in their order. */
const firstOf = (groups: WordGroup[], take: (group: WordGroup) => string | undefined) => {
  for (const group of groups) {
    const word = take(group);
    if (word !== undefined) return word;
  }
  return undefined;
};

/**
 * Adds `count` words of the groups (none empty) to the lesson, the groups taking turns, so two error types share it. A place
 * takes a word of the group whose turn it is, else of the next ones: first a word not in the learner's last lessons, then one
 * of those, and once every word of the groups is in the lesson, a word again (a bank too small repeats words).
 */
const fill = (lesson: string[], groups: WordGroup[], count: number) => {
  const inLesson = new Set(lesson);
  for (let place = 0; place < count; place += 1) {
    const turn = groups.map((_, step) => groups[(place + step) % groups.length]);
    const word =
      firstOf(turn, (group) => takeNew(group.fresh, inLesson)) ??
      firstOf(turn, (group) => takeNew(group.recent, inLesson)) ??
      turn[0].all[turn[0].repeats++ % turn[0].all.length];
    lesson.push(word);
    inLesson.add(word);
  }
};

/**
 * A lesson for `focus` (pure, for the tests): 30 to 50 words in a random order, 60 to 70 % of them training the focus (the
 * types taking turns) and the others training none of it. When every word of the bank trains the focus (the letters), every
 * word of the lesson does. `null` when no word trains a type of the focus: there is nothing to aim at.
 */
export const buildLesson = ({ focus, words, recentWords, random = Math.random }: LessonInput): Lesson | null => {
  const trained = focus
    .map((type) => ({ type, texts: words.filter((word) => trainsErrorType(word, type)).map((word) => word.text) }))
    .filter(({ texts }) => texts.length > 0);
  if (!trained.length) return null;
  const others = words.filter((word) => !focus.some((type) => trainsErrorType(word, type))).map((word) => word.text);

  const size = randomInt(LESSON_MIN_WORDS, LESSON_MAX_WORDS, random);
  const focusCount = others.length
    ? randomInt(Math.ceil((size * LESSON_MIN_FOCUS_PERCENT) / 100), Math.floor((size * LESSON_MAX_FOCUS_PERCENT) / 100), random)
    : size;
  const lesson: string[] = [];
  fill(lesson, trained.map(({ texts }) => groupOf(texts, recentWords, random)), focusCount);
  if (focusCount < size) fill(lesson, [groupOf(others, recentWords, random)], size - focusCount);
  return { focus: trained.map(({ type }) => type), words: shuffle(lesson, random) };
};

/** How the title of a lesson names its error types (English, like the rest of the app). */
const TITLE_NAMES: Record<WordErrorType, string> = {
  BASE_LETTER: 'letters',
  D_MISSING: 'đ',
  MARK_WRONG: 'vowel marks',
  TONE_WRONG: 'tones',
  HOI_NGA_CONFUSION: 'hỏi / ngã'
};

/** "Weak spots: hỏi / ngã, đ": the name of a lesson in the history and on its result page. */
export const lessonTitle = (focus: readonly WordErrorType[]) => `Weak spots: ${focus.map((type) => TITLE_NAMES[type]).join(', ')}`;

/** Weak spots needs a plan with `canCreateErrorPractice` (Premium, unless an admin changes the plans): 403 otherwise. */
export const assertCanPracticeWeakSpots = async (userId: string) => {
  if (!(await getPlanOf(userId)).config.canCreateErrorPractice) throw forbidden('Your plan does not include weak spots practice');
};

/** The active words of the bank (an admin hides one with `isActive: false`): the bank is small, hundreds of words, so it is read whole. */
const activeWords = () => WordModel.find({ isActive: true }).select({ _id: 0, text: 1, tags: 1 }).lean<BankWord[]>();

/**
 * The words of the learner's last `RECENT_LESSONS` lessons, finished or not (Restart and another error type leave one behind).
 * A session that typed a passage instead has no focus: it is not a lesson. Read through the index `{ owner, mode, createdAt }`.
 */
const recentLessonWords = async (userId: string) => {
  const lessons = await TypingSessionModel.find({ owner: userId, mode: 'targeted', 'focusErrorTypes.0': { $exists: true } })
    .sort({ createdAt: -1 })
    .limit(RECENT_LESSONS)
    .select({ targetWords: 1 })
    .lean();
  return new Set(lessons.flatMap((lesson) => lesson.targetWords));
};

/**
 * The lesson the learner asks for: of `errorType`, or of their weakest types (`getWeakErrorTypes`). `null` when there is
 * nothing to aim at (no weak type yet, or no word for it): the caller types a random passage instead. 403 for a plan without
 * Weak spots, even then.
 */
export const lessonFor = async (userId: string, errorType?: WordErrorType) => {
  await assertCanPracticeWeakSpots(userId);
  const focus = errorType ? [errorType] : await getWeakErrorTypes(userId, LESSON_FOCUS_TYPES);
  if (!focus.length) return null;
  const [words, recentWords] = await Promise.all([activeWords(), recentLessonWords(userId)]);
  const lesson = buildLesson({ focus, words, recentWords });
  return lesson && { ...lesson, title: lessonTitle(lesson.focus) };
};
