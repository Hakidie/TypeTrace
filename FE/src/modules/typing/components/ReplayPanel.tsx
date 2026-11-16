import { VideoOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/shared/components/empty-state';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import type { TypingLanguage } from '@/shared/lib/typing-language';
import { useSessionReplay } from '../hooks/use-typing';
import { REPLAY_KEPT_DAYS } from '../typing.config';
import { ReplayPlayer } from './ReplayPlayer';

const isMissing = (error: unknown) => (error as { response?: { status?: number } } | null)?.response?.status === 404;

/**
 * The replay of a session on its result page, in place of the typed passage while Replay is on (SCRUM-35). It is loaded when
 * it opens; a session without one (older than the time replays are kept, or saved without one) says so.
 */
export const ReplayPanel = ({ sessionId, targetWords, language }: { sessionId: string; targetWords: string[]; language?: TypingLanguage }) => {
  const { t } = useTranslation('typing');
  const { data, isLoading, error, refetch } = useSessionReplay(sessionId);

  if (isLoading) return <LoadingState rows={2} />;
  if (isMissing(error)) {
    return (
      <EmptyState
        icon={VideoOff}
        title={t('replay.none')}
        description={t('replay.noneHint', { days: REPLAY_KEPT_DAYS })}
      />
    );
  }
  if (error || !data) return <ErrorState error={error} onRetry={() => void refetch()} />;
  return <ReplayPlayer targetWords={targetWords} language={language} events={data.events} expiresAt={data.expiresAt} />;
};
