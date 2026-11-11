import { ArrowLeftRight, type LucideIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';

interface PanelTitleSwitchProps {
  /** The title of the panel a click shows instead, named in the tooltip and for screen readers. */
  other: string;
  onClick: () => void;
  /** Shows the name of the other panel next to the icon, as a button of its own (placed anywhere, e.g. under a panel), instead of an icon next to a title. */
  showLabel?: boolean;
  /** The icon, `ArrowLeftRight` by default. */
  icon?: LucideIcon;
}

/**
 * The button of a panel that shares its place with another one: a click switches to the other panel. By default an icon
 * next to the title (`Panel`'s `titleAction`) with a tooltip of its own, "Switch to <other panel>", apart from the
 * title's hint; with `showLabel` an icon and the name of the other panel, in the look of the parts of `CompactToolbar` but in the muted color, so it is not mistaken for a title.
 * Either way it is named "Switch to <other panel>" for screen readers.
 */
export const PanelTitleSwitch = ({ other, onClick, showLabel, icon: Icon = ArrowLeftRight }: PanelTitleSwitchProps) => {
  if (showLabel) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={`Switch to ${other}`}
        className="inline-flex h-10 items-center gap-2 whitespace-nowrap bg-transparent text-base font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Icon className="size-4" aria-hidden />
        {other}
      </button>
    );
  }
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onClick}
            aria-label={`Switch to ${other}`}
            className="inline-flex size-9 items-center justify-center text-primary/70 transition-colors hover:bg-primary/15 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Icon className="size-5" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent>Switch to {other}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
