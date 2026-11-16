import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/shared/components/panel';
import { Button } from '@/shared/components/ui/button';
import { sectionTitleClass } from '@/shared/lib/panel-styles';
import { useResetTutorial } from '../hooks/use-tutorial';

/** In Settings: Ping's whole tutorial again (also for an account from before it), starting on the Typing page. */
export const TutorialReplay = () => {
  const { t } = useTranslation('settings');
  const description = t('tutorial.description');
  const reset = useResetTutorial();
  const navigate = useNavigate();
  return (
    <Panel title={t('tutorial.title')} titleTip={description} bare titleClassName={sectionTitleClass} className="flex flex-wrap items-center justify-between gap-4 pt-3">
      <p className="min-w-0 text-lg text-muted-foreground">{description}</p>
      <Button disabled={reset.isPending} onClick={() => reset.mutate(undefined, { onSuccess: () => navigate('/typing') })}>
        {t('tutorial.replay')}
      </Button>
    </Panel>
  );
};
