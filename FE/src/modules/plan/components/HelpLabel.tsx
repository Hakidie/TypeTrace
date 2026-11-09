import { CircleHelp } from 'lucide-react';
import { Label } from '@/shared/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { STAT_LABEL_CLASS } from '../plan.config';

/** The label of an option on a plan card with a "?" that explains it on hover or focus (shown while the card, which has the `group` class, is hovered). `className` changes the size of the text (the plan dialog's labels are 20px). */
export const HelpLabel = ({ htmlFor, text, help, className = STAT_LABEL_CLASS }: { htmlFor: string; text: string; help: string; className?: string }) => (
  <TooltipProvider>
    <span className="flex items-center gap-1.5">
      <Label htmlFor={htmlFor} className={className}>
        {text}
      </Label>
      <Tooltip>
        <TooltipTrigger
          type="button"
          aria-label={`About: ${text}`}
          className="text-primary/70 transition-opacity hover:text-primary pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:group-focus-within:opacity-100 pointer-fine:data-[state=delayed-open]:opacity-100 pointer-fine:data-[state=instant-open]:opacity-100"
        >
          <CircleHelp className="size-4" />
        </TooltipTrigger>
        <TooltipContent className="max-w-64 whitespace-normal">{help}</TooltipContent>
      </Tooltip>
    </span>
  </TooltipProvider>
);
