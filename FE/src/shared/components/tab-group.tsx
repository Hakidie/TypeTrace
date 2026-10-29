import type { LucideIcon } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

interface TabGroupProps {
  label: string;
  tabs: { value: string; label: string; icon?: LucideIcon; disabled?: boolean }[];
  value: string;
  onChange: (value: string) => void;
  /** `false` leaves the border to the parent, which puts more controls in the same frame. */
  framed?: boolean;
}

/** A row of switch buttons, same look as the Theme tabs in Settings (the border is an inside outline so the height is the same as the word count's). */
export const TabGroup = ({ label, tabs, value, onChange, framed = true }: TabGroupProps) => (
  <div role="radiogroup" aria-label={label} className={cn('flex text-[1.125rem]', framed && 'outline outline-1 -outline-offset-1 outline-border')}>
    {tabs.map(({ icon: Icon, ...tab }) => (
      <button
        key={tab.value}
        type="button"
        role="radio"
        aria-checked={value === tab.value}
        disabled={tab.disabled}
        // A click must not take the focus from the typing area, or the learner could not go on typing.
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => onChange(tab.value)}
        className={cn(
          'inline-flex items-center gap-2 px-3 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          value === tab.value ? 'text-primary' : 'text-muted-foreground enabled:hover:bg-muted enabled:hover:text-foreground',
        )}
      >
        {Icon && <Icon className="size-5" />}
        {tab.label}
      </button>
    ))}
  </div>
);
