import { Moon, Sun, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ThemeMode } from '@/shared/lib/theme';
import { cn } from '@/shared/lib/utils';

const options: { value: ThemeMode; icon: LucideIcon }[] = [
  { value: 'light', icon: Sun },
  { value: 'dark', icon: Moon },
];

interface ModeSwitchProps {
  value: ThemeMode;
  onChange: (mode: ThemeMode) => void;
}

/** Two tabs, Light or Dark. Only shows and reports the choice: `ThemeTabs` ties it to the mode of the app. */
export const ModeSwitch = ({ value, onChange }: ModeSwitchProps) => {
  const { t } = useTranslation('settings');
  return (
  <div role="radiogroup" aria-label={t('mode.label')} className="flex shrink-0 border border-border">
    {options.map(({ value: option, icon: Icon }) => (
      <button
        key={option}
        type="button"
        role="radio"
        aria-checked={value === option}
        onClick={() => onChange(option)}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          value === option ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )}
      >
        <Icon className="size-4" />
        {t(`mode.${option}`)}
      </button>
    ))}
  </div>
  );
};
