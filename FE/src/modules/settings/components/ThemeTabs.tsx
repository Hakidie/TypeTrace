import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { cn, getTheme, setTheme, type Theme } from '@/shared/lib/utils';

const options: { value: Theme; label: string; icon: LucideIcon }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

/** Three tabs to pick the color theme: Light, Dark or System. The choice is saved and applied at once (same storage as `ThemeToggle`). */
export const ThemeTabs = () => {
  const [current, setCurrent] = useState<Theme>(getTheme);

  const select = (theme: Theme) => {
    setTheme(theme);
    setCurrent(theme);
  };

  return (
    <div role="radiogroup" aria-label="Theme" className="flex shrink-0 border border-border">
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={current === value}
          onClick={() => select(value)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            current === value ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          <Icon className="size-4" />
          {label}
        </button>
      ))}
    </div>
  );
};
