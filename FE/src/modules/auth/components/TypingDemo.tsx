import { useEffect, useState } from 'react';
import { useUiLanguage } from '@/modules/settings/hooks/use-ui-language';
import type { UiLanguage } from '@/shared/i18n/ui-language';
import { PassageView } from '@/modules/typing/components/PassageView';
import { checkWords, toWords } from '@/modules/typing/utils/typing-session';

interface DemoText {
  passage: string;
  /** This word is finished wrong (red, wavy underline) and stays that way, like in a real session. */
  wrongIndex: number;
  wrongTyped: string;
  /** On this word a wrong letter is typed and deleted again before the word is finished. */
  fixIndex: number;
}

/** The demo follows the language of the interface (SCRUM-329): the same story in each language. */
const TEXTS: Record<UiLanguage, DemoText> = {
  vi: { passage: 'Mỗi lỗi gõ sai đều để lại một dấu vết nhỏ trên đường học gõ nhanh hơn.', wrongIndex: 3, wrongTyped: 'sau', fixIndex: 7 },
  en: { passage: 'Every typing mistake leaves a small trace on the way to typing faster.', wrongIndex: 3, wrongTyped: 'leavse', fixIndex: 6 },
};

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
const buildFrames = ({ passage, wrongIndex, wrongTyped, fixIndex }: DemoText): Frame[] => {
  const words = toWords(passage);
  const frames: Frame[] = [{ typed: [], current: '', delay: 500 }];
  const typed: string[] = [];
  words.forEach((word, index) => {
    const final = index === wrongIndex ? wrongTyped : word;
    const letters = Array.from(final);
    letters.forEach((_, i) => {
      frames.push({ typed: [...typed], current: letters.slice(0, i + 1).join(''), delay: KEY_DELAY });
      if (index === fixIndex && i === 1) {
        const prefix = letters.slice(0, 2).join('');
        frames.push({ typed: [...typed], current: `${prefix}${SLIP_CHAR}`, delay: 800 });
        frames.push({ typed: [...typed], current: prefix, delay: 250 });
      }
    });
    typed.push(final);
    const last = index === words.length - 1;
    frames.push({ typed: [...typed], current: last ? undefined : '', delay: last ? 0 : WORD_DELAY });
  });
  return frames;
};

const FRAMES: Record<UiLanguage, Frame[]> = { vi: buildFrames(TEXTS.vi), en: buildFrames(TEXTS.en) };

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * The passage of the Typing page typing itself once, with a word finished wrong and a slip that gets deleted: the idea
 * of TypeTrace in a few seconds. It takes no keys and calls no API. For reduced motion it shows the final state.
 * Screen readers read the passage only (the animation is hidden).
 */
export const TypingDemo = () => {
  const language = useUiLanguage();
  // Another language starts the demo again with its own passage.
  return <DemoRun key={language} language={language} />;
};

const DemoRun = ({ language }: { language: UiLanguage }) => {
  const { passage } = TEXTS[language];
  const words = toWords(passage);
  const frames = FRAMES[language];
  const [index, setIndex] = useState(() => (prefersReducedMotion() ? frames.length - 1 : 0));
  const frame = frames[index];

  useEffect(() => {
    if (index >= frames.length - 1) return;
    const timer = setTimeout(() => setIndex(index + 1), frame.delay);
    return () => clearTimeout(timer);
  }, [index, frame.delay, frames.length]);

  return (
    <div>
      <span className="sr-only">{passage}</span>
      <div aria-hidden="true">
        <PassageView words={words} results={checkWords(words, frame.typed)} current={frame.current} maxRows={4} />
      </div>
    </div>
  );
};
