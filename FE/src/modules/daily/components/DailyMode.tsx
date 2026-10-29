import { CalendarX } from 'lucide-react';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { TypingArea } from '@/modules/typing/components/TypingArea';
import { useBeginSession, useCompleteSession } from '@/modules/typing/hooks/use-typing';
import type { TypingSession } from '@/modules/typing/types/typing.types';
import { EmptyState } from '@/shared/components/empty-state';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { dailyKeys, useDailyToday, useStartTry } from '../hooks/use-daily';
import type { DailyToday } from '../types/daily.types';
import { DailyCard } from './DailyCard';
import { DailyLeaderboard } from './DailyLeaderboard';
import { DailyProgress } from './DailyProgress';
import { DailyResult } from './DailyResult';

const isMissing = (error: unknown) => (error as { response?: { status?: number } } | null)?.response?.status === 404;

/**
 * The Daily tab of the Typing page (`?mode=daily`): today's card (with the progress charts under it) and board side by side (one column on a phone); Start
 * opens a try in the shared `TypingArea` for the challenge's time; once the try is graded the result replaces the card.
 */
export const DailyMode = () => {
  const queryClient = useQueryClient();
  const today = useDailyToday();
  const startTry = useStartTry();
  const begin = useBeginSession();
  const complete = useCompleteSession();
  const [session, setSession] = useState<TypingSession | null>(null);
  /** The card as it was when the try started, to tell the result what changed. */
  const [before, setBefore] = useState<DailyToday | null>(null);
  const [showResult, setShowResult] = useState(false);

  if (today.isLoading) return <LoadingState rows={3} />;
  if (today.isError) {
    return isMissing(today.error) ? (
      <EmptyState icon={CalendarX} title="No daily challenge today" description="There is no passage to type yet. Come back later." />
    ) : (
      <ErrorState error={today.error} onRetry={() => today.refetch()} />
    );
  }
  const card = today.data!;

  const start = () => {
    setBefore(card);
    startTry.mutate(undefined, { onSuccess: setSession });
  };
  const done = async () => {
    await queryClient.invalidateQueries({ queryKey: dailyKeys.all });
    setSession(null);
    setShowResult(true);
  };

  if (session) {
    return (
      <TypingArea
        key={session._id}
        targetWords={session.targetWords}
        disabled={complete.isPending}
        timeLimitSeconds={card.seconds}
        onStart={() => begin.mutate(session._id)}
        onFinish={(typedWords, typedAtMs) =>
          complete.mutate({ id: session._id, typedWords, typedAtMs, timeLimitSeconds: card.seconds }, { onSuccess: done })
        }
        // Time ran out before a word was finished: the try is used, nothing to grade.
        onTimeUp={done}
      />
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-4 py-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start">
      <div className="flex min-w-0 flex-col gap-4">
        {showResult && before ? (
          <DailyResult before={before} after={card} onAgain={start} onBack={() => setShowResult(false)} starting={startTry.isPending} />
        ) : (
          <DailyCard today={card} onStart={start} starting={startTry.isPending} />
        )}
        <DailyProgress />
      </div>
      <DailyLeaderboard yesterdayWinner={card.yesterdayWinner} />
    </div>
  );
};
