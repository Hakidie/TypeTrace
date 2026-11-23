/**
 * Evaluates the passages the AI writes for Weak spots (SCRUM-153, SCRUM-124) and writes the result to `docs/ai-eval.md`.
 * Run with `npm run eval:ai`. It calls Gemini for real, once for each of the 20 cases (10 Vietnamese, 10 English), with the
 * same words, prompt and checks as a lesson (`buildLesson`, `lessonPrompt`, `checkAiPassage`). It needs `GEMINI_API_KEY`;
 * it never touches the database, so no learner's AI limit is used.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { env } from '../config/env';
import { weakSpotsAi } from '../config/weak-spots-ai';
import { ENGLISH_PRACTICE_PASSAGE_LIST } from '../data/passages-en-practice';
import { WORD_LIST } from '../data/words';
import { splitWords } from '../models/passage.model';
import { generateText } from '../services/ai.service';
import { type BankWord, buildLesson, checkAiPassage, cleanAiText, lessonPrompt, trainsErrorType } from '../services/targeted-practice.service';
import { tagEnglishWord } from '../utils/english-errors';
import type { SessionErrorType, TypingLanguage } from '../utils/typing-language';
import { tagWord } from '../utils/vietnamese-errors';

interface EvalCase {
  language: TypingLanguage;
  focus: SessionErrorType[];
}

/** The 20 cases: every error type of each language alone, then pairs of them (a lesson without a chosen type trains two). */
export const EVAL_CASES: EvalCase[] = [
  ...(['BASE_LETTER', 'D_MISSING', 'MARK_WRONG', 'TONE_WRONG', 'HOI_NGA_CONFUSION'] as const).map((type) => ({ language: 'vi' as const, focus: [type] })),
  { language: 'vi', focus: ['HOI_NGA_CONFUSION', 'D_MISSING'] },
  { language: 'vi', focus: ['TONE_WRONG', 'MARK_WRONG'] },
  { language: 'vi', focus: ['D_MISSING', 'TONE_WRONG'] },
  { language: 'vi', focus: ['MARK_WRONG', 'HOI_NGA_CONFUSION'] },
  { language: 'vi', focus: ['BASE_LETTER', 'TONE_WRONG'] },
  ...(['LETTER_WRONG', 'LETTER_MISSING', 'LETTER_EXTRA', 'LETTERS_SWAPPED', 'CASE_WRONG', 'PUNCTUATION_WRONG'] as const).map((type) => ({
    language: 'en' as const,
    focus: [type]
  })),
  { language: 'en', focus: ['CASE_WRONG', 'PUNCTUATION_WRONG'] },
  { language: 'en', focus: ['LETTERS_SWAPPED', 'CASE_WRONG'] },
  { language: 'en', focus: ['LETTER_MISSING', 'PUNCTUATION_WRONG'] },
  { language: 'en', focus: ['LETTER_WRONG', 'LETTERS_SWAPPED'] }
];

/** A fixed random generator (mulberry32), so every run picks the same words for a case. */
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const HAS_LETTER = /\p{L}/u;

/** The words a lesson picks from, as in the app: the word list in Vietnamese, the English practice passages in English. */
const wordsOf = (language: TypingLanguage): BankWord[] => {
  if (language === 'vi') return [...new Set(WORD_LIST)].map((text) => ({ text, tags: tagWord(text) }));
  const texts = new Set(ENGLISH_PRACTICE_PASSAGE_LIST.flatMap((passage) => splitWords(passage.content)).filter((text) => HAS_LETTER.test(text)));
  return [...texts].map((text) => ({ text, tags: tagEnglishWord(text) }));
};

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

/** Asks Gemini once more after a pause when the first try fails (a quota error says nothing about the passage). */
const ask = async (language: TypingLanguage, practice: string[], others: string[]) => {
  const options = { systemPrompt: weakSpotsAi.systemPrompts[language], maxOutputTokens: weakSpotsAi.maxOutputTokens, timeoutMs: weakSpotsAi.timeoutMs };
  try {
    return await generateText(lessonPrompt(language, practice, others), options);
  } catch {
    await sleep(6000);
    return generateText(lessonPrompt(language, practice, others), options);
  }
};

