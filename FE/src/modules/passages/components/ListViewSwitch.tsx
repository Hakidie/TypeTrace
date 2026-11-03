import { ArrowLeftRight } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';

interface ListViewSwitchProps {
  /** The list on screen: it names the list, like the title of the learner's `My Passages` toolbar. */
  current: string;
  /** The list a click goes to. */
  other: string;
  onSwitch: () => void;
}

/** The title of an admin list toolbar, as a button that switches to the other list (Passages and Pending review). */
export const ListViewSwitch = ({ current, other, onSwitch }: ListViewSwitchProps) => (
  <TooltipProvider delayDuration={200}>
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onSwitch}
          aria-label={`${current}. Switch to ${other}`}
          className="-mx-4 inline-flex h-10 items-center gap-2 px-4 transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {current}
          <ArrowLeftRight className="size-4" aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent>Switch to {other}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
);
