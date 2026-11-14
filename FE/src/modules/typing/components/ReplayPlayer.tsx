import { Pause, Play } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSettings } from '@/modules/settings/hooks/use-settings';
import { TabGroup } from '@/shared/components/tab-group';
import { Button } from '@/shared/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import type { TypingLanguage } from '@/shared/lib/typing-language';
import type { ReplayEvent } from '../types/typing.types';
import { decodeReplay, findHesitations, replayTextAt } from '../utils/session-replay';
import { checkWords, formatDuration, splitTyped } from '../utils/typing-session';
import { PassageView } from './PassageView';

/** The speeds to choose from; 1× is the speed the learner typed at. */
const speedTabs = [0.5, 1, 2, 4].map((speed) => ({ value: String(speed), label: `${speed}×` }));

/** How often the replay moves on while it plays. */
const TICK_MS = 50;
/** One step of the time bar with the arrow keys. */
const STEP_MS = 100;

/** "1.6 s" */
const formatPause = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

interface ReplayPlayerProps {
  /** The passage of the session. */
  targetWords: string[];
  /** The language of the session (SCRUM-219): its words are checked by its rules, Vietnamese by default. */
  language?: TypingLanguage;
  events: ReplayEvent[];
  /** When the server deletes the replay, shown at the right of the line under the bar. */
  expiresAt?: string;
}

/**
 * Plays a typing session back as it was typed (SCRUM-35): the passage shows what the learner saw at each moment, on three
 * lines like the typing area. It starts at once; under it are Play / Pause, the time, a time bar to move in the replay and
 * the speed. A mark on the bar is a place where the learner hesitated (`findHesitations`): hovering it tells how long and
 * on which word, clicking it goes there.
 */
export const ReplayPlayer = ({ targetWords, language = 'vi', events, expiresAt }: ReplayPlayerProps) => {
  // The passage text size the learner chose in Settings (SCRUM-158).
  const { typingFontSizeRem } = useSettings();
  const replay = useMemo(() => decodeReplay(events), [events]);
  const { thresholdMs, hesitations } = useMemo(() => findHesitations(replay), [replay]);
  const [positionMs, setPositionMs] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const ended = positionMs >= replay.durationMs;
  const isPlaying = playing && !ended;

  // While it plays, the position follows the clock at the chosen speed, up to the end.
  useEffect(() => {
    if (!isPlaying) return;
    let last = Date.now();
    const timer = window.setInterval(() => {
      const now = Date.now();
      const step = (now - last) * speed;
      last = now;
      setPositionMs((position) => Math.min(replay.durationMs, position + step));
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [isPlaying, speed, replay.durationMs]);

  const { shown, committed } = useMemo(() => replayTextAt(replay, positionMs), [replay, positionMs]);
  // Graded again only when what is committed changes, not at every tick.
  const results = useMemo(() => checkWords(targetWords, splitTyped(committed).done, language), [targetWords, committed, language]);

  // Play at the end starts again from the beginning.
  const togglePlay = () => {
    if (ended) setPositionMs(0);
    setPlaying(ended || !playing);
  };
  const seek = (ms: number) => setPositionMs(Math.min(Math.max(ms, 0), replay.durationMs));
  const share = (ms: number) => `${replay.durationMs > 0 ? (ms / replay.durationMs) * 100 : 100}%`;
  const clock = (ms: number) => formatDuration(ms / 1000);

  return (
    <div className="space-y-6">
      {/* Like the typing area: no caret once the replay is over. */}
      <PassageView words={targetWords} results={results} current={ended ? undefined : splitTyped(shown).current} maxRows={3} fontSizeRem={typingFontSizeRem} />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <Button variant="ghost" size="sm" aria-label={isPlaying ? 'Pause' : 'Play'} onClick={togglePlay}>
          {isPlaying ? <Pause className="size-5" /> : <Play className="size-5" />}
        </Button>
        <span className="text-[1.125rem] tabular-nums text-muted-foreground">
          {clock(positionMs)} / {clock(replay.durationMs)}
        </span>
        {/* The time bar: the part played in red. An invisible range input lies over it (clicks, drags and the arrow keys
            move the replay), and the hesitation marks lie over that. On a phone it takes a line of its own, at the bottom. */}
        <div className="relative order-last h-6 basis-full has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring sm:order-none sm:flex-1 sm:basis-auto">
          <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 bg-muted">
            <div className="h-full bg-primary" style={{ width: share(positionMs) }} />
          </div>
          <input
            type="range"
            aria-label="Replay position"
            aria-valuetext={`${clock(positionMs)} of ${clock(replay.durationMs)}`}
            min={0}
            // Whole steps up to the end or past it, so the end can be reached.
            max={Math.ceil(replay.durationMs / STEP_MS) * STEP_MS}
            step={STEP_MS}
            value={positionMs}
            onChange={(event) => seek(Number(event.target.value))}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
          <TooltipProvider delayDuration={200}>
            {hesitations.map((pause) => {
              const where = `${formatPause(pause.ms)} on “${targetWords[pause.wordIndex] ?? ''}”`;
              return (
                <Tooltip key={pause.atMs}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label={`Hesitation at ${clock(pause.atMs)}: ${where}`}
                      onClick={() => seek(pause.atMs)}
                      className="group absolute top-0 flex h-6 w-3 -translate-x-1/2 justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      style={{ left: share(pause.atMs) }}
                    >
                      <span className="mt-1 h-4 w-1 bg-foreground transition-colors group-hover:bg-primary" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Stopped {where}</TooltipContent>
                </Tooltip>
              );
            })}
          </TooltipProvider>
        </div>
        <TabGroup label="Speed" tabs={speedTabs} value={String(speed)} onChange={(value) => setSpeed(Number(value))} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-base text-muted-foreground">
        <p className="flex items-center gap-2">
          <span aria-hidden className="h-4 w-1 shrink-0 bg-foreground" />
          {hesitations.length === 0
            ? `No hesitation: you never stopped ${formatPause(thresholdMs)} or more.`
            : `${hesitations.length} ${hesitations.length === 1 ? 'hesitation' : 'hesitations'}: stops of ${formatPause(thresholdMs)} or more.`}
        </p>
        {expiresAt && (
          <p>Kept until {new Date(expiresAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
        )}
      </div>
    </div>
  );
};
