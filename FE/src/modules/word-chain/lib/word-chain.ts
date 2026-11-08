/**
 * The rules of Nối từ (word chain), pure so they can be tested: the word list, checking an answer, the bot's reply,
 * hints and the time bonus. The game itself lives in `useWordChainGame`.
 */

/** A game starts with 60 s on the clock. */
export const START_MS = 60_000;
/** Skipping a word costs 5 s, a hint 3 s. */
export const SKIP_COST_MS = 5_000;
export const HINT_COST_MS = 3_000;
/** A refused word (not in the list, wrong first syllable, already used) costs 3 s. */
export const WRONG_COST_MS = 3_000;
/** Points you get when the bot has no answer to your word. */
export const BOT_STUCK_POINTS = 2;

/** The time a right answer adds, by its speed: the first tier whose `minWpm` it reaches. */
export const BONUS_TIERS = [
  { minWpm: 40, ms: 5_000 },
  { minWpm: 25, ms: 4_000 },
  { minWpm: 15, ms: 3_000 },
  { minWpm: 0, ms: 2_000 },
] as const;

const TONES = /[̣̀́̃̉]/g;
/** A syllable's key: its letters and its tone, wherever the tone mark sits ("hoà" and "hòa" have one key). */
export const sylKey = (syllable: string) => {
  const d = syllable.normalize('NFD');
  const tone = (d.match(TONES) ?? [''])[0];
  return d.replace(TONES, '').normalize('NFC') + tone;
};
/** Lowercase, NFC, single spaces. */
export const cleanWord = (text: string) => text.normalize('NFC').toLowerCase().trim().replace(/\s+/g, ' ');
export const keyOf = (word: string) => cleanWord(word).split(' ').map(sylKey).join(' ');
export const firstSyllable = (word: string) => cleanWord(word).split(' ')[0];
export const lastSyllable = (word: string) => cleanWord(word).split(' ')[1];

export interface WordBank {
  /** Every word you may type, by its key. */
  byKey: Map<string, string>;
  /** Every word by the key of its first syllable. */
  all: Map<string, string[]>;
  /** The words the bot may play (common, clean), by the key of their first syllable. */
  bot: Map<string, string[]>;
  /** The bot's words in one list, to start a fresh chain. */
  botWords: string[];
}

const push = (map: Map<string, string[]>, key: string, word: string) => {
  const list = map.get(key);
  if (list) list.push(word);
  else map.set(key, [word]);
};

/** Reads `words.txt`: one two-syllable word per line, `*` in front of the words the bot may play. */
export const parseWordList = (text: string): WordBank => {
  const bank: WordBank = {
    byKey: new Map(),
    all: new Map(),
    bot: new Map(),
    botWords: [],
  };
  for (const line of text.split(/\r?\n/)) {
    const forBot = line.startsWith('*');
    const word = cleanWord(forBot ? line.slice(1) : line);
    if (word.split(' ').length !== 2 || bank.byKey.has(keyOf(word))) continue;
    bank.byKey.set(keyOf(word), word);
    const first = sylKey(firstSyllable(word));
    push(bank.all, first, word);
    if (forBot) {
      push(bank.bot, first, word);
      bank.botWords.push(word);
    }
  }
  return bank;
};

/** The words of `index` that start with `syllable` and are not used yet. */
const answersTo = (index: Map<string, string[]>, syllable: string, used: ReadonlySet<string>) =>
  (index.get(sylKey(syllable)) ?? []).filter((word) => !used.has(keyOf(word)));

export type AnswerCheck = { ok: true; word: string } | { ok: false; reason: 'shape' | 'start' | 'unknown' | 'used' };

/** Whether `input` answers `previous`: two syllables, starting with its last syllable, in the list, not used yet. */
export const checkAnswer = (bank: WordBank, previous: string, input: string, used: ReadonlySet<string>): AnswerCheck => {
  const text = cleanWord(input);
  if (text.split(' ').length !== 2) return { ok: false, reason: 'shape' };
  if (sylKey(firstSyllable(text)) !== sylKey(lastSyllable(previous))) return { ok: false, reason: 'start' };
  const word = bank.byKey.get(keyOf(text));
  if (!word) return { ok: false, reason: 'unknown' };
  if (used.has(keyOf(word))) return { ok: false, reason: 'used' };
  return { ok: true, word };
};

/**
 * The answer the player means. The linking syllable is typed for them, so they type only the second syllable ("bón" after
 * "xuân phân" means "phân bón"); a whole two-syllable word typed anyway is taken as it is.
 */
export const composeAnswer = (prompt: string, typed: string) => {
  const text = cleanWord(typed);
  return text && !text.includes(' ') ? `${cleanWord(prompt)} ${text}` : text;
};

/** The speed of an answer in words per minute: its characters / 5 in the time since the bot's word appeared. */
export const answerWpm = (answer: string, elapsedMs: number) => cleanWord(answer).length / 5 / (Math.max(elapsedMs, 1) / 60_000);

/** The time a right answer adds, by its speed (`BONUS_TIERS`). */
export const bonusMs = (wpm: number) => (BONUS_TIERS.find((tier) => wpm >= tier.minWpm) ?? BONUS_TIERS[BONUS_TIERS.length - 1]).ms;

/** How many of the bot's (common) words could answer `word`. */
const easeOf = (bank: WordBank, word: string, used: ReadonlySet<string>) =>
  answersTo(bank.bot, lastSyllable(word), used).filter((w) => keyOf(w) !== keyOf(word)).length;

/** The best `top` of `words` by how easy they are to answer (at least 2 answers), one picked at random. */
const friendliest = (bank: WordBank, words: string[], used: ReadonlySet<string>, rand: () => number, top = 10) => {
  const scored = words.map((word) => [word, easeOf(bank, word, used)] as const).filter(([, ease]) => ease >= 2);
  scored.sort((a, b) => b[1] - a[1]);
  const pool = scored.slice(0, top);
  if (pool.length) return pool[Math.floor(rand() * pool.length)][0];
  return words.length ? words[Math.floor(rand() * words.length)] : null;
};

/**
 * The bot's word. With `previous`, a word that answers it (null when the bot has none). Without, a fresh word to start
 * a chain. Either way a friendly one: among the words with the most common answers.
 */
export const botReply = (bank: WordBank, previous: string | null, used: ReadonlySet<string>, rand: () => number = Math.random) => {
  if (previous) return friendliest(bank, answersTo(bank.bot, lastSyllable(previous), used), used, rand);
  // a sample keeps a fresh start quick: scoring all the bot's words would take too long
  const sample = Array.from({ length: 200 }, () => bank.botWords[Math.floor(rand() * bank.botWords.length)]).filter(
    (word): word is string => !!word && !used.has(keyOf(word)),
  );
  return friendliest(bank, sample, used, rand);
};

/** A word that answers `previous`, a common one if there is any; null when nothing is left. */
export const hintFor = (bank: WordBank, previous: string, used: ReadonlySet<string>, rand: () => number = Math.random) => {
  const common = answersTo(bank.bot, lastSyllable(previous), used);
  const words = common.length ? common : answersTo(bank.all, lastSyllable(previous), used);
  return words.length ? words[Math.floor(rand() * words.length)] : null;
};
