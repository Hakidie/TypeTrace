import { ArrowLeft, Gamepad2, Languages, Lock, RotateCcw, Trophy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import type { AfterLoginState } from '@/modules/auth/utils/home-path';
import { useStartTutorial } from '@/modules/tutorial/hooks/use-tutorial';
import { RankMode } from '@/modules/ranked/components/RankMode';
import { PlanDialog } from '@/modules/plan/components/PlanDialog';
import { usePlan } from '@/modules/plan/hooks/use-plan';
import { useSaveTypingLanguage, useTypingLanguage } from '@/modules/profile/hooks/use-profile';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { TabGroup } from '@/shared/components/tab-group';
import { Button } from '@/shared/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { cn } from '@/shared/lib/utils';
import { redGlassTheme } from '@/shared/lib/red-glass-theme';
import { type TypingLanguage } from '@/shared/lib/typing-language';
import { WordError, type WordErrorType } from '@/shared/lib/vietnamese-errors';
import { MinigamesMode, type MinigameId } from '../components/MinigamesMode';
import { TypingArea, TypingStatus } from '../components/TypingArea';
import { WeakSpotsMode, type WeakSpotsFocus } from '../components/WeakSpotsMode';
import { useBeginSession, useCompleteSession, usePassageOptions, useStartSession } from '../hooks/use-typing';
import type { ReplayEvent, SessionMode, StartSessionInput } from '../types/typing.types';
import { errorLabels, languageNames, modeIcons, modeLabels, SESSION_TIME_LIMIT_SECONDS } from '../typing.config';

// The buttons around the passage: the language switch, Restart, and in a Weak spots lesson the way back to its cards.
const actionClass = 'h-auto gap-2 px-4 py-2 text-[1.125rem] text-muted-foreground';

// Same frame as the chat button and the word count / timer at the bottom of the page. The name is as wide as its text up to 12rem; a longer one stays on one line and is cut off.
const chipClass = 'max-w-48 min-w-0 px-3 py-1.5 text-[1.125rem] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring enabled:hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50';

// Rank and Minigames are not practice sessions: `?mode=rank` shows the ranked duels (`RankMode`), `?mode=minigames` the cards of the minigames (`MinigamesMode`; `&game=rain` opens word rain, `&game=bot` the unrated duel against a bot, `&game=chain` Nối từ), instead of a passage to practise.
// `?mode=targeted` is Weak spots: its cards (`WeakSpotsMode`: the auto lesson, US3.2, and the five error types, SCRUM-74) until
// one is picked, then its lesson (`&focus=auto` or `&focus=<type>`), a passage the AI wrote from words picked for the errors.
const modeTabs = [
  { value: 'practice', label: 'Practice', icon: modeIcons.practice },
  { value: 'placement', label: 'Placement', icon: modeIcons.placement },
  { value: 'rank', label: 'Rank', icon: Trophy },
  { value: 'targeted', label: modeLabels.targeted, icon: modeIcons.targeted },
  { value: 'minigames', label: 'Minigames', icon: Gamepad2 },
];


const IME_HINT = 'Turn off Vietnamese input (Unikey, EVKey) to type English.';
const IME_HINT_ID = 'ime-hint';

// The time choices set how long a session lasts. The button next to them switches between seconds and minutes; the
// second choice (20 seconds) is the one selected at first in Practice, 1 minute in the placement test and Weak spots
// (`defaultTimeOf`); the longest, 3 minutes, is the most the server accepts.
type TimeUnit = 'sec' | 'min';
const timeChoices: Record<TimeUnit, number[]> = { sec: [10, 20, 30], min: [1, 2, 3] };
const unitLabels: Record<TimeUnit, string> = { sec: 'Sec', min: 'Min' };

/**
 * The time selected when a mode opens: 20 seconds in Practice; 1 minute in the placement test and in Weak spots, whose lesson
 * (30 to 50 words) needs it: under 20 words a session is not counted in the error profile it aims to improve. The learner can
 * change it afterwards.
 */
const defaultTimeOf = (mode: SessionMode): { unit: TimeUnit; index: number } =>
  mode === 'placement' || mode === 'targeted' ? { unit: 'min', index: 0 } : { unit: 'sec', index: 1 };

/** The passages to choose from for `mode` (in Practice, of `language`); the picked one is red. It is only mounted while the menu is open, so the list is fetched when the learner opens it. */
const PassageMenu = ({
  mode,
  language,
  selectedId,
  onSelect,
  onNeedPremium,
}: {
  mode: SessionMode;
  language: TypingLanguage;
  selectedId?: string;
  onSelect: (id: string) => void;
  /** Called for a passage the plan does not allow (US11.1): the page opens the plan instead of starting it. */
  onNeedPremium: () => void;
}) => {
  const { data, isLoading, isError } = usePassageOptions(mode, { language });
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
          // A passage past the owner's limit cannot be picked; one locked by the plan opens the plan (US11.1).
          aria-disabled={passage.locked ? true : undefined}
          className={cn('gap-2', passage._id === selectedId && 'text-primary', (passage.locked || passage.lockedByPlan) && 'opacity-60')}
          onClick={(event) => {
            if (passage.locked) return event.preventDefault();
            if (passage.lockedByPlan) return onNeedPremium();
            onSelect(passage._id);
          }}
        >
          <span className="truncate">{passage.title}</span>
          {(passage.locked || passage.lockedByPlan) && (
            <span className="inline-flex shrink-0 items-center gap-1 text-sm text-muted-foreground">
              <Lock className="size-3.5" aria-hidden />
              {passage.locked ? 'Locked' : 'Premium'}
            </span>
          )}
          <span className="ml-auto shrink-0 pl-4 text-sm text-muted-foreground">{passage.wordCount} words</span>
        </DropdownMenuItem>
      ))}
    </>
  );
};

