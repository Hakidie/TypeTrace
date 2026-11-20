import { ArrowLeft, ClipboardX, Gamepad2, Languages, ListChecks, Lock, RotateCcw, Shuffle, Trophy } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import type { AfterLoginState } from '@/modules/auth/utils/home-path';
import { useStartTutorial } from '@/modules/tutorial/hooks/use-tutorial';
import { RankMode } from '@/modules/ranked/components/RankMode';
import { PlanDialog } from '@/modules/plan/components/PlanDialog';
import { usePlan } from '@/modules/plan/hooks/use-plan';
import { missingWords } from '@/modules/profile/lib/chance-words';
import { useErrorProfile, useSaveTypingLanguage, useTypingLanguage } from '@/modules/profile/hooks/use-profile';
import { getApiErrorStatus } from '@/shared/api/api-error';
import { storeUiLanguage } from '@/shared/i18n/ui-language';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { EmptyState } from '@/shared/components/empty-state';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { TabGroup } from '@/shared/components/tab-group';
import { Button } from '@/shared/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';
import { redGlassTheme } from '@/shared/lib/red-glass-theme';
import { errorTypesOf, type SessionErrorType, type TypingLanguage } from '@/shared/lib/typing-language';
import { MinigamesMode, type MinigameId } from '../components/MinigamesMode';
import { PassageMenuPanel } from '../components/PassageMenuPanel';
import { TypingArea, TypingStatus } from '../components/TypingArea';
import { WeakSpotsMode, type WeakSpotsFocus } from '../components/WeakSpotsMode';
import { useBeginSession, useCompleteSession, useStartSession } from '../hooks/use-typing';
import type { ReplayEvent, SessionMode, StartSessionInput } from '../types/typing.types';
import { errorLabels, languageNames, modeIcons, modeLabels, SESSION_TIME_LIMIT_SECONDS, timeChoices, unitLabels, type TimeUnit } from '../typing.config';

// The buttons around the passage: Restart, and in the bottom row the language switch (Practice) or in a Weak spots lesson the way back to its cards.
const actionClass = 'h-auto gap-2 px-4 py-2 text-[1.125rem] text-muted-foreground';
// Restart and the language button: an icon, and the word grows next to it only while the button is hovered or focused (as on the toolbars).
const hoverButtonClass = 'group gap-0 h-auto px-4 py-2 text-[1.125rem] text-muted-foreground';
const hoverWordClass =
  'max-w-0 overflow-hidden opacity-0 transition-all duration-200 group-hover:ml-2 group-hover:max-w-40 group-hover:opacity-100 group-focus-visible:ml-2 group-focus-visible:max-w-40 group-focus-visible:opacity-100';

// The name of the passage above the text: as wide as its text, cut with an ellipsis when it does not fit.
const nameClass = 'min-w-0 px-4 py-2 text-[1.125rem] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring enabled:hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50';

// Manual / Random choose the passage of Practice and Placement; Train (Weak spots) is the third tab of the same group, since its
// lesson is the passage (SCRUM-28).
const passageTabsOf = (t: TFunction) => [
  { value: 'manual', label: t('typing:page.manual'), icon: ListChecks, hint: t('typing:page.manualHint') },
  { value: 'random', label: t('typing:page.random'), icon: Shuffle, hint: t('typing:page.randomHint') },
  { value: 'train', label: modeLabels.targeted, icon: modeIcons.targeted, hint: t('typing:page.trainHint') },
];

// Rank and Minigames are not practice sessions: `?mode=rank` shows the ranked duels (`RankMode`), `?mode=minigames` the cards of the minigames (`MinigamesMode`; `&game=rain` opens word rain, `&game=bot` the unrated duel against a bot, `&game=chain` Nối từ), instead of a passage to practise.
// `?mode=targeted` is Weak spots: its cards (`WeakSpotsMode`: the auto lesson, US3.2, and the error types of the language typed,
// SCRUM-74, SCRUM-319) until one is picked, then its lesson (`&focus=auto` or `&focus=<type>`), a passage the AI wrote from
// words picked for the errors.
const modeTabsOf = (t: TFunction) => [
  { value: 'practice', label: modeLabels.practice, icon: modeIcons.practice, hint: t('typing:page.practiceHint') },
  { value: 'placement', label: modeLabels.placement, icon: modeIcons.placement, hint: t('typing:page.placementHint') },
  { value: 'rank', label: t('typing:page.rank'), icon: Trophy, hint: t('typing:page.rankHint') },
  { value: 'minigames', label: t('typing:page.minigames'), icon: Gamepad2, hint: t('typing:page.minigamesHint') },
];

