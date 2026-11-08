import { useEffect, useState } from 'react';
import { PassageView } from '@/modules/typing/components/PassageView';
import { checkWords, toWords } from '@/modules/typing/utils/typing-session';

const PASSAGE = 'Mỗi lỗi gõ sai đều để lại một dấu vết nhỏ trên đường học gõ nhanh hơn.';
const WORDS = toWords(PASSAGE);

/** This word is finished wrong (red, wavy underline) and stays that way, like in a real session. */
const WRONG_INDEX = 3;
const WRONG_TYPED = 'sau';
/** On this word a wrong letter is typed and deleted again before the word is finished. */
const FIX_INDEX = 7;
const SLIP_CHAR = 'x';

const KEY_DELAY = 70;
const WORD_DELAY = 110;

interface Frame {
  /** Words finished so far, as typed. */
  typed: string[];
  /** The word being typed; undefined once the passage is finished (no caret). */
  current?: string;
  /** Milliseconds to wait before the next frame. */
  delay: number;
}

/** Every step of the demo: type each word, finish one wrong, slip on another letter and delete it. */
const buildFrames = (): Frame[] => {
  const frames: Frame[] = [{ typed: [], current: '', delay: 500 }];
  const typed: string[] = [];
  WORDS.forEach((word, index) => {
    const final = index === WRONG_INDEX ? WRONG_TYPED : word;
    const letters = Array.from(final);
    letters.forEach((_, i) => {
      frames.push({ typed: [...typed], current: letters.slice(0, i + 1).join(''), delay: KEY_DELAY });
      if (index === FIX_INDEX && i === 1) {
        const prefix = letters.slice(0, 2).join('');
        frames.push({ typed: [...typed], current: `${prefix}${SLIP_CHAR}`, delay: 800 });
        frames.push({ typed: [...typed], current: prefix, delay: 250 });
      }
    });
    typed.push(final);
    const last = index === WORDS.length - 1;
    frames.push({ typed: [...typed], current: last ? undefined : '', delay: last ? 0 : WORD_DELAY });
  });
  return frames;
};

const FRAMES = buildFrames();

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * The passage of the Typing page typing itself once, with a word finished wrong and a slip that gets deleted: the idea
 * of TypeTrace in a few seconds. It takes no keys and calls no API. For reduced motion it shows the final state.
 * Screen readers read the passage only (the animation is hidden).
 */
export const TypingDemo = () => {
  const [index, setIndex] = useState(() => (prefersReducedMotion() ? FRAMES.length - 1 : 0));
  const frame = FRAMES[index];

  useEffect(() => {
    if (index >= FRAMES.length - 1) return;
    const timer = setTimeout(() => setIndex(index + 1), frame.delay);
    return () => clearTimeout(timer);
  }, [index, frame.delay]);

  return (
    <div>
      <span className="sr-only">{PASSAGE}</span>
      <div aria-hidden="true">
        <PassageView words={WORDS} results={checkWords(WORDS, frame.typed)} current={frame.current} maxRows={4} />
      </div>
    </div>
  );
};