/** The Weak spots card picked (`&focus=`): `auto` or one error type; anything else is no pick (the cards show). */
const focusOf = (value: string | null): WeakSpotsFocus | undefined =>
  value === 'auto' || (Object.values(WordError) as string[]).includes(value ?? '') ? (value as WeakSpotsFocus) : undefined;

/** What Weak spots says above the lesson: the error types it trains, or why a random passage came instead (US3.2). */
const FocusNote = ({ focus, chosen }: { focus: WordErrorType[]; chosen?: WordErrorType }) => (
  <p role="status" className="text-center text-muted-foreground">
    {focus.length ? (
      <>
        Training: <span className="text-primary">{focus.map((type) => errorLabels[type]).join(' · ')}</span>
      </>
    ) : chosen ? (
      `There are no words for ${errorLabels[chosen]} yet, so here is a random passage.`
    ) : (
      'Your error profile does not have enough data yet, so here is a random passage. Train aims at your errors once your counted sessions give it some.'
    )}
  </p>
);

/**
 * The placement leaderboard ranks only the time the session was started with (US10.1), so a placement session carries it. A
 * Weak spots lesson carries the error type the learner chose, if any.
 */
const startInputOf = (mode: SessionMode, passageId: string | undefined, seconds: number, errorType?: WordErrorType): StartSessionInput => ({
  mode,
  ...(passageId && { passageId }),
  ...(mode === 'placement' && { timeLimitSeconds: seconds }),
  ...(errorType && { errorType }),
});

