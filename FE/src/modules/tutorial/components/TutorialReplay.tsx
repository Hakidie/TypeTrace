import { useNavigate } from 'react-router-dom';
import { Button } from '@/shared/components/ui/button';
import { useResetTutorial } from '../hooks/use-tutorial';

/** In Settings: Ping's whole tutorial again (also for an account from before it), starting on the Typing page. */
export const TutorialReplay = () => {
  const reset = useResetTutorial();
  const navigate = useNavigate();
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-xl font-medium">Ping's tutorial</p>
        <p className="text-lg text-muted-foreground">Walk through every mode with Ping again, and play the practice duel.</p>
      </div>
      <Button disabled={reset.isPending} onClick={() => reset.mutate(undefined, { onSuccess: () => navigate('/typing') })}>
        Xem lại hướng dẫn
      </Button>
    </div>
  );
};
