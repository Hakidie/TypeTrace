import { useLayoutEffect, useRef } from 'react';
import type { WordResult } from '../utils/typing-session';

interface PassageViewProps {
  words: string[];
  results: WordResult[];
  /**
   * The text typed so far for the word being typed. Pass it (even empty) while the learner is typing: the word then
   * shows what was typed, the rest of the target in grey, and a caret.
   */
  current?: string;
  /** Show only this many lines and scroll as the learner types, the line being typed second. Without it the whole passage shows. */
  maxRows?: number;
}

// One line of the passage: text-[2rem] with leading-snug is 2.75rem; gap-y-2 adds 0.5rem between lines.
const LINE_REM = 2.75;
const GAP_REM = 0.5;

// The words fade in one after the other when the passage appears (`.word-reveal` in index.css). The delay stops growing
// after 40 words: later words are not on screen yet.
const revealStyle = (index: number) => ({ animationDelay: `${Math.min(index, 40) * 30}ms` });

const Caret = () => <span aria-hidden className="mx-px inline-block h-8 w-0.5 animate-pulse bg-destructive align-middle" />;

/**
 * The passage word by word, with the learner's typing shown in it. Words not reached yet are grey. The word being typed
 * is highlighted: the whole target stays as a grey placeholder and what was typed is white on top of it. A finished word is white when
 * correct; when wrong it shows what was typed in red (hover for the target). Words are graded per word, after the space,
 * by the classifier: an input method rewrites letters while it composes, so nothing is judged earlier.
 */
export const PassageView = ({ words, results, current, maxRows }: PassageViewProps) => {
  const passageRef = useRef<HTMLParagraphElement>(null);
  const currentRef = useRef<HTMLSpanElement>(null);

  // Keep the line being typed on the second row (the first row while at the start).
  useLayoutEffect(() => {
    const passage = passageRef.current;
    if (!maxRows || !passage) return;
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const lineTop = currentRef.current?.offsetTop ?? 0;
    passage.scrollTop = Math.max(0, lineTop - (LINE_REM + GAP_REM) * rem);
  }, [maxRows, results.length]);

  return (
    <p
      ref={passageRef}
      className="relative flex flex-wrap gap-x-3 gap-y-2 overflow-hidden text-[2rem] leading-snug"
      style={maxRows ? { height: `${maxRows * LINE_REM + (maxRows - 1) * GAP_REM}rem` } : undefined}
      aria-label="Passage to type"
    >
      {words.map((word, index) => {
        const result = results[index];
        if (result && result.errors.length > 0) {
          return (
            <span key={index} title={`Should be: ${word}`} style={revealStyle(index)} className="word-reveal text-destructive underline decoration-wavy underline-offset-4">
              {result.typed}
            </span>
          );
        }
        if (result) {
          return (
            <span key={index} style={revealStyle(index)} className="word-reveal text-foreground">
              {word}
            </span>
          );
        }
        if (current !== undefined && index === results.length) {
          return (
            <span key={index} ref={currentRef} style={revealStyle(index)} className="word-reveal inline-grid bg-destructive/15">
              {/* The whole target word, marks included, is the grey placeholder; what was typed lies on top of it. */}
              <span className="col-start-1 row-start-1 text-muted-foreground/60">{word}</span>
              <span className="col-start-1 row-start-1 text-foreground">
                {current}
                <Caret />
              </span>
            </span>
          );
        }
        return (
          <span key={index} style={revealStyle(index)} className="word-reveal text-muted-foreground">
            {word}
          </span>
        );
      })}
    </p>
  );
};
