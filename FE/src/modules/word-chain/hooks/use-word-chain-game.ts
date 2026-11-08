import { useCallback, useEffect, useRef, useState } from 'react';
import {
  answerWpm,
  BOT_STUCK_POINTS,
  botReply,
  bonusMs,
  checkAnswer,
  HINT_COST_MS,
  hintFor,
  keyOf,
  lastSyllable,
  SKIP_COST_MS,
  START_MS,
  type WordBank,
} from '../lib/word-chain';

export interface ChainLink {
  id: number;
  by: 'bot' | 'me';
  word: string;
  /** The time a right answer added. */
  bonusMs?: number;
}

export type Feedback =
  | { kind: 'good'; text: string }
  | { kind: 'bad'; text: string }
  | { kind: 'hint'; text: string };

export type Phase = 'ready' | 'playing' | 'over';

const REASONS = {
  shape: 'Gõ một từ ghép đúng hai tiếng.',
  start: (syllable: string) => `Từ phải bắt đầu bằng "${syllable}".`,
  unknown: (word: string) => `"${word}" chưa có trong danh sách từ.`,
  used: 'Từ này đã dùng trong ván rồi.',
};

const bestKey = (userId: string) => `typetrace:noi-tu-best:${userId}`;
const readBest = (userId: string) => {
  try {
    return Number(localStorage.getItem(bestKey(userId))) || 0;
  } catch {
    return 0;
  }
};

/**
 * One game of Nối từ: the clock, the chain, the score and the best score (kept in this browser, per user).
 * The bot answers at once; the clock runs from the moment its word appears.
 */
export const useWordChainGame = (bank: WordBank | undefined, userId: string) => {
  const [phase, setPhase] = useState<Phase>('ready');
  const [chain, setChain] = useState<ChainLink[]>([]);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => readBest(userId));
  const [newBest, setNewBest] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [deadline, setDeadline] = useState(0);
  const shownAt = useRef(0);
  const used = useRef(new Set<string>());
  const nextId = useRef(0);

  const last = chain[chain.length - 1];
  const leftMs = phase === 'playing' ? Math.max(0, deadline - now) : phase === 'ready' ? START_MS : 0;

  const add = (by: ChainLink['by'], word: string, bonus?: number): ChainLink => {
    used.current.add(keyOf(word));
    return { id: nextId.current++, by, word, bonusMs: bonus };
  };
  const moveClock = (ms: number) => {
    setDeadline((d) => d + ms);
    setNow(Date.now());
  };

  /** The bot's fresh word, or the end of the game when it has none left. */
  const freshWord = useCallback(
    (links: ChainLink[]) => {
      const word = bank && botReply(bank, null, used.current);
      if (!word) return links;
      shownAt.current = Date.now();
      return [...links, add('bot', word)];
    },
    [bank],
  );

  const start = useCallback(() => {
    if (!bank) return;
    used.current = new Set();
    nextId.current = 0;
    setDeadline(Date.now() + START_MS);
    setNow(Date.now());
    setScore(0);
    setNewBest(false);
    setFeedback(null);
    setChain(freshWord([]));
    setPhase('playing');
  }, [bank, freshWord]);

  /** Checks the typed word; returns whether it was taken (the box is then cleared). */
  const submit = (input: string) => {
    if (phase !== 'playing' || !bank || !last) return false;
    const result = checkAnswer(bank, last.word, input, used.current);
    if (!result.ok) {
      const reason = result.reason;
      setFeedback({
        kind: 'bad',
        text: reason === 'start' ? REASONS.start(lastSyllable(last.word)) : reason === 'unknown' ? REASONS.unknown(input.trim()) : REASONS[reason],
      });
      return false;
    }
    const bonus = bonusMs(answerWpm(result.word, Date.now() - shownAt.current));
    moveClock(bonus);
    let links = [...chain, add('me', result.word, bonus)];
    let points = 1;
    const reply = botReply(bank, result.word, used.current);
    if (reply) {
      shownAt.current = Date.now();
      links = [...links, add('bot', reply)];
      setFeedback({ kind: 'good', text: `Đúng! +1 điểm, +${bonus / 1000} giây` });
    } else {
      points += BOT_STUCK_POINTS;
      links = freshWord(links);
      setFeedback({ kind: 'good', text: `Bot bí "${lastSyllable(result.word)}"! +${points} điểm, +${bonus / 1000} giây` });
    }
    setScore((s) => s + points);
    setChain(links);
    return true;
  };

  const skip = () => {
    if (phase !== 'playing' || !last) return;
    moveClock(-SKIP_COST_MS);
    setFeedback({ kind: 'bad', text: `Bỏ qua "${last.word}", −${SKIP_COST_MS / 1000} giây` });
    setChain((links) => freshWord(links));
  };

  const hint = () => {
    if (phase !== 'playing' || !bank || !last) return;
    const word = hintFor(bank, last.word, used.current);
    if (!word) return setFeedback({ kind: 'bad', text: 'Không còn từ nào nối được. Bấm Bỏ qua.' });
    moveClock(-HINT_COST_MS);
    setFeedback({ kind: 'hint', text: `Gợi ý: ${word} (−${HINT_COST_MS / 1000} giây)` });
  };

  // The clock: ticks while playing, and ends the game at 0 (the best score is saved then).
  useEffect(() => {
    if (phase !== 'playing') return;
    const timer = setInterval(() => {
      const time = Date.now();
      setNow(time);
      if (time < deadline) return;
      setPhase('over');
      if (score <= best) return;
      setBest(score);
      setNewBest(true);
      try {
        localStorage.setItem(bestKey(userId), String(score));
      } catch {
        // the best score is a convenience: without storage it lives until the page closes
      }
    }, 100);
    return () => clearInterval(timer);
  }, [phase, deadline, score, best, userId]);

  return { phase, chain, score, best, newBest, leftMs, feedback, prompt: last ? lastSyllable(last.word) : '', start, submit, skip, hint };
};
