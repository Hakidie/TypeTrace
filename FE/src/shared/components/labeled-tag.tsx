import type { LucideIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';

// The red tint of the tags on the cards (the passage cards, the user rows).
const tagClass = 'bg-primary/15 text-primary transition-colors hover:bg-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** A tag with an icon and its word (the language of a passage, the role of a user), in a red tint; `hint` adds a tooltip. */
export const LabeledTag = ({ icon: Icon, text, hint }: { icon: LucideIcon; text: string; hint?: string }) => {
  const tag = (
    <span className={cn('inline-flex h-7 items-center gap-1.5 px-2 text-sm font-medium', tagClass)} tabIndex={hint ? 0 : undefined}>
      <Icon className="size-4" aria-hidden />
      {text}
    </span>
  );
  if (!hint) return tag;
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{tag}</TooltipTrigger>
        <TooltipContent>{hint}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
