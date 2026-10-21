import { Moon, Sun, type LucideIcon } from 'lucide-react';
import type { ThemeMode } from '@/shared/lib/theme';
import { cn } from '@/shared/lib/utils';
import { useThemeMode } from '../hooks/use-theme-mode';

const options: { value: ThemeMode; label: string; icon: LucideIcon }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
];

/** Two tabs to switch the mode, Light or Dark. The themes shown on the settings page are the ones of the mode in use. */
export const ThemeTabs = () => {
  const { mode, setMode } = useThemeMode();

  return (
    <div role="radiogroup" aria-label="Mode" className="flex shrink-0 border border-border">
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={mode === value}
          onClick={() => setMode(value)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            mode === value ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          <Icon className="size-4" />
          {label}
        </button>
      ))}
    </div>
  );
};
