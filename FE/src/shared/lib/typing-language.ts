// The two languages a learner types (SCRUM-219, US2.7), each with its own error set (SCRUM-218): Vietnamese
// (`vietnamese-errors.ts`) for the placement test and by default, English (`english-errors.ts`) for the English practice
// passages. Frontend copy of BE/src/utils/typing-language.ts (without the database filter): a session is graded and shown
// with the set of its language, never with the other one.
import { classifyEnglishWord, EnglishError, type EnglishErrorType, tagEnglishWord } from './english-errors';
import { classifyWord, tagWord, WordError, type WordErrorType } from './vietnamese-errors';

export const typingLanguages = ['vi', 'en'] as const;
export type TypingLanguage = (typeof typingLanguages)[number];

/** An error type of either set: what a session's words and counts hold. */
export type SessionErrorType = WordErrorType | EnglishErrorType;

/** The error types of `language`, in the order of their set. */
export const errorTypesOf = (language: TypingLanguage): SessionErrorType[] =>
  language === 'en' ? Object.values(EnglishError) : Object.values(WordError);

/** The errors of a typed word against its target, by the rules of `language`. */
export const classifyIn = (language: TypingLanguage, target: string, typed: string): SessionErrorType[] =>
  language === 'en' ? classifyEnglishWord(target, typed) : classifyWord(target, typed);

/** The errors a target word gives a chance of (the denominator of an error rate), by the rules of `language`. */
export const tagIn = (language: TypingLanguage, target: string): SessionErrorType[] =>
  language === 'en' ? tagEnglishWord(target) : tagWord(target);
