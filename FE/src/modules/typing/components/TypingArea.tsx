import { CheckCircle2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, CompositionEvent, KeyboardEvent, ReactNode } from 'react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { useElapsedSeconds } from '../hooks/use-elapsed';
import { SESSION_TIME_LIMIT_SECONDS } from '../typing.config';
import { checkWords, formatDuration, splitTyped } from '../utils/typing-session';
import { PassageView } from './PassageView';

/**
 * Puts the text being composed into the text. Some browsers already have it in the textarea's value (a stale copy: it
 * trails the composition by a letter), others keep it out. So it replaces the word being typed, or follows a space.
 */
const withPreedit = (text: string, preedit: string) =>
  preedit === '' ? text : /\s$|^$/.test(text) ? text + preedit : text.replace(/\S+$/, preedit);

/** The frame of the words and the timer: the same as the selected tab of the main navigation. */
const statusFrame = 'bg-primary/15 px-3 py-1.5 text-primary';

/** Keys that do not start the timer. */
const modifierKeys = new Set(['Shift', 'Control', 'Alt', 'AltGraph', 'Meta', 'CapsLock', 'Tab', 'Escape']);

interface TypingAreaProps {
  targetWords: string[];
  /** Stops typing, e.g. while the result is being saved. */
  disabled?: boolean;
  /** Called once, with the typed words, when the last word is finished. */
  /** Called once, when the first key is pressed: the timer starts then. */
  onStart?: () => void;
  onFinish: (typedWords: string[]) => void;
  /** How long the session lasts; the page lets the learner choose less than the 3 minute maximum. */
  timeLimitSeconds?: number;
  /** Called once when time runs out and no word was finished, so there is nothing to grade. */
  onTimeUp?: () => void;
  /** Shown under the card, at its right, e.g. a Restart button. */
  actions?: ReactNode;
}

/**
 * The transparent frame with the passage (the learner types straight into it, an invisible textarea sits on top) and, at the
 * bottom of the page, the word count and the timer. Render it directly inside a flex column that fills the page. A word is finished when a space (or Enter after the last word) comes
 * after it. The text is only graded once the input method has committed it: while a composition is open (Unikey,
 * fcitx and similar can hold text back), keystrokes and the half-written text are ignored (conclusion of US2.0,
 * docs/ime-findings.md). Pasting and dropping text are blocked.
 */
interface TypingStatusProps {
  /** Words finished so far. */
  typed: number;
  total: number;
  seconds: number;
  finished: boolean;
}

/** Bottom of the page: words typed on the left, the timer in the center (the chat button floats at the right). Full screen width, not the card's. The page shows it with zeros while the next session loads, so it never disappears. */
export const TypingStatus = ({ typed, total, seconds, finished }: TypingStatusProps) => (
  <div className="relative left-1/2 grid w-screen -translate-x-1/2 grid-cols-3 items-center px-4 text-[1.125rem] md:px-8">
    <span className={`${statusFrame} justify-self-start`}>
      Words {Math.min(typed, total)} / {total}
    </span>
    {finished ? (
      <span className={`${statusFrame} flex items-center gap-2 justify-self-center font-medium`}>
        <CheckCircle2 className="size-5" /> Finished
      </span>
    ) : (
      <span aria-label="Elapsed time" className={`${statusFrame} justify-self-center`}>{formatDuration(seconds)}</span>
    )}
  </div>
);

export const TypingArea = ({ targetWords, disabled = false, onStart, onFinish, onTimeUp, timeLimitSeconds = SESSION_TIME_LIMIT_SECONDS, actions }: TypingAreaProps) => {
  const [text, setText] = useState('');
  const [committed, setCommitted] = useState('');
  const [lastWordDone, setLastWordDone] = useState(false);
  // Text the input method is still composing (e.g. "tiê" before it is committed); empty when nothing is composing.
  const [preedit, setPreedit] = useState('');
  const composing = useRef(false);
  // The timer starts at the first key, not when the page opens.
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const seconds = useElapsedSeconds(startedAt, !lastWordDone && !disabled);

  const timeIsUp = seconds >= timeLimitSeconds;
  const isFinished = lastWordDone || timeIsUp;
  const expired = useRef(false);

  const start = () => {
    if (startedAt !== null) return;
    setStartedAt(Date.now());
    onStart?.();
  };

  const { done } = useMemo(() => splitTyped(committed), [committed]);
  const results = useMemo(() => checkWords(targetWords, done), [targetWords, done]);

  // When the time limit is reached (3:00 at most) the session ends with the words finished so far (the server enforces the same limit).
  useEffect(() => {
    if (!timeIsUp || lastWordDone || expired.current) return;
    expired.current = true;
    const typedWords = splitTyped(committed).done.slice(0, targetWords.length);
    if (typedWords.length > 0) onFinish(typedWords);
    else onTimeUp?.();
  }, [timeIsUp, lastWordDone, committed, targetWords.length, onFinish, onTimeUp]);

  const commit = (value: string) => {
    setCommitted(value);
    const typedWords = splitTyped(value).done;
    if (!isFinished && typedWords.length >= targetWords.length) {
      setLastWordDone(true);
      onFinish(typedWords.slice(0, targetWords.length));
    }
  };

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    start();
    setText(event.target.value);
    if (!composing.current && !(event.nativeEvent as InputEvent).isComposing) commit(event.target.value);
  };

  const handleCompositionUpdate = (event: CompositionEvent<HTMLTextAreaElement>) => setPreedit(event.data);

  const handleCompositionEnd = (event: CompositionEvent<HTMLTextAreaElement>) => {
    composing.current = false;
    setPreedit('');
    commit(event.currentTarget.value);
  };

  // Enter closes the last word, which has no space after it. Enter inside a composition belongs to the input method.
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!modifierKeys.has(event.key)) start(); // an input method reports every key as "Process"
    if (event.key !== 'Enter' || composing.current || event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (text === '' || /\s$/.test(text)) return;
    const next = `${text} `;
    setText(next);
    commit(next);
  };

  const { current } = splitTyped(withPreedit(text, preedit));

  return (
    <>
      <div className="mx-auto my-auto w-full max-w-7xl space-y-4">
        <Card className="border-transparent bg-transparent shadow-none">
          <CardContent className="space-y-4 pt-6">
            {/* The real input is an invisible textarea laid over the passage: clicks focus it, and what is typed shows in the passage. */}
            <div className="relative">
              <PassageView words={targetWords} results={results} current={isFinished ? undefined : current} maxRows={3} />
              <textarea
                aria-label="Typing area"
                className="absolute inset-0 size-full cursor-text resize-none opacity-0"
                value={text}
                onChange={handleChange}
                onCompositionStart={() => (composing.current = true)}
                onCompositionUpdate={handleCompositionUpdate}
                onCompositionEnd={handleCompositionEnd}
                onKeyDown={handleKeyDown}
                onPaste={(event) => event.preventDefault()}
                onDrop={(event) => event.preventDefault()}
                disabled={disabled || isFinished}
                spellCheck={false}
                autoComplete="off"
                autoFocus
              />
            </div>
          </CardContent>
        </Card>
        {/* Outside the card, at its bottom right. */}
        {actions && <div className="flex justify-end">{actions}</div>}
      </div>

      <TypingStatus typed={results.length} total={targetWords.length} seconds={Math.min(seconds, timeLimitSeconds)} finished={isFinished} />
    </>
  );
};
