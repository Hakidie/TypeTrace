import { Panel } from '@/shared/components/panel';
import type { SessionMode } from '../types/typing.types';
import { formatTimeLimit, modeLabels } from '../typing.config';

interface SessionInfoPanelProps {
  /** Missing on sessions from before the title was stored. */
  passageTitle?: string;
  mode: SessionMode;
  /** The time the learner chose, in seconds. */
  timeLimitSeconds: number;
}

/** What was typed and how: the name of the passage, the typing mode and the time chosen. */
export const SessionInfoPanel = ({ passageTitle, mode, timeLimitSeconds }: SessionInfoPanelProps) => (
  <Panel bare>
    <dl className="grid gap-4 sm:grid-cols-3">
      <div className="min-w-0">
        <dt className="text-2xl text-muted-foreground">Passage</dt>
        <dd className="break-words text-[2rem] font-semibold leading-tight text-primary">{passageTitle ?? '—'}</dd>
      </div>
      <div>
        <dt className="text-2xl text-muted-foreground">Mode</dt>
        <dd className="text-[2rem] font-semibold leading-tight text-primary">{modeLabels[mode]}</dd>
      </div>
      <div>
        <dt className="text-2xl text-muted-foreground">Time</dt>
        <dd className="text-[2rem] font-semibold leading-tight text-primary">{formatTimeLimit(timeLimitSeconds)}</dd>
      </div>
    </dl>
  </Panel>
);
