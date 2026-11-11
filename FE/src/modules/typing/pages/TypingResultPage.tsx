import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { Panel } from '@/shared/components/panel';
import { Button } from '@/shared/components/ui/button';
import { ErrorTypeChart } from '../components/ErrorTypeChart';
import { PassageView } from '../components/PassageView';
import { ReplayPanel } from '../components/ReplayPanel';
import { SessionInfoPanel } from '../components/SessionInfoPanel';
import { SpeedErrorChart } from '../components/SpeedErrorChart';
import { ResultActions } from '../components/ResultActions';
import { ResultsPanel } from '../components/ResultsPanel';
import { StreakRewardDialog } from '@/modules/profile/components/StreakRewardDialog';
import { usePlacementMinAccuracy } from '@/modules/ranked/hooks/use-ranked';
import { useSession, useSessionStats } from '../hooks/use-typing';
import { placementBoardNote, statsFromCounts, type WordResult } from '../utils/typing-session';

export const TypingResultPage = () => {
  const { id = '' } = useParams();
  const { data: session, isLoading, error, refetch } = useSession(id);
  const stats = useSessionStats(id);
  const minAccuracy = usePlacementMinAccuracy();
  // The error panels (by type, mistakes, rates) are hidden until the learner asks for them.
  const [detailOpen, setDetailOpen] = useState(false);
  // Replay plays the session back in place of the typed passage, until it is pressed again (SCRUM-35).
  const [replayOpen, setReplayOpen] = useState(false);
  // The note about a session that is not counted goes away with OK (it comes back when the page is opened again).
  const [noticeClosed, setNoticeClosed] = useState(false);

  if (isLoading) return <LoadingState rows={4} />;
  if (error || !session) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (session.status !== 'completed' || !session.errorCounts || !session.opportunityCounts) {
    return <ErrorState title="This session has no result" />;
  }

  const results: WordResult[] = session.words.map((word) => ({ ...word, errors: word.errorTypes }));
  // Sessions from before SCRUM-219 have no language: they were all Vietnamese.
  const language = session.language ?? 'vi';
  const boardNote = placementBoardNote(session, minAccuracy);

  return (
    <div className="space-y-12">
      {/* The day's streak reward, once today has a counted session (this one or an earlier one). */}
      <StreakRewardDialog />
      {boardNote && (
        <p role="status" className={boardNote.onBoard ? 'text-primary' : 'text-muted-foreground'}>
          {boardNote.text}
        </p>
      )}
      {!session.isCounted && !noticeClosed && (
        <div className="flex flex-col gap-3 border border-dashed p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground">
            This session is saved but not counted in your error profile, streak or daily mission: it needs at least 20 words and at most 200 WPM.
          </p>
          <Button variant="outline" size="sm" className="shrink-0" onClick={() => setNoticeClosed(true)}>
            OK
          </Button>
        </div>
      )}

      {/* What was typed, then the speed chart. The same request feeds the error panels further down: its loading and error states show here. */}
      {stats.isLoading ? (
        <LoadingState rows={2} />
      ) : stats.error || !stats.data ? (
        <ErrorState error={stats.error} onRetry={() => void stats.refetch()} />
      ) : (
        <>
          <SessionInfoPanel
            passageTitle={session.passageTitle}
            mode={session.mode}
            language={language}
            timeLimitSeconds={stats.data.timeLimitSeconds}
          />
          <SpeedErrorChart
            timeline={stats.data.timeline}
            timeLimitSeconds={stats.data.timeLimitSeconds}
            wpm={session.wpm}
            accuracy={session.accuracy}
          />
        </>
      )}

      {/* PANEL Typed passage, or its replay */}
      <Panel bare>
        {replayOpen ? (
          <ReplayPanel sessionId={session._id} targetWords={session.targetWords} language={language} />
        ) : (
          <PassageView words={session.targetWords} results={results} />
        )}
      </Panel>

      <ResultActions
        detailOpen={detailOpen}
        onToggleDetail={() => setDetailOpen((open) => !open)}
        replayOpen={replayOpen}
        onToggleReplay={() => setReplayOpen((open) => !open)}
      />

      {detailOpen && (
        <>
          {stats.data && <ErrorTypeChart stats={stats.data} />}
          <ResultsPanel results={results} stats={statsFromCounts(session.errorCounts, session.opportunityCounts, language)} />
        </>
      )}
    </div>
  );
};
