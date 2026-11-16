import { useTranslation } from 'react-i18next';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';
import { passwordStrength } from '../utils/password-strength';

/** Four bars under the password field while the learner types (nothing before the first key); hovering them tells the strength. */
export const PasswordStrengthMeter = ({ password }: { password: string }) => {
  const { t } = useTranslation('auth');
  if (!password) return null;
  const strength = passwordStrength(password);
  const level = t(`strength.levels.${strength}`);
  const text = t('strength.text', { level });
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex gap-1 py-1.5" role="meter" aria-label={t('strength.label')} aria-valuemin={0} aria-valuemax={4} aria-valuenow={strength} aria-valuetext={level} data-testid="password-strength">
            {[1, 2, 3, 4].map((bar) => (
              <span key={bar} className={cn('h-1 flex-1 bg-muted', bar <= strength && 'bg-destructive')} />
            ))}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
