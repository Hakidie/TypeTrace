import { useNavigate } from 'react-router-dom';
import { Panel } from '@/shared/components/panel';
import { Button } from '@/shared/components/ui/button';
import { sectionTitleClass } from '@/shared/lib/panel-styles';
import { useResetTutorial } from '../hooks/use-tutorial';

/** In Settings: Ping's whole tutorial again (also for an account from before it), starting on the Typing page. */
const description = 'Walk through every mode with Ping again, and play the practice duel.';

export const TutorialReplay = () => {
  const reset = useResetTutorial();
  const navigate = useNavigate();
  return (
    <Panel title="Ping's tutorial" titleTip={description} bare titleClassName={sectionTitleClass} className="flex flex-wrap items-center justify-between gap-4 pt-3">
      <p className="min-w-0 text-lg text-muted-foreground">{description}</p>
      <Button disabled={reset.isPending} onClick={() => reset.mutate(undefined, { onSuccess: () => navigate('/typing') })}>
        Replay tutorial
      </Button>
    </Panel>
  );
};