const IME_HINT_ID = 'ime-hint';

// The time choices set how long a session lasts. The button next to them switches between seconds and minutes; the
// second choice (20 seconds) is the one selected at first in Practice, 1 minute in the placement test and Weak spots
// (`defaultTimeOf`); the longest, 3 minutes, is the most the server accepts.

/**
 * The time selected when a mode opens: 20 seconds in Practice; 1 minute in the placement test and in Weak spots, whose lesson
 * (30 to 50 words) needs it: under 20 words a session is not counted in the error profile it aims to improve. The learner can
 * change it afterwards.
 */
const defaultTimeOf = (mode: SessionMode): { unit: TimeUnit; index: number } =>
  mode === 'placement' || mode === 'targeted' ? { unit: 'min', index: 0 } : { unit: 'sec', index: 1 };

/** The English error types: the two sets have no type in common, so a type says its language (SCRUM-319). */
const ENGLISH_TYPES: readonly string[] = errorTypesOf('en');
const ALL_TYPES: readonly string[] = [...errorTypesOf('vi'), ...ENGLISH_TYPES];
/** The typing language of an error type: its lesson is typed in it. */
const languageOfType = (type: SessionErrorType): TypingLanguage => (ENGLISH_TYPES.includes(type) ? 'en' : 'vi');

/** The Weak spots card picked (`&focus=`): `auto` or one error type of either language; anything else is no pick (the cards show). */
const focusOf = (value: string | null): WeakSpotsFocus | undefined =>
  value === 'auto' || ALL_TYPES.includes(value ?? '') ? (value as WeakSpotsFocus) : undefined;

/**
 * What Train says above the lesson: the error types it trains, or why a random passage came instead (US3.2). The lesson of an
 * error type picked before it has enough data (SCRUM-74, SCRUM-274) says so too, with what the error profile still needs: the
 * one of the lesson's language (SCRUM-319), as the cards it was picked on.
 */
const FocusNote = ({ focus, chosen, language }: { focus: SessionErrorType[]; chosen?: SessionErrorType; language: TypingLanguage }) => {
  const { t } = useTranslation('typing');
  const { data: profile } = useErrorProfile(language);
  const item = chosen && focus.length ? profile?.types.find((type) => type.type === chosen) : undefined;
  return (
    <p role="status" className="text-center text-muted-foreground">
      {focus.length ? (
        <>
          {t('page.training')}<span className="text-primary">{focus.map((type) => errorLabels[type]).join(' · ')}</span>
          {profile && item?.level === 'insufficient_data' && (
            <span className="block">
              {t('page.notEnoughData', { type: errorLabels[item.type], missing: missingWords(item.type, profile.minOpportunities - item.opportunities) })}
            </span>
          )}
        </>
      ) : chosen ? (
        t('page.noWordsFor', { type: errorLabels[chosen] })
      ) : (
        t('page.noProfile')
      )}
    </p>
  );
};

/**
 * The placement leaderboard ranks only the time the session was started with (US10.1), so a placement session carries it. A
 * Weak spots lesson carries the error type the learner chose, if any.
 */
const startInputOf = (mode: SessionMode, passageId: string | undefined, seconds: number, errorType?: SessionErrorType): StartSessionInput => ({
  mode,
  ...(passageId && { passageId }),
  ...(mode === 'placement' && { timeLimitSeconds: seconds }),
  ...(errorType && { errorType }),
});

