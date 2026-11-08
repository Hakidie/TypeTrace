import { Gauge, RotateCcw, Target, Timer } from 'lucide-react';
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
export const GuestResult = ({ run, onTryAgain }: GuestResultProps) => (
  <div className="mx-auto w-full max-w-5xl space-y-6">
    <div className="grid gap-4 sm:grid-cols-3">
      <StatCard label="Speed" value={`${run.wpm} WPM`} icon={Gauge} />
      <StatCard label="Accuracy" value={`${run.accuracy}%`} icon={Target} />
      <StatCard label="Time" value={formatDuration(run.durationMs / 1000)} icon={Timer} />
    </div>

    {run.results.length === 0 && <p className="text-muted-foreground">Time ran out before you finished a word. Try again.</p>}
    <ResultsPanel results={run.results} stats={run.stats} />

    <Panel bare title="Keep your results">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-xl text-muted-foreground">
          This result is not saved. With a free account TypeTrace keeps every session, shows which mistakes you make most and picks
          practice words for them.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onTryAgain}>
            <RotateCcw className="size-4" />
            Try again
          </Button>
          <Button asChild variant="destructive">
            <Link to="/register">Create account</Link>
          </Button>
        </div>
      </div>
    </Panel>
  </div>
);
