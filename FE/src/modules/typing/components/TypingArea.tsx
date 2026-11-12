import { CheckCircle2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, CompositionEvent, KeyboardEvent, ReactNode } from 'react';
import { Card, CardContent } from '@/shared/components/ui/card';
import type { TypingLanguage } from '@/shared/lib/typing-language';
import { useElapsedSeconds } from '../hooks/use-elapsed';
import type { ReplayEvent } from '../types/typing.types';
import { SESSION_TIME_LIMIT_SECONDS } from '../typing.config';
import { createReplayRecorder } from '../utils/session-replay';
import { checkWords, formatDuration, splitTyped } from '../utils/typing-session';
import { PassageView } from './PassageView';

/**
 * Puts the text being composed into the text. Some browsers already have it in the textarea's value (a stale copy: it
 * trails the composition by a letter), others keep it out. So it replaces the word being typed, or follows a space.
 */
const withPreedit = (text: string, preedit: string) =>
  preedit === '' ? text : /\s$|^$/.test(text) ? text + preedit : text.replace(/\S+$/, preedit);

/** The words and the timer: red text on the page itself (no background), with the padding of the tabs of the main navigation. */
const statusFrame = 'bg-transparent px-3 py-1.5 text-primary';

/** Keys that do not start the timer. */
const modifierKeys = new Set(['Shift', 'Control', 'Alt', 'AltGraph', 'Meta', 'CapsLock', 'Tab', 'Escape']);

interface TypingAreaProps {
  targetWords: string[];
  /** The rules the words are checked by while they are typed (SCRUM-219): the language of the session, Vietnamese by default. */
  language?: TypingLanguage;
  /** Stops typing, e.g. while the result is being saved. */
  disabled?: boolean;
  /** Called once, when the first key is pressed: the timer starts then. */
  onStart?: () => void;
  /**
   * Called once when the session ends, with the finished words, when each was finished (ms after the first key) and the
   * replay of what the learner saw (SCRUM-35; missing when it is too big to send).
   */
  onFinish: (typedWords: string[], typedAtMs: number[], replay?: ReplayEvent[]) => void;
  /** How long the session lasts; the page lets the learner choose less than the 3 minute maximum. */
  timeLimitSeconds?: number;
  /** Called once when time runs out and no word was finished, so there is nothing to grade. */
  onTimeUp?: () => void;
  /** Shown above the passage, at its top center, e.g. the language switch. */
  header?: ReactNode;
  /** Shown under the card, at its bottom center, e.g. a Restart button. */
  actions?: ReactNode;
  /** Shown in the row of the words and the timer, between the two, e.g. a Weak spots lesson's way back to its cards. */
  statusCenter?: ReactNode;
  /** Called each time one more word is finished (a ranked duel sends it to the server), never after the end. */
  onProgress?: (typedWords: string[], typedAtMs: number[]) => void;
  /** Words already finished (a ranked race after a reload): typing goes on after them, with later word times. */
  initialTyped?: { typedWords: string[]; typedAtMs: number[] };
}

/**
 * The transparent frame with the passage (the learner types straight into it, an invisible textarea sits on top) and, at the
 * bottom of the page, the word count and the timer. Render it directly inside a flex column that fills the page. A word is finished when a space (or Enter after the last word) comes
 * after it. The text is only graded once the input method has committed it: while a composition is open (Unikey,
 * fcitx and similar can hold text back), keystrokes and the half-written text are ignored (conclusion of US2.0,
 * docs/ime-findings.md). Pasting and dropping text are blocked. Every change of the text on screen is recorded for the
 * replay of the session (`createReplayRecorder`), which is only passed on at the end, with `onFinish`.
 */
interface TypingStatusProps {
  /** Words finished so far. */
  typed: number;
  total: number;
  seconds: number;
  finished: boolean;
  /** Between the words and the timer. */
  center?: ReactNode;
}

/** Bottom of the page: words typed on the left, the timer on the right, and `center` between them. Full screen width, not the card's. The page shows it with zeros while the next session loads, so it never disappears. */
export const TypingStatus = ({ typed, total, seconds, finished, center }: TypingStatusProps) => (
  <div data-tutorial="typing-stats" className="relative left-1/2 grid w-screen -translate-x-1/2 grid-cols-[1fr_auto_1fr] items-center px-4 text-[1.125rem] md:px-8">
    <span className={`${statusFrame} justify-self-start`}>
      Words {Math.min(typed, total)} / {total}
    </span>
    <div className="col-start-2">{center}</div>
    {finished ? (
      <span className={`${statusFrame} col-start-3 flex items-center gap-2 justify-self-end font-medium`}>
        <CheckCircle2 className="size-5" /> Finished
      </span>
    ) : (
      <span aria-label="Elapsed time" className={`${statusFrame} col-start-3 justify-self-end`}>{formatDuration(seconds)}</span>
    )}
  </div>
);

