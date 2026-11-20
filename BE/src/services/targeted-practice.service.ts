// Weak spots (SCRUM-28, US3.2): a practice lesson aimed at the learner's errors, in the language they type (SCRUM-319:
// Vietnamese or English, each with its own error set). Its words are picked from the words of that language (`bankWordsOf`):
// most of them train the error types the learner misses most (or the one they chose), the others none of them. The AI then
// writes a passage that makes sense from them; when it cannot, the picked words are the lesson. `startSession` stores what is
// typed as the session's `targetWords`, so the lesson is typed, graded and counted like any practice session. Only models, the
// AI service and services that never import the typing sessions are imported here, so no service cycle can start (see
// `service-imports.test.ts`).
import { env } from '../config/env';
import { weakSpotsAi } from '../config/weak-spots-ai';
import { PassageModel, passageLanguageFilter, splitWords } from '../models/passage.model';
import { TypingSessionModel } from '../models/typing-session.model';
import { WordModel } from '../models/word.model';
import { badRequest, forbidden } from '../utils/app-error';
import { EnglishError, tagEnglishWord } from '../utils/english-errors';
import { cleanPassageText } from '../utils/passage-text';
import { errorTypesOf, type SessionErrorType, sessionsIn, type TypingLanguage } from '../utils/typing-language';
import { WordError } from '../utils/vietnamese-errors';
import { generateText } from './ai.service';
import { getTopErrorTypes } from './error-profile.service';
import { getLearnerOwnerIds, getPlanOf } from './passage-lock.service';

/** A lesson has 30 to 50 words, a random number in between. */
export const LESSON_MIN_WORDS = 30;
export const LESSON_MAX_WORDS = 50;
/** 60 to 70 % of them train the lesson's error types: whole percents, since a sum of decimals can miss an edge. */
export const LESSON_MIN_FOCUS_PERCENT = 60;
export const LESSON_MAX_FOCUS_PERCENT = 70;
/** Without an error type chosen, a lesson trains the learner's types with the highest error rates, weak or not: at most this many. */
export const LESSON_FOCUS_TYPES = 2;
/** The words of the learner's last lessons come back only when the bank has too few others. */
export const RECENT_LESSONS = 3;

/** A word a lesson can pick, with the errors it gives a chance of in its language (`tagWord` or `tagEnglishWord`). */
export interface BankWord {
  text: string;
  tags: readonly SessionErrorType[];
}

/** The tone marks of a word split into letters and marks (NFD): huyền, sắc, ngã, hỏi, nặng. */
const TONE_MARK = /[̣̀́̃̉]/;
/** A capital letter: where an English word can be typed in the wrong case. */
const CAPITAL = /\p{Lu}/u;

/** The error types any word trains: every word gives a chance of them, so a lesson for them is made of any words. */
const ANY_WORD: ReadonlySet<SessionErrorType> = new Set([
  WordError.BASE_LETTER,
  EnglishError.LETTER_WRONG,
  EnglishError.LETTER_MISSING,
  EnglishError.LETTER_EXTRA
]);

/**
 * Whether a word trains `type` (the two error sets have no type in common, so the type says the language). Its tags are the
 * errors it gives a chance of, but some are on every word: a wrong letter (Vietnamese) and a letter wrong, left out or too
 * many (English) are trained by any word; a tone, though every Vietnamese word is a chance of one, by a word with a tone
 * mark; the case, though Caps Lock reaches every English letter, by a word with a capital. The other types are the word's
 * tags (đ, vowel marks, hỏi / ngã; two letters swapped, punctuation).
 */
export const trainsErrorType = (word: BankWord, type: SessionErrorType) => {
  if (ANY_WORD.has(type)) return true;
  if (type === WordError.TONE_WRONG) return TONE_MARK.test(word.text.normalize('NFD'));
  if (type === EnglishError.CASE_WRONG) return CAPITAL.test(word.text);
  return word.tags.includes(type);
};

export interface LessonInput {
  /** The error types to train, the highest error rate first: all of one language. */
  focus: readonly SessionErrorType[];
  /** The words the lesson may pick (`bankWordsOf`). */
  words: readonly BankWord[];
  /** The words of the learner's last lessons: used only when the others run out. */
  recentWords: ReadonlySet<string>;
  /** A number in [0, 1): `Math.random`, or a fixed one in the tests. */
  random?: () => number;
}