const MARKDOWN = /[*_#`>~]/;
const EDGE_QUOTES = /^["'“”‘’«»\s]+|["'“”‘’«»\s]+$/;

interface Result {
  language: TypingLanguage;
  focus: SessionErrorType[];
  practice: number;
  /** `null` when Gemini could not answer. */
  words: number | null;
  used: number;
  wanted: number;
  ok: boolean;
  problems: string[];
}

const evaluate = async (testCase: EvalCase, index: number): Promise<Result> => {
  const words = wordsOf(testCase.language);
  const lesson = buildLesson({ focus: testCase.focus, words, recentWords: new Set(), random: seeded(index + 1) })!;
  const bank = new Map(words.map((word) => [word.text, word]));
  const trains = (text: string) => lesson.focus.some((type) => trainsErrorType(bank.get(text)!, type));
  const practice = [...new Set(lesson.words.filter(trains))];
  const others = [...new Set(lesson.words.filter((text) => !trains(text)))];
  const base = { language: testCase.language, focus: testCase.focus, practice: practice.length };
  try {
    const text = await ask(testCase.language, practice, others);
    const check = checkAiPassage(text, practice);
    const problems: string[] = [];
    if (check.words.length < weakSpotsAi.minWords) problems.push(`too short (under ${weakSpotsAi.minWords} words)`);
    if (check.words.length > weakSpotsAi.maxWords) problems.push(`too long (over ${weakSpotsAi.maxWords} words)`);
    if (check.used * 100 < weakSpotsAi.minUsedPercent * check.wanted) problems.push(`too few practice words used (under ${weakSpotsAi.minUsedPercent} %)`);
    if (MARKDOWN.test(text) || EDGE_QUOTES.test(text.trim()) || cleanAiText(text) !== text.trim()) problems.push('Markdown, quotation marks or line breaks (the server cleans them)');
    return { ...base, words: check.words.length, used: check.used, wanted: check.wanted, ok: check.ok, problems };
  } catch (error) {
    return { ...base, words: null, used: 0, wanted: practice.length, ok: false, problems: [`Gemini did not answer (${error instanceof Error ? error.message : 'error'})`] };
  }
};

const percent = (part: number, whole: number) => (whole ? Math.round((part * 100) / whole) : 0);

/** "7 / 11": the cases of `rows` that passed. */
const passedOf = (rows: Result[]) => `${rows.filter((result) => result.ok).length} / ${rows.length}`;

const reportOf = (results: Result[]) => {
  const answered = results.filter((result) => result.words !== null);
  const passed = results.filter((result) => result.ok);
  const byLanguage = (language: TypingLanguage) => {
    const rows = results.filter((result) => result.language === language);
    return `${rows.filter((result) => result.ok).length} / ${rows.length}`;
  };
  const counts = new Map<string, number>();
  for (const problem of results.flatMap((result) => result.problems)) {
    const key = problem.startsWith('Gemini did not answer') ? 'Gemini did not answer (quota, timeout or a Gemini error)' : problem;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const problemLines = counts.size
    ? [...counts].sort((a, b) => b[1] - a[1]).map(([problem, count]) => `| ${problem} | ${count} |`)
    : ['| none | 0 |'];
  const rows = results.map(
    (result, index) =>
      `| ${index + 1} | ${result.language} | ${result.focus.join(', ')} | ${result.practice} | ${result.words ?? '-'} | ${result.words === null ? '-' : `${result.used} / ${result.wanted} (${percent(result.used, result.wanted)} %)`} | ${result.ok ? 'pass' : 'FAIL'} | ${result.problems.join('; ') || '-'} |`
  );
  return [
    '# AI passage evaluation (SCRUM-124)',
    '',
    `Generated by \`npm run eval:ai\` on ${new Date().toISOString().slice(0, 10)} with \`${env.geminiModel}\`. Do not edit by hand: run it again.`,
    '',
    'What it measures: for each of 20 cases the Weak spots lesson is built as in the app (`buildLesson`, a fixed random seed per case, so the same words each run), Gemini writes a passage from it (`lessonPrompt`, `weakSpotsAi.systemPrompts`), and the server checks it (`checkAiPassage`). A case **passes** when the passage has ' +
      `${weakSpotsAi.minWords} to ${weakSpotsAi.maxWords} words and uses at least ${weakSpotsAi.minUsedPercent} % of the practice words. A failed case is never shown to a learner: the lesson is a saved passage or the picked words. Each case is one call, so the rate is a small sample, not a guarantee.`,
    '',
    '## Result',
    '',
    `- **Passed the validator: ${passed.length} / ${results.length} (${percent(passed.length, results.length)} %)**`,
    `- Vietnamese: ${byLanguage('vi')}, English: ${byLanguage('en')}`,
    `- One error type: ${passedOf(results.filter((result) => result.focus.length === 1))}, two error types: ${passedOf(results.filter((result) => result.focus.length === 2))}`,
    `- Gemini answered ${answered.length} / ${results.length} times`,
    `- Average share of practice words used (answered cases): ${percent(answered.reduce((sum, result) => sum + result.used, 0), answered.reduce((sum, result) => sum + result.wanted, 0))} %`,
    '',
    '## Common problems',
    '',
    '| Problem | Cases |',
    '|---|---|',
    ...problemLines,
    '',
    'Markdown and quotation marks do not fail a case: `cleanAiText` removes them before the check.',
    '',
    '## The 20 cases',
    '',
    '| # | Language | Error types | Practice words | Words written | Practice words used | Result | Problems |',
    '|---|---|---|---|---|---|---|---|',
    ...rows,
    ''
  ].join('\n');
};

const run = async () => {
  if (!env.geminiApiKey) throw new Error('GEMINI_API_KEY is not set in BE/.env: the evaluation calls Gemini.');
  const results: Result[] = [];
  for (const [index, testCase] of EVAL_CASES.entries()) {
    const result = await evaluate(testCase, index);
    results.push(result);
    console.log(`${index + 1}/${EVAL_CASES.length} ${result.language} ${result.focus.join('+')}: ${result.ok ? 'pass' : 'FAIL'}`);
    await sleep(1500);
  }
  const file = resolve(__dirname, '../../../docs/ai-eval.md');
  writeFileSync(file, reportOf(results));
  console.log(`Wrote ${file}`);
};

if (require.main === module) {
  run().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