export const TypingArea = ({
  targetWords,
  language = 'vi',
  disabled = false,
  onStart,
  onFinish,
  onTimeUp,
  timeLimitSeconds = SESSION_TIME_LIMIT_SECONDS,
  header,
  actions,
  statusCenter,
  onProgress,
  initialTyped,
}: TypingAreaProps) => {
  const resumedText = initialTyped?.typedWords.length ? `${initialTyped.typedWords.join(' ')} ` : '';
  const [text, setText] = useState(resumedText);
  const [committed, setCommitted] = useState(resumedText);
  const [lastWordDone, setLastWordDone] = useState(false);
  // Text the input method is still composing (e.g. "tiê" before it is committed); empty when nothing is composing.
  const [preedit, setPreedit] = useState('');
  const composing = useRef(false);
  // The timer starts at the first key, not when the page opens.
  const [startedAt, setStartedAt] = useState<number | null>(null);
  // When each finished word was finished, in ms after the first key (only noted here, never sent while typing).
  const startTime = useRef(0);
  const wordTimes = useRef<number[]>(initialTyped?.typedAtMs.slice(0, initialTyped.typedWords.length) ?? []);
  // What the learner sees, change by change (SCRUM-35). Its first change holds the words of a resumed race.
  const [replay] = useState(createReplayRecorder);
  const elapsedMs = () => (startTime.current ? Date.now() - startTime.current : 0);
  const seconds = useElapsedSeconds(startedAt, !lastWordDone && !disabled);

  const timeIsUp = seconds >= timeLimitSeconds;
  const isFinished = lastWordDone || timeIsUp;
  const expired = useRef(false);

  const start = () => {
    if (startedAt !== null) return;
    // Resumed words keep their times: the next word comes after the last one.
    startTime.current = Date.now() - (wordTimes.current.at(-1) ?? 0);
    setStartedAt(startTime.current);
    onStart?.();
  };

  const { done } = useMemo(() => splitTyped(committed), [committed]);
  const results = useMemo(() => checkWords(targetWords, done, language), [targetWords, done, language]);

  // When the time limit is reached (3:00 at most) the session ends with the words finished so far (the server enforces the same limit).
  useEffect(() => {
    if (!timeIsUp || lastWordDone || expired.current) return;
    expired.current = true;
    const typedWords = splitTyped(committed).done.slice(0, targetWords.length);
    // The replay ends at the limit: the clock only noticed it at its next tick.
    const endMs = Math.min(Date.now() - startTime.current, timeLimitSeconds * 1000);
    if (typedWords.length > 0) onFinish(typedWords, wordTimes.current.slice(0, typedWords.length), replay.finish(endMs));
    else onTimeUp?.();
  }, [timeIsUp, lastWordDone, committed, targetWords.length, onFinish, onTimeUp, replay, timeLimitSeconds]);

  const commit = (value: string) => {
    setCommitted(value);
    const typedWords = splitTyped(value).done;
    const before = wordTimes.current.length;
    while (wordTimes.current.length < typedWords.length) wordTimes.current.push(Date.now() - startTime.current);
    // One report per newly finished word (the last one is reported by `onFinish`).
    if (!isFinished && typedWords.length > before && typedWords.length < targetWords.length) {
      onProgress?.(typedWords, wordTimes.current.slice(0, typedWords.length));
    }
    if (!isFinished && typedWords.length >= targetWords.length) {
      setLastWordDone(true);
      onFinish(typedWords.slice(0, targetWords.length), wordTimes.current.slice(0, targetWords.length), replay.finish(elapsedMs()));
    }
  };

  // Each handler records what the passage shows after it: the text with the part being composed (`withPreedit`), and
  // whether it is committed. Recorded before `commit`, which may end the session.
  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    start();
    setText(event.target.value);
    const isCommitted = !composing.current && !(event.nativeEvent as InputEvent).isComposing;
    replay.record(withPreedit(event.target.value, preedit), isCommitted, elapsedMs());
    if (isCommitted) commit(event.target.value);
  };

  const handleCompositionUpdate = (event: CompositionEvent<HTMLTextAreaElement>) => {
    setPreedit(event.data);
    replay.record(withPreedit(text, event.data), false, elapsedMs());
  };

  const handleCompositionEnd = (event: CompositionEvent<HTMLTextAreaElement>) => {
    composing.current = false;
    setPreedit('');
    replay.record(event.currentTarget.value, true, elapsedMs());
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
    replay.record(next, true, elapsedMs());
    commit(next);
  };

  const { current } = splitTyped(withPreedit(text, preedit));

  return (
    <>
      {/* Centered between the tabs and the words / clock row. From `xl` (one row of tabs) the tabs and the page padding above it are
          taller than that row, so `pb-11` lifts the passage by 22px, to the middle of the page under the header. */}
      <div className="mx-auto my-auto w-full max-w-7xl space-y-4 xl:pb-11">
        <Card className="border-transparent bg-transparent shadow-none">
          <CardContent className="space-y-4 pt-6">
            {header && <div className="flex justify-center">{header}</div>}
            {/* The real input is an invisible textarea laid over the passage: clicks focus it, and what is typed shows in the passage. */}
            <div className="relative" data-tutorial="typing-passage">
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
        {/* Outside the card, at its bottom center. */}
        {actions && <div className="flex justify-center">{actions}</div>}
      </div>

      <TypingStatus
        typed={results.length}
        total={targetWords.length}
        seconds={Math.min(seconds, timeLimitSeconds)}
        finished={isFinished}
        center={statusCenter}
      />
    </>
  );
};