// Same look as the login and register pages (shared/lib/red-glass-theme.ts). The passage shows as soon as the page
// opens; the timer starts at the first key (TypingArea tells the server through `begin`).
export const TypingPage = () => {
  const { t, i18n } = useTranslation('typing');
  const modeTabs = modeTabsOf(t);
  const passageTabs = passageTabsOf(t);
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
  // What the learner types (SCRUM-219), saved on their account; `undefined` while the user loads. The server starts every
  // session in it: Practice, the placement test (SCRUM-305) and a Weak spots lesson (SCRUM-319).
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
  const [manualOn, setManualOn] = useState(false);
  // Manual clicked in Train: the mode changes to Practice first, which opens with Manual on.
  const [wantManual, setWantManual] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [modeOfChoice, setModeOfChoice] = useState(mode);
  if (modeOfChoice !== mode) {
    setModeOfChoice(mode);
    setChosen(undefined);
    setManualOn(wantManual);
    setMenuOpen(wantManual);
    setWantManual(false);
    // Each mode opens with its own time: 1 minute for the placement test and Weak spots, 20 seconds for Practice.
    setTimeUnit(defaultTimeOf(mode).unit);
    setTimeIndex(defaultTimeOf(mode).index);
    setShownUnit(undefined);
  }
  const passageId = chosen?.mode === mode ? chosen.id : undefined;
  // The Manual / Random tabs: Manual lets the learner choose the passage from its name above the text; a passage picked
  // before (`?passage=`) is a manual choice too. The menu is opened by the Manual tab (and by the name).
  const manual = manualOn || passageId !== undefined;

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
    // The lesson of one error type is typed in the language of that type (SCRUM-319): a link of the Profile's English error
    // profile ("Practice this error") switches a learner who types Vietnamese to English first, and the other way round, or
    // the server would refuse the type. That waits for the user, to know their language.
    const lessonLanguage = errorType && languageOfType(errorType);
    if (lessonLanguage && lessonLanguage !== language) {
      if (language === undefined) return;
      openedFor.current = sessionKey;
      saveLanguage(lessonLanguage, {
        onSuccess: () => start.mutate(startInputOf(mode, undefined, timeSeconds, errorType)),
        // Not saved (the toast says why): back to the cards, of the language the learner still has.
        onError: () => setSearchParams({ mode: 'targeted' }),
      });
      return;
    }
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
  }, [mode, game, weakSpotsCards, sessionKey, targeted, errorType, start, passageId, timeSeconds, planPending, weakSpotsLocked, language, saveLanguage, setSearchParams]);

  // VI / EN in Practice, in the placement test and on the Weak spots cards: the language typed and the language of the
  // interface, which follows the button (SCRUM-319), saved on the account first in one request (the server starts a session
  // in the saved language). One language for all: the placement test and the Weak spots lessons of a language are those of
  // the language Practice types (SCRUM-305, SCRUM-319). When the interface changes language, `AppLayout` draws the page again
  // in it, and the page drawn again starts its own session (a random passage; in Placement a new test of the default time)
  // or shows the cards of that language. Otherwise a new random passage of that language starts here, as Random does (the
  // session being typed is left), and on the cards nothing starts: they show that language's error profile.
  const switchLanguage = (next: TypingLanguage) => {
    if (next === language) return;
    // On the Weak spots cards the button changes only the language of the Train page (the error profile and its lessons):
    // the interface keeps its language and nothing is drawn again.
    if (weakSpotsCards) {
      saveLanguage(next);
      return;
    }
    const redrawn = i18n.language !== next;
    saveLanguage(
      { typingLanguage: next, uiLanguage: next },
      {
        onSuccess: () => {
          if (redrawn) {
            storeUiLanguage(next);
            void i18n.changeLanguage(next);
            return;
          }
          setChosen(undefined);
          setManualOn(false);
          setMenuOpen(false);
          start.mutate(startInputOf(mode, undefined, timeSeconds));
        },
      },
    );
  };
  // The language switch, in Practice and in the placement test (SCRUM-305): one button, built like Restart, at the bottom center
  // of the page (the middle of the word count / timer row). It shows the language being typed and a click switches to the other
  // one. Also shown while the passage loads or fails, so a language with no passage can be left. In Weak spots it is on the
  // cards (SCRUM-319), under the auto lesson: a lesson keeps the language it started in, and its bottom row leads back to them.
  const current = language ?? 'vi';
  const other: TypingLanguage = current === 'vi' ? 'en' : 'vi';
  const showsLanguageSwitch = (mode === 'practice' || mode === 'placement' || weakSpotsCards) && !game;
  // The Train cards are written in the language typed, whatever the interface says (the button changes only this page): a
  // copy of the i18n instance fixed to it, which the cards read through a provider. Elsewhere the interface's language.
  const cardsI18n = useMemo(() => i18n.cloneInstance({ lng: current }), [i18n, current]);
  const labelT = weakSpotsCards ? cardsI18n.getFixedT(current, 'typing') : t;
  const nameOf = (language: TypingLanguage) => (weakSpotsCards ? labelT(`languageNames.${language}`) : languageNames[language]);
  const languageSwitch =
    showsLanguageSwitch ? (
      <Button
        variant="ghost"
        className={hoverButtonClass}
        aria-label={labelT('page.languageSwitch', { current: nameOf(current), other: nameOf(other) })}
        onClick={() => switchLanguage(other)}
        disabled={language === undefined || savingLanguage || start.isPending || complete.isPending}
      >
        <Languages className="size-5" /> <span className={hoverWordClass}>{nameOf(current)}</span>
      </Button>
    ) : undefined;

  // An input method for Vietnamese (Telex, VNI) turns English words into Vietnamese ones ("dd" into "đ"): a notification
  // while the learner types English in Practice, in the placement test or in Weak spots (SCRUM-319), with one id so it never
  // stacks, taken back when the language or mode changes.
  const imeHint = !game && language === 'en';
  useEffect(() => {
    if (!imeHint) return;
    toast.info(t('page.imeHint'), { id: IME_HINT_ID, duration: 8000 });
    return () => {
      toast.dismiss(IME_HINT_ID);
    };
  }, [imeHint, t]);

  // A placement test of a language that has no passage yet (404): said in the learner's interface language, with the way out
  // (the language button below), rather than the server's words.
  const noPlacementPassage = mode === 'placement' && getApiErrorStatus(start.error) === 404;

  // A new session on the picked passage (a random one when none is picked; a new lesson in Weak spots): used by Restart and when the time is up.
  const restart = () => start.mutate(startInput(passageId, timeSeconds));
  const pick = (id: string | undefined) => {
    setChosen(id ? { mode, id } : undefined);
    start.mutate(startInput(id, timeSeconds));
  };
  // Random: a new random passage. Manual: the menu opens to choose one; the passage on screen stays until then.
  const pickPassageTab = (value: string) => {
    if (value === 'train') {
      // From anywhere but its cards, Train opens its cards: in a lesson the tab is a way back to them.
      if (!weakSpotsCards) backToWeakSpots();
    } else if (targeted) {
      // Back to Practice, which starts a random passage (Manual: and opens the menu).
      setWantManual(value === 'manual');
      setSearchParams({});
    } else if (value === 'random') {
      setManualOn(false);
      setMenuOpen(false);
      pick(undefined);
    } else {
      setManualOn(true);
      setMenuOpen(true);
    }
  };
  // The name of the passage, at the top center of the text. With the Manual tab it is the button that opens the menu of passages;
  // otherwise (Random, Placement's random pick, a Weak spots lesson) it only shows the name. The full name is in the shared tooltip.
  const nameTooltip = (child: ReactNode) => (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{child}</TooltipTrigger>
        {passageTitle && <TooltipContent className="max-w-[min(32rem,calc(100vw-2rem))] whitespace-normal break-words">{passageTitle}</TooltipContent>}
      </Tooltip>
    </TooltipProvider>
  );
  const passageName =
    game || weakSpotsCards ? undefined : !targeted && manual ? (
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen} className="flex min-w-0 max-w-full">
        {nameTooltip(
          <span className="flex min-w-0">
            <DropdownMenuTrigger disabled={complete.isPending} aria-label={t('page.choosePassage')} className={cn(nameClass, 'text-primary')}>
              <span className="block truncate whitespace-nowrap">{passageTitle ?? '—'}</span>
            </DropdownMenuTrigger>
          </span>,
        )}
        {/* The menu keeps the normal background, like the Sort and Filter menus (the page theme tints --color-background). Centered under the name. */}
        <DropdownMenuContent role="menu" aria-label={t('page.passagesMenu')} className="left-1/2 w-[calc(100vw-2rem)] -translate-x-1/2 sm:w-max sm:min-w-[24rem] sm:max-w-[min(32rem,calc(100vw-2rem))] [--color-background:var(--background)]">
          <PassageMenuPanel mode={mode} language={language ?? 'vi'} showOriginFilter={mode === 'practice'} selectedId={passageId} onSelect={pick} onNeedPremium={() => setPlanOpen(true)} />
        </DropdownMenuContent>
      </DropdownMenu>
    ) : (
      nameTooltip(<span className={cn(nameClass, 'truncate text-muted-foreground')}>{passageTitle ?? '—'}</span>)
    );

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
      <div data-tutorial="mode-tabs" className="relative flex flex-col items-center gap-2 xl:grid xl:gap-x-2 xl:grid-cols-[1fr_auto_1fr]">
        <div className="flex min-w-0 max-w-full xl:justify-self-end">
          {/* Not in Rank (the room picks the passage) or Minigames. In Train the lesson is the choice, so Manual / Random lead back to Practice. The name of the passage is above the text. */}
          {!game && (
            <TabGroup
              label={t('page.passageGroup')}
              compact
              tabs={passageTabs}
              value={targeted ? 'train' : manual ? 'manual' : 'random'}
              onChange={pickPassageTab}
            />
          )}
        </div>
        <TabGroup
          label={t('page.modeGroup')}
          // Five modes do not fit a phone with their names: there only the open one keeps its name.
          iconsOnPhones
          tabs={modeTabs}
          // Train is a typing mode of Practice: its tab is in the Passage group, and Practice stays lit in this one.
          value={ranked ? 'rank' : minigames ? 'minigames' : targeted ? 'practice' : mode}
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
        <div className="xl:justify-self-start">
          {/* Not in Rank (a duel lasts the time the server gives it) or a minigame (a Rain round lasts a minute). Train shows it on its cards too: it is the time of the lesson. */}
          <div className={cn('flex outline outline-1 -outline-offset-1 outline-border', game && 'hidden')}>
            <TabGroup
              label={t('page.timeGroup')}
              framed={false}
              tabs={timeTabs}
              value={tabsUnit === timeUnit ? timeTabs[timeIndex].value : ''}
              onChange={(value) => pickTime(tabsUnit, timeTabs.findIndex((tab) => tab.value === value))}
            />
            <button
              type="button"
              aria-label={t('page.switchUnit')}
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
          {t('page.placementNote')}
        </p>
      )}
      {/* Weak spots says what the lesson trains, or why a random passage came instead (US3.2). */}
      {targeted && !weakSpotsCards && !weakSpotsLocked && session?.mode === 'targeted' && (
        <FocusNote focus={session.focusErrorTypes ?? []} chosen={errorType} language={session.language ?? 'vi'} />
      )}
      <ConfirmDialog
        open={placementPrompt.open}
        onOpenChange={(open) => setPlacementPrompt({ open })}
        title={t('page.placementTitle')}
        description={t('page.placementDescription', { language: languageNames[current] })}
        confirmLabel={t('page.start')}
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
        <I18nextProvider i18n={cardsI18n}>
          <WeakSpotsMode locked={weakSpotsLocked} language={current} languageSwitch={languageSwitch} onPick={pickWeakSpot} />
        </I18nextProvider>
      ) : targeted && weakSpotsLocked ? (
        <div className="mx-auto my-auto flex max-w-md flex-col items-center gap-4 text-center">
          <Lock className="size-8 text-muted-foreground" aria-hidden />
          <p className="text-muted-foreground">
            {t('page.trainLocked')}
          </p>
          <Button onClick={() => setPlanOpen(true)}>{t('page.seePlans')}</Button>
          <Button variant="ghost" className="h-auto gap-2 px-3 py-1.5 text-base text-muted-foreground" onClick={backToWeakSpots}>
            <ArrowLeft className="size-4" aria-hidden /> {t('page.allWeakSpots')}
          </Button>
        </div>
      ) : session ? (
        <TypingArea
          key={session._id}
          targetWords={session.targetWords}
          language={session.language ?? 'vi'}
          header={passageName}
          disabled={complete.isPending}
          onStart={() => begin.mutate(session._id)}
          onFinish={finish}
          timeLimitSeconds={timeSeconds}
          onTimeUp={restart}
          actions={
            <Button variant="ghost" className={hoverButtonClass} onClick={restart} disabled={start.isPending || complete.isPending}>
              <RotateCcw className="size-5" /> <span className={hoverWordClass}>{t('page.restart')}</span>
            </Button>
          }
          // A Weak spots lesson has its way back to the cards in the bottom row, between the word count and the timer.
          statusCenter={
            targeted ? (
              <Button variant="ghost" className={actionClass} onClick={backToWeakSpots} disabled={complete.isPending}>
                <ArrowLeft className="size-5" aria-hidden /> {t('page.allWeakSpots')}
              </Button>
            ) : (
              languageSwitch
            )
          }
        />
      ) : (
        <>
          <div className="mx-auto my-auto w-full max-w-7xl">
            {passageName && <div className="mb-4 flex justify-center">{passageName}</div>}
            {noPlacementPassage ? (
              <EmptyState
                icon={ClipboardX}
                title={t('page.noPlacementPassage', { language: languageNames[current] })}
                description={t('page.noPlacementPassageHint', { other: languageNames[other] })}
              />
            ) : start.isError ? (
              <ErrorState error={start.error} onRetry={restart} />
            ) : (
              <>
                {/* The AI writes a Weak spots lesson: a few seconds. */}
                {targeted && (
                  <p role="status" className="mb-4 text-center text-muted-foreground">
                    {t('page.writingLesson')}
                  </p>
                )}
                <LoadingState rows={2} />
              </>
            )}
          </div>
          {/* The words and the clock stay while the next session loads. */}
          <TypingStatus
            typed={0}
            total={0}
            seconds={0}
            finished={false}
            center={
              targeted ? (
                <Button variant="ghost" className={actionClass} onClick={backToWeakSpots}>
                  <ArrowLeft className="size-5" aria-hidden /> {t('page.allWeakSpots')}
                </Button>
              ) : (
                languageSwitch
              )
            }
          />
        </>
      )}
    </div>
  );
};