// Same look as the login and register pages (shared/lib/red-glass-theme.ts). The passage shows as soon as the page
// opens; the timer starts at the first key (TypingArea tells the server through `begin`).
export const TypingPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const modeParam = searchParams.get('mode');
  // `/typing?mode=placement` types the placement test passage (Start on the placement intro page opens it), `?mode=targeted` a Weak spots lesson.
  const mode: SessionMode = modeParam === 'placement' || modeParam === 'targeted' ? modeParam : 'practice';
  const targeted = mode === 'targeted';
  // Weak spots shows its cards until one is picked: `&focus=auto` is the auto lesson (US3.2), `&focus=<type>` one error type (SCRUM-74).
  const focus = targeted ? focusOf(searchParams.get('focus')) : undefined;
  const weakSpotsCards = targeted && focus === undefined;
  const errorType = focus && focus !== 'auto' ? focus : undefined;
  const ranked = modeParam === 'rank';
  // `?mode=rain` is the old link of word rain: it opens the same game and is rewritten below. The old `?mode=daily` opens Practice, where the daily reward now is.
  const legacyGame: MinigameId | undefined = modeParam === 'rain' ? modeParam : undefined;
  const minigames = modeParam === 'minigames' || legacyGame !== undefined;
  const gameParam = searchParams.get('game');
  const minigame: MinigameId | undefined = legacyGame ?? (minigames && (gameParam === 'rain' || gameParam === 'bot' || gameParam === 'chain') ? gameParam : undefined);
  /** A tab without a typing session, a passage to choose or a time limit. */
  const game = ranked || minigames;
  const pageRef = useRef<HTMLDivElement>(null);
  // Asks before the placement test when the learner picks the Placement tab. Cancel (or closing it) stays in practice.
  const [placementPrompt, setPlacementPrompt] = useState({ open: false });
  // The plan (US11.1), opened by a passage the plan does not allow, or by a Weak spots card on a plan without it (US3.2).
  const [planOpen, setPlanOpen] = useState(false);
  // Weak spots needs `canCreateErrorPractice` (Premium): its cards show a lock. Its lesson waits for the plan, so a plan
  // without it shows the plan instead of a 403 and its toast; if the plan cannot be read, the server decides.
  const plan = usePlan();
  const weakSpotsLocked = plan.data !== undefined && !plan.data.canCreateErrorPractice;
  const planPending = plan.isPending;
  // What the learner types in Practice (SCRUM-219), saved on their account; `undefined` while the user loads. The server
  // starts a Practice session in it, and the placement test and Weak spots always in Vietnamese.
  const language = useTypingLanguage();
  const { mutate: saveLanguage, isPending: savingLanguage } = useSaveTypingLanguage();
  // A learner who has just created their account starts Ping's tour (it brings the placement test in its turn), once:
  // the state leaves the history entry at once, so a reload or Back does not start it again.
  const { mutate: startTutorial } = useStartTutorial();
  useEffect(() => {
    if (!(location.state as AfterLoginState | null)?.newAccount) return;
    navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null });
    startTutorial();
  }, [location, navigate, startTutorial]);
  const [timeUnit, setTimeUnit] = useState<TimeUnit>(() => defaultTimeOf(mode).unit);
  const [timeIndex, setTimeIndex] = useState(() => defaultTimeOf(mode).index);
  const timeSeconds = timeChoices[timeUnit][timeIndex] * (timeUnit === 'min' ? 60 : 1);
  // The unit button only changes the times shown; the time (and in Placement the session) changes when a specific time is picked.
  const [shownUnit, setShownUnit] = useState<TimeUnit>();
  const tabsUnit = shownUnit ?? timeUnit;
  const timeTabs = timeChoices[tabsUnit].map((n) => ({ value: String(n), label: String(n).padStart(2, '0') }));
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
  // The pick is dropped when the mode changes, so it stays Random on the way back to the mode it was made in; the time goes back to the default of the mode too.
  const [modeOfChoice, setModeOfChoice] = useState(mode);
  if (modeOfChoice !== mode) {
    setModeOfChoice(mode);
    setChosen(undefined);
    // Each mode opens with its own time: 1 minute for the placement test and Weak spots, 20 seconds for Practice.
    setTimeUnit(defaultTimeOf(mode).unit);
    setTimeIndex(defaultTimeOf(mode).index);
    setShownUnit(undefined);
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

  // A new session when the page opens or the mode changes (once per mode, even when React runs effects twice in development),
  // and in Weak spots when a card is picked (once per pick). The first one types the passage from the URL, if any; switching
  // the mode starts a random one.
  const startInput = (id: string | undefined, seconds: number) => startInputOf(mode, id, seconds, errorType);
  const sessionKey = targeted ? `targeted:${focus}` : mode;
  const openedFor = useRef<string | null>(null);
  useEffect(() => {
    // Rank and the minigames have no typing session of their own (a duel is a match on the server, a rain round stays in the browser).
    if (game) return;
    // The Weak spots cards start nothing; a card picked again after them starts a new lesson.
    if (weakSpotsCards) {
      openedFor.current = 'targeted:cards';
      return;
    }
    // Weak spots waits for the plan, and on a plan without it shows the plan instead.
    if (openedFor.current === sessionKey || (targeted && (planPending || weakSpotsLocked))) return;
    const firstPassage = openedFor.current === null ? passageId : undefined;
    // A passage of the Passages page (`?passage=`) is Vietnamese (SCRUM-219): a learner who types English is switched back
    // to Vietnamese first, or the server would refuse it. That waits for the user, to know their language.
    if (firstPassage && mode === 'practice' && language !== 'vi') {
      if (language === undefined) return;
      openedFor.current = sessionKey;
      saveLanguage('vi', {
        onSuccess: () => start.mutate(startInputOf(mode, firstPassage, timeSeconds)),
        // Not saved (the toast says why): a random passage of the language the learner still has.
        onError: () => {
          setChosen(undefined);
          start.mutate(startInputOf(mode, undefined, timeSeconds));
        },
      });
      return;
    }
    openedFor.current = sessionKey;
    start.mutate(startInputOf(mode, firstPassage, timeSeconds, errorType));
  }, [mode, game, weakSpotsCards, sessionKey, targeted, errorType, start, passageId, timeSeconds, planPending, weakSpotsLocked, language, saveLanguage]);

  // The placement test and Weak spots are Vietnamese only (SCRUM-219; the Weak spots lessons are made of the Vietnamese word
  // bank): whichever way the learner comes in (the tab, Ping's tour, a link), a learner who types English is switched back to
  // Vietnamese, saved on the account. Once per visit of one of them. The Weak spots tab stays shown in English, so the learner
  // always sees it; the server types its lessons in Vietnamese anyway.
  const vietnameseOnly = mode === 'placement' || targeted;
  const switchedToVietnamese = useRef(false);
  useEffect(() => {
    if (!vietnameseOnly) {
      switchedToVietnamese.current = false;
      return;
    }
    if (language !== 'en' || switchedToVietnamese.current) return;
    switchedToVietnamese.current = true;
    saveLanguage('vi');
  }, [vietnameseOnly, language, saveLanguage]);

  // VI / EN in Practice: saved on the account first (the server starts a session in the saved language), then a new random
  // passage of that language, as Random does. The session being typed is left, like on Random.
  const switchLanguage = (next: TypingLanguage) => {
    if (next === language) return;
    saveLanguage(next, {
      onSuccess: () => {
        setChosen(undefined);
        start.mutate(startInputOf(mode, undefined, timeSeconds));
      },
    });
  };
  // The language switch, Practice only (the placement test and Weak spots are always Vietnamese): one button, built like
  // Restart, at the top center of the passage. It shows the language being typed and a click switches to the other one.
  // Also shown while the passage loads or fails, so a language with no passage can be left.
  const current = language ?? 'vi';
  const other: TypingLanguage = current === 'vi' ? 'en' : 'vi';
  const languageSwitch =
    mode === 'practice' && !game ? (
      <Button
        variant="ghost"
        className={actionClass}
        aria-label={`Typing language: ${languageNames[current]}. Switch to ${languageNames[other]}`}
        onClick={() => switchLanguage(other)}
        disabled={language === undefined || savingLanguage || start.isPending || complete.isPending}
      >
        <Languages className="size-5" /> {languageNames[current]}
      </Button>
    ) : undefined;

  // An input method for Vietnamese (Telex, VNI) turns English words into Vietnamese ones ("dd" into "đ"): a notification
  // while the learner types English in Practice, with one id so it never stacks, taken back when the language or mode changes.
  const imeHint = mode === 'practice' && !game && language === 'en';
  useEffect(() => {
    if (!imeHint) return;
    toast.info(IME_HINT, { id: IME_HINT_ID, duration: 8000 });
    return () => {
      toast.dismiss(IME_HINT_ID);
    };
  }, [imeHint]);

  // The Placement tab is hidden while the learner types English; it comes back with VI (or while the test is open).
  const tabs = language === 'en' && mode !== 'placement' ? modeTabs.filter((tab) => tab.value !== 'placement') : modeTabs;

  // A new session on the picked passage (a random one when none is picked; a new lesson in Weak spots): used by Restart and when the time is up.
  const restart = () => start.mutate(startInput(passageId, timeSeconds));
  const pick = (id: string | undefined) => {
    setChosen(id ? { mode, id } : undefined);
    start.mutate(startInput(id, timeSeconds));
  };
  // A Weak spots card: its lesson, or the plan for a plan without Weak spots.
  const pickWeakSpot = (picked: WeakSpotsFocus) => (weakSpotsLocked ? setPlanOpen(true) : setSearchParams({ mode: 'targeted', focus: picked }));
  const backToWeakSpots = () => setSearchParams({ mode: 'targeted' });

  // The time limit changes for the passage on screen: no new random passage. In Placement the time belongs to the session (US10.1),
  // so a new time starts a new session (a new random passage, or the one picked in the menu); the old one is abandoned and the server deletes it after 24 hours.
  const pickTime = (unit: TimeUnit, index: number) => {
    setTimeUnit(unit);
    setTimeIndex(index);
    setShownUnit(undefined);
    const seconds = timeChoices[unit][index] * (unit === 'min' ? 60 : 1);
    if (mode === 'placement' && seconds !== timeSeconds) start.mutate(startInput(passageId, seconds));
  };

  const finish = (typedWords: string[], typedAtMs: number[], replay?: ReplayEvent[]) => {
    if (!session) return;
    complete.mutate(
      { id: session._id, typedWords, typedAtMs, timeLimitSeconds: timeSeconds, replay },
      { onSuccess: (done) => navigate(`/typing/result/${done._id}`) },
    );
  };

  return (
    <div ref={pageRef} className={cn('flex flex-1 flex-col p-4 pb-0 pt-0 md:p-8 md:pb-0 md:pt-0', ranked ? 'gap-24' : 'gap-4', redGlassTheme)}>
      {/* Top center: the name of the passage being typed on the left, the mode tabs in the exact center of the page and the time tabs on the right.
          On one row from `xl` only: below it the three do not fit side by side (the mode tabs alone are about 490px), so they are stacked and centered, as on phones.
          `[&>*]:min-w-0` lets the frame of the passage shrink to its column (or the screen): the passage name is cut first. */}
      <div data-tutorial="mode-tabs" className="flex flex-col items-center gap-2 xl:grid xl:gap-x-2 xl:grid-cols-[1fr_auto_1fr]">
        <div className="flex min-w-0 max-w-full xl:justify-self-end [&>*]:min-w-0">
          {/* The menu opens under the whole frame (name and Random) and is as wide as it. Not in Rank (the room picks the passage) or Minigames.
              A Weak spots lesson shows only its name: its card is its choice, and the ways back to the cards are the Weak spots tab
              and the button under the passage. */}
          {targeted && !weakSpotsCards && (
            <div className="flex min-w-0 outline outline-1 -outline-offset-1 outline-border">
              <span className={cn(chipClass, 'truncate text-primary')}>{passageTitle ?? '—'}</span>
            </div>
          )}
          {!game && !targeted && (
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
              <PassageMenu mode={mode} language={language ?? 'vi'} selectedId={passageId} onSelect={pick} onNeedPremium={() => setPlanOpen(true)} />
            </DropdownMenuContent>
          </DropdownMenu>
          )}
        </div>
        <TabGroup
          label="Mode"
          // Five modes do not fit a phone with their names: there only the open one keeps its name.
          iconsOnPhones
          tabs={tabs}
          value={ranked ? 'rank' : minigames ? 'minigames' : mode}
          onChange={(value) => {
            if (value === 'practice') setSearchParams({});
            else if (value === 'rank') {
              if (!ranked) setSearchParams({ mode: 'rank' });
            }
            else if (value === 'minigames') {
              if (!minigames) setSearchParams({ mode: 'minigames' });
            }
            // From anywhere but its cards, Weak spots opens its cards: in a lesson the tab is a way back to them.
            else if (value === 'targeted') {
              if (!weakSpotsCards) backToWeakSpots();
            }
            else if (value !== mode || game) setPlacementPrompt({ open: true });
          }}
        />
        <div className="xl:justify-self-start">
          {/* Not in Rank (a duel lasts the time the server gives it) or a minigame (a Rain round lasts a minute). */}
          <div className={cn('flex outline outline-1 -outline-offset-1 outline-border', (game || weakSpotsCards) && 'hidden')}>
            <TabGroup
              label="Time"
              framed={false}
              tabs={timeTabs}
              value={tabsUnit === timeUnit ? timeTabs[timeIndex].value : ''}
              onChange={(value) => pickTime(tabsUnit, timeTabs.findIndex((tab) => tab.value === value))}
            />
            <button
              type="button"
              aria-label="Switch between seconds and minutes"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setShownUnit(tabsUnit === 'sec' ? 'min' : 'sec');
              }}
              className="inline-flex items-center px-3 py-1.5 text-[1.125rem] text-primary transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {unitLabels[tabsUnit]}
            </button>
          </div>
        </div>
      </div>
      {/* The placement leaderboard takes the sessions of 3 minutes only (US10.1): any other time can still be typed, it is just not ranked. */}
      {mode === 'placement' && !ranked && !minigames && timeSeconds !== SESSION_TIME_LIMIT_SECONDS && (
        <p role="status" className="text-center text-muted-foreground">
          Only 3-minute placement sessions go on the leaderboard.
        </p>
      )}
      {/* Weak spots says what the lesson trains, or why a random passage came instead (US3.2). */}
      {targeted && !weakSpotsCards && !weakSpotsLocked && session?.mode === 'targeted' && <FocusNote focus={session.focusErrorTypes ?? []} chosen={errorType} />}
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
      {planOpen && <PlanDialog open onOpenChange={setPlanOpen} />}
      {minigames ? (
        <MinigamesMode
          game={minigame}
          onSelect={(id) => setSearchParams({ mode: 'minigames', game: id })}
          onBack={() => setSearchParams({ mode: 'minigames' })}
        />
      ) : ranked ? (
        <RankMode />
      ) : weakSpotsCards ? (
        <WeakSpotsMode locked={weakSpotsLocked} onPick={pickWeakSpot} />
      ) : targeted && weakSpotsLocked ? (
        <div className="mx-auto my-auto flex max-w-md flex-col items-center gap-4 text-center">
          <Lock className="size-8 text-muted-foreground" aria-hidden />
          <p className="text-muted-foreground">
            Train builds lessons from the words of the error types you get wrong most. Your plan does not include it.
          </p>
          <Button onClick={() => setPlanOpen(true)}>See plans</Button>
          <Button variant="ghost" className="h-auto gap-2 px-3 py-1.5 text-base text-muted-foreground" onClick={backToWeakSpots}>
            <ArrowLeft className="size-4" aria-hidden /> All weak spots
          </Button>
        </div>
      ) : session ? (
        <TypingArea
          key={session._id}
          targetWords={session.targetWords}
          language={session.language ?? 'vi'}
          header={languageSwitch}
          disabled={complete.isPending}
          onStart={() => begin.mutate(session._id)}
          onFinish={finish}
          timeLimitSeconds={timeSeconds}
          onTimeUp={restart}
          actions={
            // A Weak spots lesson has its way back to the cards left of Restart, the two centered under the passage like the
            // Minigames' way back under a game.
            <div className="flex flex-wrap items-center justify-center gap-4">
              {targeted && (
                <Button variant="ghost" className={actionClass} onClick={backToWeakSpots} disabled={complete.isPending}>
                  <ArrowLeft className="size-5" aria-hidden /> All weak spots
                </Button>
              )}
              <Button variant="ghost" className={actionClass} onClick={restart} disabled={start.isPending || complete.isPending}>
                <RotateCcw className="size-5" /> Restart
              </Button>
            </div>
          }
        />
      ) : (
        <>
          <div className="mx-auto my-auto w-full max-w-7xl">
            {languageSwitch && <div className="mb-4 flex justify-center">{languageSwitch}</div>}
            {start.isError ? (
              <ErrorState error={start.error} onRetry={restart} />
            ) : (
              <>
                {/* The AI writes a Weak spots lesson: a few seconds. */}
                {targeted && (
                  <p role="status" className="mb-4 text-center text-muted-foreground">
                    Writing your lesson…
                  </p>
                )}
                <LoadingState rows={2} />
              </>
            )}
          </div>
          {/* The words and the clock stay while the next session loads. */}
          <TypingStatus typed={0} total={0} seconds={0} finished={false} />
        </>
      )}
    </div>
  );
};