export interface Lesson {
  /** The error types the lesson trains: those of the focus that have words in the bank. */
  focus: SessionErrorType[];
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
const TITLE_NAMES: Record<SessionErrorType, string> = {
  BASE_LETTER: 'letters',
  D_MISSING: 'đ',
  MARK_WRONG: 'vowel marks',
  TONE_WRONG: 'tones',
  HOI_NGA_CONFUSION: 'hỏi / ngã',
  LETTER_WRONG: 'wrong letters',
  LETTER_MISSING: 'missing letters',
  LETTER_EXTRA: 'extra letters',
  LETTERS_SWAPPED: 'swapped letters',
  CASE_WRONG: 'capitals',
  PUNCTUATION_WRONG: 'punctuation'
};

/** "Weak spots: hỏi / ngã, đ": the name of a lesson in the history and on its result page. */
export const lessonTitle = (focus: readonly SessionErrorType[]) => `Weak spots: ${focus.map((type) => TITLE_NAMES[type]).join(', ')}`;

/** Weak spots needs a plan with `canCreateErrorPractice` (Premium, unless an admin changes the plans): 403 otherwise. */
export const assertCanPracticeWeakSpots = async (userId: string) => {
  if (!(await getPlanOf(userId)).config.canCreateErrorPractice) throw forbidden('Your plan does not include weak spots practice');
};

/** The active words of the bank (an admin hides one with `isActive: false`): the bank is small, hundreds of words, so it is read whole. */
const activeWords = () => WordModel.find({ isActive: true }).select({ _id: 0, text: 1, tags: 1 }).lean<BankWord[]>();

/** Has a letter: a word, not a dash or a quotation mark standing between spaces. */
const HAS_LETTER = /\p{L}/u;

/**
 * The words of an English lesson (SCRUM-319): every word of TypeTrace's own English practice passages (published, public,
 * neither a ranked test nor a placement passage, and owned by no learner: an admin's, a deleted account's or no one's), as
 * they are written there, so the capitals and the punctuation are there for those error types (the word bank is Vietnamese,
 * lowercase and without punctuation). Never a learner's passage, whose text is theirs. A few dozen passages: read whole.
 */
const englishPracticeWords = async (): Promise<BankWord[]> => {
  const passages = await PassageModel.find({ status: 'published', visibility: 'public', isPlacement: { $ne: true }, ...passageLanguageFilter('en') })
    .select({ _id: 0, owner: 1, content: 1 })
    .lean();
  const learners = await getLearnerOwnerIds(passages.flatMap((passage) => (passage.owner ? [passage.owner] : [])));
  const texts = new Set(
    passages
      .filter((passage) => !(passage.owner && learners.has(String(passage.owner))))
      .flatMap((passage) => splitWords(passage.content))
      .filter((text) => HAS_LETTER.test(text))
  );
  return [...texts].map((text) => ({ text, tags: tagEnglishWord(text) }));
};

/** The words a lesson in `language` picks from: the word bank in Vietnamese, the English practice passages in English. */
const bankWordsOf = (language: TypingLanguage) => (language === 'en' ? englishPracticeWords() : activeWords());

/**
 * The words picked for the learner's last `RECENT_LESSONS` lessons in `language`, finished or not (Restart and another error
 * type leave one behind): `lessonWords`, or the typed words of a lesson saved before the AI passages (they were the picked
 * words). A session that typed a passage instead has no focus: it is not a lesson. Read through the index `{ owner, mode, createdAt }`.
 */
const recentLessonWords = async (userId: string, language: TypingLanguage) => {
  const lessons = await TypingSessionModel.find({ owner: userId, mode: 'targeted', 'focusErrorTypes.0': { $exists: true }, ...sessionsIn(language) })
    .sort({ createdAt: -1 })
    .limit(RECENT_LESSONS)
    .select({ lessonWords: 1, targetWords: 1 })
    .lean();
  return new Set(lessons.flatMap((lesson) => lesson.lessonWords ?? lesson.targetWords));
};

// Marks and quotes the AI may wrap its passage in, though it is asked not to.
const MARKDOWN = /[*_#`>~]/g;
const EDGE_QUOTES = /^["'“”‘’«»\s]+|["'“”‘’«»\s]+$/g;
const NOT_LETTER_EDGES = /^[^\p{L}]+|[^\p{L}]+$/gu;

/** The AI's answer as one line of plain text: no Markdown, no quotes around it, the spaces and characters of a pasted passage. */
export const cleanAiText = (text: string) => cleanPassageText(text.replace(MARKDOWN, ' ')).replace(EDGE_QUOTES, '');

/** A word as the AI's passage is compared: lowercase, NFC, without the punctuation around it ("Đỏ," → "đỏ", "Lan's." → "lan's"). */
const bankFormOf = (word: string) => word.normalize('NFC').toLowerCase().replace(NOT_LETTER_EDGES, '');

/**
 * Whether the passage the AI wrote can be the lesson (pure, for the tests): `minWords` to `maxWords` words, and at least
 * `minUsedPercent` % of the practice words it was given (compared in whole numbers). A practice word counts in any case and
 * with any punctuation around it ("Lan," of an English passage is used by "Lan."). `words` are the words to type.
 */
export const checkAiPassage = (text: string, practiceWords: readonly string[]) => {
  const words = splitWords(cleanAiText(text));
  const written = new Set(words.map(bankFormOf));
  const wanted = [...new Set(practiceWords.map(bankFormOf))];
  const used = wanted.filter((word) => written.has(word)).length;
  const ok =
    words.length >= weakSpotsAi.minWords &&
    words.length <= weakSpotsAi.maxWords &&
    used * 100 >= weakSpotsAi.minUsedPercent * wanted.length;
  return { ok, words, used, wanted: wanted.length };
};

/** What the AI is asked, in the language of the lesson: the practice words, and the other picked words it may use. */
export const lessonPrompt = (language: TypingLanguage, practiceWords: readonly string[], otherWords: readonly string[]) => {
  const labels = weakSpotsAi.promptLabels[language];
  return [`${labels.practice}: ${practiceWords.join(', ')}`, ...(otherWords.length ? [`${labels.hints}: ${otherWords.join(', ')}`] : [])].join('\n');
};

/**
 * The passage the AI writes in `language` from the picked words, or `null` (the lesson stays the word list): no key, over the
 * learner's limit (`aiAllowed`), a failed, slow or refused answer. Nothing is thrown, so the learner never sees an AI error.
 */
const writePassage = async (language: TypingLanguage, practiceWords: string[], otherWords: string[], aiAllowed: boolean) => {
  if (!aiAllowed || !env.geminiApiKey) return null;
  try {
    const text = await generateText(lessonPrompt(language, practiceWords, otherWords), {
      systemPrompt: weakSpotsAi.systemPrompts[language],
      maxOutputTokens: weakSpotsAi.maxOutputTokens,
      timeoutMs: weakSpotsAi.timeoutMs
    });
    const check = checkAiPassage(text, practiceWords);
    if (check.ok) return check.words;
    console.warn(`Weak spots: AI passage not used (${check.words.length} words, ${check.used} of ${check.wanted} practice words)`);
  } catch (error) {
    console.warn('Weak spots: AI passage not written, the word list is the lesson:', error instanceof Error ? error.message : error);
  }
  return null;
};

export type LessonSource = 'ai' | 'words' | 'passage';

const LANGUAGE_NAMES: Record<TypingLanguage, string> = { vi: 'Vietnamese', en: 'English' };

/**
 * The lesson the learner asks for in `language` (the one they type, SCRUM-319): of `errorType`, which must be one of that
 * language's error types (400 otherwise), or of their types with the highest error rates in that language, weak or not
 * (`getTopErrorTypes`). Its words are picked from the words of the language (`lessonWords`), then the AI writes a passage
 * from them (`targetWords`), or the picked words are typed as they are. `null` when there is nothing to aim at (no type with
 * enough data in the error profile yet, or no word for it): the caller types a random passage instead. 403 for a plan without
 * Weak spots, even then.
 */
export const lessonFor = async (
  userId: string,
  language: TypingLanguage,
  errorType?: SessionErrorType,
  { aiAllowed = true }: { aiAllowed?: boolean } = {}
) => {
  if (errorType && !errorTypesOf(language).includes(errorType)) {
    throw badRequest(`This is not one of the ${LANGUAGE_NAMES[language]} error types`);
  }
  await assertCanPracticeWeakSpots(userId);
  const focus = errorType ? [errorType] : await getTopErrorTypes(userId, language, LESSON_FOCUS_TYPES);
  if (!focus.length) return null;
  const [words, recentWords] = await Promise.all([bankWordsOf(language), recentLessonWords(userId, language)]);
  const lesson = buildLesson({ focus, words, recentWords });
  if (!lesson) return null;
  const bank = new Map(words.map((word) => [word.text, word]));
  const trains = (text: string) => lesson.focus.some((type) => trainsErrorType(bank.get(text)!, type));
  const practiceWords = [...new Set(lesson.words.filter(trains))];
  const otherWords = [...new Set(lesson.words.filter((text) => !trains(text)))];
  const passage = await writePassage(language, practiceWords, otherWords, aiAllowed);
  return {
    focus: lesson.focus,
    title: lessonTitle(lesson.focus),
    lessonWords: lesson.words,
    targetWords: passage ?? lesson.words,
    source: (passage ? 'ai' : 'words') as LessonSource
  };
};
