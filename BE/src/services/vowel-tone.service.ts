// A learner's vowel × tone grid (SCRUM-29, US4.1): for each of the 12 Vietnamese vowels and each of the 6 tones, how often that
// vowel was in a target word of that tone ("seen") and how often the learner typed the word wrong at that vowel or tone
// ("wrong"), in their last counted Vietnamese sessions. Like the error profile it is worked out each time it is read from the
// sessions' words and never stored. Only models and pure utilities are imported, so no service cycle can start here.
import type { Types } from 'mongoose';
import { TypingSessionModel } from '../models/typing-session.model';
import { sessionsIn } from '../utils/typing-language';
import { classifyWord, WordError } from '../utils/vietnamese-errors';
import { PROFILE_WINDOW } from './error-profile.service';

export const VOWELS = ['a', 'ă', 'â', 'e', 'ê', 'i', 'o', 'ô', 'ơ', 'u', 'ư', 'y'] as const;
export const TONES = ['ngang', 'sac', 'huyen', 'hoi', 'nga', 'nang'] as const;
export type Vowel = (typeof VOWELS)[number];
export type ToneId = (typeof TONES)[number];

/** A cell with fewer sightings than this says too little: the frontend greys it. */
export const MIN_VOWEL_TONE_SEEN = 5;
/** Wrong words kept for the tooltip of a cell. */
export const MAX_EXAMPLES = 3;

export interface VowelToneExample {
  target: string;
  typed: string;
}

export interface VowelToneCell {
  vowel: Vowel;
  tone: ToneId;
  seen: number;
  wrong: number;
  /** Up to `MAX_EXAMPLES` different words typed wrong at this cell, the newest first. */
  examples: VowelToneExample[];
}

/** `GET /api/profile/vowel-tone`. The threshold comes along so the frontend never writes it. */
export interface VowelToneGrid {
  language: 'vi';
  /** Counted sessions read at most. */
  window: number;
  minSeen: number;
  /** Sessions read: 0 to `window`. */
  sessionsUsed: number;
  vowels: readonly Vowel[];
  tones: readonly ToneId[];
  /** All 72 cells, vowel by vowel, each in the order of `tones`. */
  cells: VowelToneCell[];
}

/** What the grid reads of a session: its words, newest session first in the list given. */
export interface VowelToneSession {
  words?: readonly { target: string; typed: string }[];
}

const TONE_OF_MARK: Record<string, ToneId> = { '̀': 'huyen', '́': 'sac', '̃': 'nga', '̉': 'hoi', '̣': 'nang' };
const MARKS = new Set(['̂', '̆', '̛']); // â ê ô, ă, ơ ư

interface Letter {
  /** The base letter, lowercase, `đ` read as `d`. */
  base: string;
  /** Its vowel mark, '' for none. */
  mark: string;
}

/** The letters of a word with their vowel marks, and the tone of the word ('ngang' without one). */
const decompose = (word: string): { letters: Letter[]; tone: ToneId } => {
  const letters: Letter[] = [];
  let tone: ToneId = 'ngang';
  for (const char of word.normalize('NFD')) {
    if (MARKS.has(char)) {
      if (letters.length > 0) letters[letters.length - 1].mark = char;
    } else if (TONE_OF_MARK[char]) {
      tone = TONE_OF_MARK[char];
    } else {
      letters.push({ base: char === 'đ' || char === 'Đ' ? 'd' : char.toLowerCase(), mark: '' });
    }
  }
  return { letters, tone };
};

const VOWEL_OF: Record<string, Vowel> = {
  a: 'a', 'ă': 'ă', 'â': 'â', e: 'e', 'ê': 'ê', i: 'i', o: 'o', 'ô': 'ô', 'ơ': 'ơ', u: 'u', 'ư': 'ư', y: 'y'
};

const vowelOf = (letter: Letter): Vowel | undefined => VOWEL_OF[letter.base + letter.mark];

/**
 * The cells of `sessions` given newest first (pure, for the tests): the first `PROFILE_WINDOW` are read. Each vowel of a
 * target word is one sighting of (vowel, the tone of the word). It is wrong when the typed word has another tone (a wrong
 * tone, hỏi and ngã mixed up included: every vowel of the word), or, when the typed word has as many letters (so each letter
 * has its place), when that vowel was typed as another letter or with another mark. A wrong consonant, or a word typed with
 * another length, is not blamed on a vowel.
 */
export const computeVowelToneGrid = (sessions: readonly VowelToneSession[]): VowelToneGrid => {
  const used = sessions.slice(0, PROFILE_WINDOW);
  const cells = new Map<string, VowelToneCell>();
  const cellOf = (vowel: Vowel, tone: ToneId) => cells.get(`${vowel}:${tone}`)!;
  for (const vowel of VOWELS) for (const tone of TONES) cells.set(`${vowel}:${tone}`, { vowel, tone, seen: 0, wrong: 0, examples: [] });

  for (const session of used) {
    for (const { target, typed } of session.words ?? []) {
      const want = decompose(target);
      const got = decompose(typed);
      const errors = classifyWord(target, typed);
      const wrongTone = errors.includes(WordError.TONE_WRONG) || errors.includes(WordError.HOI_NGA_CONFUSION);
      const aligned = want.letters.length === got.letters.length;
      want.letters.forEach((letter, index) => {
        const vowel = vowelOf(letter);
        if (!vowel) return;
        const cell = cellOf(vowel, want.tone);
        cell.seen += 1;
        const typedLetter = got.letters[index];
        const wrongLetter = aligned && (typedLetter.base !== letter.base || typedLetter.mark !== letter.mark);
        if (!wrongTone && !wrongLetter) return;
        cell.wrong += 1;
        if (cell.examples.length < MAX_EXAMPLES && !cell.examples.some((example) => example.target === target && example.typed === typed)) {
          cell.examples.push({ target, typed });
        }
      });
    }
  }
  return {
    language: 'vi',
    window: PROFILE_WINDOW,
    minSeen: MIN_VOWEL_TONE_SEEN,
    sessionsUsed: used.length,
    vowels: VOWELS,
    tones: TONES,
    cells: [...cells.values()]
  };
};

/**
 * The signed-in learner's grid: their last `PROFILE_WINDOW` counted, completed Vietnamese sessions (the vowels and tones are
 * Vietnamese, whatever language they type in Practice), newest first, through the index `{ owner: 1, completedAt: -1 }`.
 */
export const getVowelToneGrid = async (userId: string | Types.ObjectId) =>
  computeVowelToneGrid(
    await TypingSessionModel.find({ owner: userId, status: 'completed', isCounted: true, ...sessionsIn('vi') })
      .sort({ completedAt: -1 })
      .limit(PROFILE_WINDOW)
      .select('words.target words.typed')
      .lean()
  );
