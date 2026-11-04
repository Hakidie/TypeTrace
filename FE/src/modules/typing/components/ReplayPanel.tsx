import { VideoOff } from 'lucide-react';
import { EmptyState } from '@/shared/components/empty-state';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { useSessionReplay } from '../hooks/use-typing';
import { REPLAY_KEPT_DAYS } from '../typing.config';
import { ReplayPlayer } from './ReplayPlayer';

const isMissing = (error: unknown) => (error as { response?: { status?: number } } | null)?.response?.status === 404;

/**
 * The replay of a session on its result page, in place of the typed passage while Replay is on (SCRUM-35). It is loaded when
 * it opens; a session without one (older than the time replays are kept, or saved without one) says so.
 */
export const ReplayPanel = ({ sessionId, targetWords }: { sessionId: string; targetWords: string[] }) => {
  const { data, isLoading, error, refetch } = useSessionReplay(sessionId);

  if (isLoading) return <LoadingState rows={2} />;
  if (isMissing(error)) {
    return (
      <EmptyState
        icon={VideoOff}
        title="No replay for this session"
        description={`Replays are kept for ${REPLAY_KEPT_DAYS} days after the session, and older sessions have none.`}
      />
    );
  }
  if (error || !data) return <ErrorState error={error} onRetry={() => void refetch()} />;
  return <ReplayPlayer targetWords={targetWords} events={data.events} expiresAt={data.expiresAt} />;
};
