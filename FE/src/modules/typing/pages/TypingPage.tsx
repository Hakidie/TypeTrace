import { Gamepad2, RotateCcw, Trophy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import type { AfterLoginState } from '@/modules/auth/utils/home-path';
import { useStartTutorial } from '@/modules/tutorial/hooks/use-tutorial';
import { RankMode } from '@/modules/ranked/components/RankMode';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { TabGroup } from '@/shared/components/tab-group';
import { Button } from '@/shared/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { cn } from '@/shared/lib/utils';
import { redGlassTheme } from '@/shared/lib/red-glass-theme';
import { MinigamesMode, type MinigameId } from '../components/MinigamesMode';
import { TypingArea, TypingStatus } from '../components/TypingArea';
import { useBeginSession, useCompleteSession, usePassageOptions, useStartSession } from '../hooks/use-typing';
import type { SessionMode } from '../types/typing.types';
import { modeIcons } from '../typing.config';

// Same frame as the chat button and the word count / timer at the bottom of the page. The name is as wide as its text up to 12rem; a longer one stays on one line and is cut off.
const chipClass = 'max-w-48 min-w-0 px-3 py-1.5 text-[1.125rem] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring enabled:hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50';

// Rank and Minigames are not practice sessions: `?mode=rank` shows the ranked duels (`RankMode`), `?mode=minigames` the cards of the minigames (`MinigamesMode`; `&game=rain` opens word rain, `&game=daily` the daily challenge, which starts its own tries), instead of a passage to practise.
const modeTabs = [
  { value: 'practice', label: 'Practice', icon: modeIcons.practice },
  { value: 'placement', label: 'Placement', icon: modeIcons.placement },
  { value: 'rank', label: 'Rank', icon: Trophy },
  { value: 'minigames', label: 'Minigames', icon: Gamepad2 },
];

// The time choices set how long a session lasts. The button next to them switches between seconds and minutes; the
// second choice (20 seconds) is the one selected at first; the longest, 3 minutes, is the most the server accepts.
type TimeUnit = 'sec' | 'min';
const timeChoices: Record<TimeUnit, number[]> = { sec: [10, 20, 30], min: [1, 2, 3] };
const unitLabels: Record<TimeUnit, string> = { sec: 'Sec', min: 'Min' };

/** The passages to choose from for `mode`; the picked one is red. It is only mounted while the menu is open, so the list is fetched when the learner opens it. */
const PassageMenu = ({ mode, selectedId, onSelect }: { mode: SessionMode; selectedId?: string; onSelect: (id: string) => void }) => {
  const { data, isLoading, isError } = usePassageOptions(mode);
  if (isLoading) return <p className="px-2 py-1.5 text-base text-muted-foreground">Loading…</p>;
  if (isError) return <p className="px-2 py-1.5 text-base text-destructive">Could not load passages</p>;
  if (!data?.length) return <p className="px-2 py-1.5 text-base text-muted-foreground">No passages</p>;
  return (
    <>
      {data.map((passage) => (
        <DropdownMenuItem
          key={passage._id}
          role="menuitemradio"
          aria-checked={passage._id === selectedId}
          className={cn('gap-2', passage._id === selectedId && 'text-primary')}
          onClick={() => onSelect(passage._id)}
        >
          <span className="truncate">{passage.title}</span>
          <span className="ml-auto shrink-0 pl-4 text-sm text-muted-foreground">{passage.wordCount} words</span>
        </DropdownMenuItem>
      ))}
    </>
  );
};

// Same look as the login and register pages (shared/lib/red-glass-theme.ts). The passage shows as soon as the page
// opens; the timer starts at the first key (TypingArea tells the server through `begin`).
export const TypingPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  // `/typing?mode=placement` types the placement test passage (Start on the placement intro page opens it).
  const mode: SessionMode = searchParams.get('mode') === 'placement' ? 'placement' : 'practice';
  const ranked = searchParams.get('mode') === 'rank';
  // `?mode=rain` and `?mode=daily` are the old links of the two minigames: they open the same game and are rewritten below.
  const modeParam = searchParams.get('mode');
  const legacyGame: MinigameId | undefined = modeParam === 'rain' || modeParam === 'daily' ? modeParam : undefined;
  const minigames = modeParam === 'minigames' || legacyGame !== undefined;
  const gameParam = searchParams.get('game');
  const minigame: MinigameId | undefined = legacyGame ?? (minigames && (gameParam === 'rain' || gameParam === 'daily') ? gameParam : undefined);
  /** A tab without a typing session, a passage to choose or a time limit. */
  const game = ranked || minigames;
  const pageRef = useRef<HTMLDivElement>(null);
  // Asks before the placement test when the learner picks the Placement tab. Cancel (or closing it) stays in practice.
  const [placementPrompt, setPlacementPrompt] = useState({ open: false });
  // A learner who has just created their account starts Ping's tour (it brings the placement test in its turn), once:
  // the state leaves the history entry at once, so a reload or Back does not start it again.
  const { mutate: startTutorial } = useStartTutorial();
  useEffect(() => {
    if (!(location.state as AfterLoginState | null)?.newAccount) return;
    navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null });
    startTutorial();
  }, [location, navigate, startTutorial]);
  const [timeUnit, setTimeUnit] = useState<TimeUnit>('sec');
  const [timeIndex, setTimeIndex] = useState(1);
  const timeSeconds = timeChoices[timeUnit][timeIndex] * (timeUnit === 'min' ? 60 : 1);
  const timeTabs = timeChoices[timeUnit].map((n) => ({ value: String(n), label: String(n).padStart(2, '0') }));
  const start = useStartSession();
  const begin = useBeginSession();
  const complete = useCompleteSession();
  const session = start.data;
  // The passage picked in the menu, for the mode it was picked in: switching the mode goes back to Random. Random lights up
  // when nothing is picked, the passage name otherwise. `/typing?passage=<id>` (Practice on the Passages page) picks a
  // practice passage before the page opens.
  const [chosen, setChosen] = useState<{ mode: SessionMode; id: string } | undefined>(() => {
    const id = searchParams.get('passage');
    return id ? { mode: 'practice', id } : undefined;
  });
  // The pick is dropped when the mode changes, so it stays Random on the way back to the mode it was made in.
  const [modeOfChoice, setModeOfChoice] = useState(mode);
  if (modeOfChoice !== mode) {
    setModeOfChoice(mode);
    setChosen(undefined);
  }
  const passageId = chosen?.mode === mode ? chosen.id : undefined;
  const randomPassage = passageId === undefined;

  useEffect(() => {
    if (legacyGame) setSearchParams({ mode: 'minigames', game: legacyGame }, { replace: true });
  }, [legacyGame, setSearchParams]);

  // `?passage=` is read once, above: take it out of the URL, so a reload after Random or another pick does not go back
  // to it (and a passage deleted since then does not fail again).
  useEffect(() => {
    if (!searchParams.has('passage')) return;
    setSearchParams(
      (params) => {
        params.delete('passage');
        return params;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams]);

  // `start.data` is empty while the next passage loads; the name keeps showing the current one until the new one arrives.
  const [passageTitle, setPassageTitle] = useState<string>();
  if (session && session.passageTitle !== passageTitle) setPassageTitle(session.passageTitle);

  // A new session when the page opens or the mode changes (once per mode, even when React runs effects twice in development).
  // The first one types the passage from the URL, if any; switching the mode starts a random one.
  const openedFor = useRef<SessionMode | null>(null);
  useEffect(() => {
    // Rank and the minigames have no typing session of their own (a duel is a match on the server, a rain round stays in the browser, a daily try starts its own).
    if (game || openedFor.current === mode) return;
    const firstOpen = openedFor.current === null;
    openedFor.current = mode;
    start.mutate(firstOpen && passageId ? { mode, passageId } : { mode });
  }, [mode, game, start, passageId]);

  // A new session on the picked passage (a random one when none is picked): used by Restart and when the time is up.
  const restart = () => start.mutate({ mode, passageId });
  const pick = (id: string | undefined) => {
    setChosen(id ? { mode, id } : undefined);
    start.mutate({ mode, passageId: id });
  };

  // The time limit changes for the passage on screen: no new session and no new random passage.
  const pickTime = (unit: TimeUnit, index: number) => {
    setTimeUnit(unit);
    setTimeIndex(index);
  };

  const finish = (typedWords: string[], typedAtMs: number[]) => {
    if (!session) return;
    complete.mutate(
      { id: session._id, typedWords, typedAtMs, timeLimitSeconds: timeSeconds },
      { onSuccess: (done) => navigate(`/typing/result/${done._id}`) },
    );
  };

  return (
    <div ref={pageRef} className={cn('flex flex-1 flex-col p-4 pb-0 pt-0 md:p-8 md:pb-0 md:pt-0', ranked ? 'gap-24' : 'gap-4', redGlassTheme)}>
      {/* Top center: the name of the passage being typed on the left, the mode tabs in the exact center of the page and the time tabs on the right. */}
      <div data-tutorial="mode-tabs" className="flex flex-col items-center gap-2 md:grid md:gap-x-2 md:grid-cols-[1fr_auto_1fr]">
        <div className="flex min-w-0 max-w-full md:justify-self-end">
          {/* The menu opens under the whole frame (name and Random) and is as wide as it. Not in Rank (the room picks the passage) or Minigames. */}
          {!game && (
          <DropdownMenu>
            <div className="flex outline outline-1 -outline-offset-1 outline-border">
              <DropdownMenuTrigger disabled={complete.isPending} title={passageTitle} aria-label="Choose passage" className={cn(chipClass, randomPassage ? 'text-muted-foreground' : 'text-primary')}>
                <span className="truncate">{passageTitle ?? '—'}</span>
              </DropdownMenuTrigger>
              <button
                type="button"
                onClick={() => pick(undefined)}
                disabled={start.isPending || complete.isPending}
                className={cn(
                  'inline-flex shrink-0 items-center gap-2 whitespace-nowrap px-3 py-1.5 text-[1.125rem] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
                  randomPassage ? 'text-primary' : 'text-muted-foreground enabled:hover:bg-muted enabled:hover:text-foreground',
                )}
              >
                Random
              </button>
            </div>
            {/* The page theme tints --color-background; the menu keeps the normal one, like the Sort and Filter menus. */}
            <DropdownMenuContent role="menu" aria-label="Passages" className="max-h-72 w-full min-w-0 overflow-y-auto [--color-background:var(--background)]">
              <PassageMenu mode={mode} selectedId={passageId} onSelect={pick} />
            </DropdownMenuContent>
          </DropdownMenu>
          )}
        </div>
        <TabGroup
          label="Mode"
          tabs={modeTabs}
          value={ranked ? 'rank' : minigames ? 'minigames' : mode}
          onChange={(value) => {
            if (value === 'practice') setSearchParams({});
            else if (value === 'rank') {
              if (!ranked) setSearchParams({ mode: 'rank' });
            }
            else if (value === 'minigames') {
              if (!minigames) setSearchParams({ mode: 'minigames' });
            }
            else if (value !== mode || game) setPlacementPrompt({ open: true });
          }}
        />
        <div className="md:justify-self-start">
          {/* Not in Rank (a duel lasts the time the server gives it) or a minigame (a Rain round lasts a minute). */}
          <div className={cn('flex outline outline-1 -outline-offset-1 outline-border', game && 'hidden')}>
            <TabGroup
              label="Time"
              framed={false}
              tabs={timeTabs}
              value={timeTabs[timeIndex].value}
              onChange={(value) => pickTime(timeUnit, timeTabs.findIndex((tab) => tab.value === value))}
            />
            <button
              type="button"
              aria-label="Switch between seconds and minutes"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pickTime(timeUnit === 'sec' ? 'min' : 'sec', timeIndex)}
              className="inline-flex items-center px-3 py-1.5 text-[1.125rem] text-primary transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {unitLabels[timeUnit]}
            </button>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={placementPrompt.open}
        onOpenChange={(open) => setPlacementPrompt({ open })}
        title="Start the placement test?"
        description="Your result is saved and counts toward your all-time average WPM and accuracy. Press Start to begin, or Cancel to go back to practice."
        confirmLabel="Start"
        cancelLabel="Cancel"
        // Back to the typing area, so the learner can type at once (a new session's area takes the focus itself when it opens).
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          pageRef.current?.querySelector('textarea')?.focus();
        }}
        onConfirm={() => {
          setPlacementPrompt({ open: false });
          setSearchParams({ mode: 'placement' });
        }}
      />
      {minigames ? (
        <MinigamesMode
          game={minigame}
          onSelect={(id) => setSearchParams({ mode: 'minigames', game: id })}
          onBack={() => setSearchParams({ mode: 'minigames' })}
        />
      ) : ranked ? (
        <RankMode />
      ) : session ? (
        <TypingArea
          key={session._id}
          targetWords={session.targetWords}
          disabled={complete.isPending}
          onStart={() => begin.mutate(session._id)}
          onFinish={finish}
          timeLimitSeconds={timeSeconds}
          onTimeUp={restart}
          actions={
            <Button
              variant="ghost"
              className="h-auto gap-2 px-4 py-2 text-[1.125rem] text-muted-foreground"
              onClick={restart}
              disabled={start.isPending || complete.isPending}
            >
              <RotateCcw className="size-5" /> Restart
            </Button>
          }
        />
      ) : (
        <>
          <div className="mx-auto my-auto w-full max-w-7xl">
            {start.isError ? <ErrorState error={start.error} onRetry={restart} /> : <LoadingState rows={2} />}
          </div>
          {/* The words and the clock stay while the next session loads. */}
          <TypingStatus typed={0} total={0} seconds={0} finished={false} />
        </>
      )}
    </div>
  );
};
