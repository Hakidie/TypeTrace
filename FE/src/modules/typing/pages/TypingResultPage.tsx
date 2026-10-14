import { Gauge, Target, Timer } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { PageHeader } from '@/shared/components/page-header';
import { StatCard } from '@/shared/components/stat-card';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { PassageView } from '../components/PassageView';
import { ResultsPanel } from '../components/ResultsPanel';
import { useSession } from '../hooks/use-typing';
import { formatDuration, statsFromCounts, type WordResult } from '../utils/typing-session';

export const TypingResultPage = () => {
  const { id = '' } = useParams();
  const { data: session, isLoading, error, refetch } = useSession(id);

  if (isLoading) return <LoadingState rows={4} />;
  if (error || !session) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (session.status !== 'completed' || !session.errorCounts || !session.opportunityCounts) {
    return <ErrorState title="This session has no result" />;
  }

  const results: WordResult[] = session.words.map((word) => ({ ...word, errors: word.errorTypes }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Result"
        description={`${session.words.length} words typed`}
        actions={
          <Button asChild>
            <Link to="/typing">Type again</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="WPM" value={session.wpm} icon={Gauge} hint="Correct words per minute" />
        <StatCard label="Accuracy" value={`${session.accuracy}%`} icon={Target} hint="Words typed without any error" />
        <StatCard label="Time" value={formatDuration((session.durationMs ?? 0) / 1000)} icon={Timer} />
      </div>

      {!session.isCounted && (
        <p className="border border-dashed p-4 text-muted-foreground">
          This session is saved but not counted in your error profile: it needs at least 20 words and at most 200 WPM.
        </p>
      )}

      <Card className="p-5">
        <PassageView words={session.targetWords} results={results} />
      </Card>

      <ResultsPanel results={results} stats={statsFromCounts(session.errorCounts, session.opportunityCounts)} />
    </div>
  );
};
