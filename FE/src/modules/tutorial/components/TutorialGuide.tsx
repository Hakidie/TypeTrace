import { CloudRain } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { useRainWords } from '@/modules/rain/hooks/use-rain';
import { EmptyState } from '@/shared/components/empty-state';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { redGlassTheme } from '@/shared/lib/red-glass-theme';
import { cn } from '@/shared/lib/utils';
import { useUpdateTutorial } from '../hooks/use-tutorial';
import { tutorialStore } from '../lib/tutorial-store';
import { MODE_QUERY, MODE_STEPS, nextTourMode, pendingGuide, TOUR_ORDER, WELCOME_STEP } from '../steps';
import type { CoachStats, TutorialMode, TutorialStep } from '../types/tutorial.types';
import { Ping } from './Ping';
import { PracticeDuel } from './PracticeDuel';
import { PracticeResult } from './PracticeResult';
import { Spotlight } from './Spotlight';
import { TutorialBubble } from './TutorialBubble';

const MODE_LABELS: Record<TutorialMode, string> = { practice: 'Practice', placement: 'Placement', rain: 'Mưa chữ', daily: 'Daily', rank: 'Rank' };

/** The mode open on the Typing page: its `?mode=` tab, Practice without one. */
const openModeOf = (query: string | null): TutorialMode => TOUR_ORDER.find((mode) => MODE_QUERY[mode] === query) ?? 'practice';

/** The words of the practice duel: the word rain words, with the usual loading and error states. */
const PracticeArena = ({ onDone, onSkip }: { onDone: (stats: CoachStats) => void; onSkip: () => void }) => {
  const words = useRainWords();
  if (words.isLoading) return <LoadingState rows={2} />;
  if (words.isError) return <ErrorState error={words.error} onRetry={() => words.refetch()} />;
  if (!words.data?.words.length) return <EmptyState icon={CloudRain} title="No words to rain yet" description="Ask an admin to add words to the word bank." />;
  return <PracticeDuel words={words.data.words} onDone={onDone} onSkip={onSkip} />;
};

/**
 * Ping on the Typing page (a widget on every app page, active on /typing only). For an account with a tutorial it runs
 * the tour after sign-up (welcome, then the steps of each mode in `TOUR_ORDER`, moving to the next tab) or, once the tour
 * is over or skipped, the guide of an open mode not learned yet. The last step of Rank opens the practice duel against
 * Ping-bot, then its result. Accounts without a tutorial never see Ping.
 */
export const TutorialGuide = () => {
  const tutorial = useCurrentUser().data?.tutorial;
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const update = useUpdateTutorial();
  const mode = openModeOf(searchParams.get('mode'));
  const touring = tutorial?.tour === 'active';
  const [welcomed, setWelcomed] = useState(false);
  // The step reached in the open mode; going to another mode starts its guide from the top.
  const [at, setAt] = useState({ mode, index: 0 });
  if (at.mode !== mode) setAt({ mode, index: 0 });
  /** The practice duel open: its round (a new one restarts it) and, once it ended, its numbers. */
  const [practice, setPractice] = useState<{ round: number; stats?: CoachStats } | null>(null);

  const welcoming = pathname === '/typing' && touring && !welcomed && Object.keys(tutorial?.modes ?? {}).length === 0;
  const steps = MODE_STEPS[mode];
  const guiding = pathname === '/typing' && pendingGuide(tutorial, mode) && !update.isPending;
  const step: TutorialStep | undefined = welcoming ? WELCOME_STEP : guiding ? steps[at.index] : undefined;

  /** The mode is learned: saved, and the tour goes on to the next mode (or ends after Rank). */
  const finishMode = () => {
    const tourNext = tutorial && touring ? nextTourMode({ ...tutorial, modes: { ...tutorial.modes, [mode]: 'done' } }) : undefined;
    update.mutate({ mode, status: 'done', ...(touring && !tourNext && { tour: 'done' as const }) });
    if (tourNext) navigate(`/typing?mode=${MODE_QUERY[tourNext]}`);
  };
  const next = () => {
    if (welcoming) {
      setWelcomed(true);
      if (mode !== 'practice') navigate('/typing?mode=practice');
      return;
    }
    if (step?.id === 'rank-practice') return setPractice({ round: 1 });
    if (at.index + 1 < steps.length) setAt({ mode, index: at.index + 1 });
    else finishMode();
  };
  /** In the tour, skipping ends the whole tour (and this mode); in a guide of one mode, only that mode. */
  const skip = () => update.mutate(touring ? { tour: 'skipped', mode, status: 'skipped' } : { mode, status: 'skipped' });

  // A step that waits for the learner (type the framed falling word) tells the page, which calls back when it is done.
  const waitFor = step?.waitFor;
  useEffect(() => {
    if (!waitFor) return;
    tutorialStore.setHold(waitFor, () => setAt((current) => ({ ...current, index: current.index + 1 })));
    return () => tutorialStore.setHold(null);
  }, [waitFor]);

  // The practice duel against Ping-bot covers the page: the duel, then its result with Ping's tip. A new round remounts it.
  if (practice) {
    const close = (end: () => void) => () => {
      setPractice(null);
      end();
    };
    return (
      <div role="dialog" aria-label="Đấu tập với Ping" className={cn('fixed inset-0 z-50 overflow-y-auto bg-background p-4 md:p-8', redGlassTheme)}>
        {practice.stats ? (
          <PracticeResult stats={practice.stats} onAgain={() => setPractice({ round: practice.round + 1 })} onRank={close(finishMode)} />
        ) : (
          <PracticeArena key={practice.round} onDone={(stats) => setPractice({ round: practice.round, stats })} onSkip={close(skip)} />
        )}
      </div>
    );
  }

  if (!step) return null;
  const label = touring ? 'Chuyến hướng dẫn' : `Hướng dẫn ${MODE_LABELS[mode]}`;
  return (
    <>
      {step.target && <Spotlight target={step.target} />}
      <div className="fixed inset-x-4 bottom-4 z-50 flex items-end gap-2 sm:right-auto sm:max-w-xl">
        <Ping move={step.move} size={2} className="hidden sm:block" />
        <Ping move={step.move} className="sm:hidden" />
        <TutorialBubble
          className="min-w-0 flex-1"
          label={label}
          step={welcoming ? 1 : at.index + 1}
          total={welcoming ? 1 : steps.length}
          onNext={step.waitFor ? undefined : next}
          nextLabel={step.next}
          onSkip={skip}
          skipLabel={welcoming ? 'Bỏ qua hướng dẫn' : 'Bỏ qua'}
        >
          {step.text}
        </TutorialBubble>
      </div>
    </>
  );
};
