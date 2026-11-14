import type { LucideIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';

interface TabGroupProps {
  label: string;
  /** `hint` explains the option in the shared tooltip, on hover or keyboard focus. */
  tabs: { value: string; label: string; icon?: LucideIcon; disabled?: boolean; hint?: string }[];
  value: string;
  onChange: (value: string) => void;
  /** `false` leaves the border to the parent, which puts more controls in the same frame. */
  framed?: boolean;
  /**
   * On phones the tabs with an icon show only the icon, except the selected one, so a long row fits the screen (the Typing
   * page's modes). Screen readers still read every label.
   */
  iconsOnPhones?: boolean;
}

/** A row of switch buttons, same look as the Theme tabs in Settings (the border is an inside outline so the height is the same as the word count's). */
export const TabGroup = ({ label, tabs, value, onChange, framed = true, iconsOnPhones = false }: TabGroupProps) => (
  <div role="radiogroup" aria-label={label} className={cn('flex text-[1.125rem]', framed && 'outline outline-1 -outline-offset-1 outline-border')}>
    {tabs.map(({ icon: Icon, hint, ...tab }) => {
      const selected = value === tab.value;
      // Only the icon on a phone (the label stays for screen readers); the selected tab keeps its label on one line.
      const iconOnly = iconsOnPhones && Icon !== undefined && !selected;
      const button = (
        <button
          key={tab.value}
          type="button"
          role="radio"
          aria-checked={selected}
          disabled={tab.disabled}
          // A click must not take the focus from the typing area, or the learner could not go on typing.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onChange(tab.value)}
          className={cn(
            'inline-flex items-center gap-2 px-3 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
            iconOnly && 'max-sm:px-2.5',
            selected ? 'text-primary' : 'text-muted-foreground enabled:hover:bg-muted enabled:hover:text-foreground',
          )}
        >
          {Icon && <Icon className="size-5" />}
          {iconsOnPhones && Icon ? <span className={iconOnly ? 'max-sm:sr-only' : 'whitespace-nowrap'}>{tab.label}</span> : tab.label}
        </button>
      );
      if (!hint) return button;
      return (
        <TooltipProvider key={tab.value} delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>{button}</TooltipTrigger>
            <TooltipContent>{hint}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    })}
  </div>
);
