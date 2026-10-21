import { Moon, Sun, type LucideIcon } from 'lucide-react';
import type { ThemeMode } from '@/shared/lib/theme';
import { cn } from '@/shared/lib/utils';

const options: { value: ThemeMode; label: string; icon: LucideIcon }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
];

interface ModeSwitchProps {
  value: ThemeMode;
  onChange: (mode: ThemeMode) => void;
}

/** Two tabs, Light or Dark. Only shows and reports the choice: `ThemeTabs` ties it to the mode of the app. */
export const ModeSwitch = ({ value, onChange }: ModeSwitchProps) => (
  <div role="radiogroup" aria-label="Mode" className="flex shrink-0 border border-border">
    {options.map(({ value: option, label, icon: Icon }) => (
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
        {label}
      </button>
    ))}
  </div>
);
