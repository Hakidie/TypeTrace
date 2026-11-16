import { ListChecks, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Panel } from '@/shared/components/panel';
import { Button } from '@/shared/components/ui/button';
import type { SessionMode } from '../types/typing.types';

interface ResultActionsProps {
  /** The mode of the session: Type again goes back to Weak spots after a Weak spots lesson, to Practice otherwise. */
  mode: SessionMode;
  /** Whether the error panels are shown. */
  detailOpen: boolean;
  onToggleDetail: () => void;
  /** Whether the replay plays in place of the typed passage (SCRUM-35). */
  replayOpen: boolean;
  onToggleReplay: () => void;
}

/** The buttons under the result: show or hide the error panels, play the replay or go back to the passage, and Type again. */
export const ResultActions = ({ mode, detailOpen, onToggleDetail, replayOpen, onToggleReplay }: ResultActionsProps) => {
  const { t } = useTranslation('typing');
  return (
  // PANEL Result actions
  <Panel bare>
    <div className="flex flex-wrap justify-center gap-3">
      <Button variant="outline" aria-expanded={detailOpen} onClick={onToggleDetail}>
        <ListChecks className="size-4" /> {t('result.errorDetail')}
      </Button>
      <Button variant="outline" aria-pressed={replayOpen} onClick={onToggleReplay}>
        <RotateCcw className="size-4" /> {t('result.replay')}
      </Button>
      <Button asChild>
        <Link to={mode === 'targeted' ? '/typing?mode=targeted' : '/typing'}>{t('result.typeAgain')}</Link>
      </Button>
    </div>
  </Panel>
  );
};
