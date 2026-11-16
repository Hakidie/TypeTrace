import { Gauge, RotateCcw, Target, Timer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '@/shared/components/ui/button';
import { Panel } from '@/shared/components/panel';
import { StatCard } from '@/shared/components/stat-card';
import { ResultsPanel } from '@/modules/typing/components/ResultsPanel';
import { formatDuration } from '@/modules/typing/utils/typing-session';
import type { GuestRun } from '../lib/guest-result';

interface GuestResultProps {
  run: GuestRun;
  onTryAgain: () => void;
}

/** The result of a guest's test (never saved) and the invitation to make an account, which saves results and builds an error profile. */
export const GuestResult = ({ run, onTryAgain }: GuestResultProps) => {
  const { t } = useTranslation('home');
  return (
  <div className="mx-auto w-full max-w-5xl space-y-6">
    <div className="grid gap-4 sm:grid-cols-3">
      <StatCard label={t('result.speed')} value={`${run.wpm} WPM`} icon={Gauge} />
      <StatCard label={t('result.accuracy')} value={`${run.accuracy}%`} icon={Target} />
      <StatCard label={t('result.time')} value={formatDuration(run.durationMs / 1000)} icon={Timer} />
    </div>

    {run.results.length === 0 && <p className="text-muted-foreground">{t('result.noWord')}</p>}
    <ResultsPanel results={run.results} stats={run.stats} />

    <Panel bare title={t('result.keepTitle')}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-xl text-muted-foreground">
          {t('result.keepText')}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onTryAgain}>
            <RotateCcw className="size-4" />
            {t('result.tryAgain')}
          </Button>
          <Button asChild variant="destructive">
            <Link to="/register">{t('result.createAccount')}</Link>
          </Button>
        </div>
      </div>
    </Panel>
  </div>
  );
};
