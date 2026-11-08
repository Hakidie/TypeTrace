// The rules the server checks before a Nối từ game goes on the leaderboard. The game itself runs in the browser
// (`FE/src/modules/word-chain/lib/word-chain.ts`); the score is worked out again here from the chain, never taken from the client.
import { NOI_TU_WORDS } from '../data/noi-tu-words';

const TONES = /[̣̀́̃̉]/g;
/** A syllable's key: its letters and its tone, wherever the tone mark sits (the same rule as the frontend). */
export const sylKey = (syllable: string) => {
  const d = syllable.normalize('NFD');
  const tone = (d.match(TONES) ?? [''])[0];
  return d.replace(TONES, '').normalize('NFC') + tone;
};
const clean = (text: string) => text.normalize('NFC').toLowerCase().trim().replace(/\s+/g, ' ');
const keyOf = (word: string) => clean(word).split(' ').map(sylKey).join(' ');

let known: Set<string> | null = null;
/** The keys of every word of the list, made on first use. */
const knownWords = () => (known ??= new Set(NOI_TU_WORDS.split('\n').map(keyOf)));

/** Points for a word the player chains, and when the bot has no answer to it. */
export const WORD_POINTS = 1;
export const BOT_STUCK_POINTS = 2;

export interface ChainLinkInput {
  by: 'bot' | 'me';
  word: string;
}

/**
 * The score of a chain, or null when it breaks the rules: every word has two syllables, is in the list and is used once; it
 * starts with the bot; each of the player's words starts with the last syllable of the bot's word before it (+1 point). A bot
 * word after the player's that does not chain on means the bot had no answer and started again (+2 points); a bot word after
 * a bot word is a skip (no points).
 */
export const scoreChain = (chain: ChainLinkInput[]): number | null => {
  const words = knownWords();
  const used = new Set<string>();
  let score = 0;
  for (let i = 0; i < chain.length; i++) {
    const { by, word } = chain[i];
    const key = keyOf(word);
    if (key.split(' ').length !== 2 || !words.has(key) || used.has(key)) return null;
    used.add(key);
    const previous = chain[i - 1];
    if (!previous) {
      if (by !== 'bot') return null;
      continue;
    }
    const chains = key.split(' ')[0] === keyOf(previous.word).split(' ')[1];
    if (by === 'me') {
      if (previous.by !== 'bot' || !chains) return null;
      score += WORD_POINTS;
    } else if (previous.by === 'me' && !chains) score += BOT_STUCK_POINTS;
  }
  return score;
};
