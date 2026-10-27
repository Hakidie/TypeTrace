import { Panel } from '@/shared/components/panel';
import type { SessionMode } from '../types/typing.types';
import { modeLabels } from '../typing.config';

interface SessionInfoPanelProps {
  /** Missing on sessions from before the title was stored. */
  passageTitle?: string;
  mode: SessionMode;
  /** The time the learner chose, in seconds. */
  timeLimitSeconds: number;
}

/** "30s", "2m": the way the Typing page names its time choices. */
const formatTimeLimit = (seconds: number) => (seconds % 60 === 0 ? `${seconds / 60}m` : `${seconds}s`);

/** What was typed and how: the name of the passage, the typing mode and the time chosen. */
export const SessionInfoPanel = ({ passageTitle, mode, timeLimitSeconds }: SessionInfoPanelProps) => (
  <Panel bare>
    <dl className="grid gap-4 sm:grid-cols-3">
      <div className="min-w-0">
        <dt className="text-2xl text-muted-foreground">Passage</dt>
        <dd className="break-words text-[2rem] font-semibold leading-tight">{passageTitle ?? '—'}</dd>
      </div>
      <div>
        <dt className="text-2xl text-muted-foreground">Mode</dt>
        <dd className="text-[2rem] font-semibold leading-tight">{modeLabels[mode]}</dd>
      </div>
      <div>
        <dt className="text-2xl text-muted-foreground">Time</dt>
        <dd className="text-[2rem] font-semibold leading-tight">{formatTimeLimit(timeLimitSeconds)}</dd>
      </div>
    </dl>
  </Panel>
);
