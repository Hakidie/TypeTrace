import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { termDaysText, termProgress } from '../lib/term-progress';
import type { SubscriptionRow } from '../types/plan.types';

// The bar is cut into square blocks (6px with a 2px gap), like the pixel art of the app: a mask over the track and its fill, so both are cut at the same places.
const BLOCKS = 'repeating-linear-gradient(90deg, #000 0 6px, transparent 6px 8px)';

const formatShort = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });

/**
 * The middle of a subscription card, 61px high like the speed line of a session: a progress bar of the term (how much of it has passed, drawn in square blocks) as high as the letters of the user's name (24px, inside its 32px line, so the gap to the days is the one between the name and the email) and, under it in the style of
 * the user's email (28px), the day it starts on the left and the day it ends on the right (`Now` while it has no end). Hovering the bar says the days left. The admin who made the change shows between the two days (`by Boss`).
 */
export const SubscriptionPeriod = ({ row }: { row: Pick<SubscriptionRow, 'startsAt' | 'endsAt' | 'changedByName'> }) => {
  const percent = termProgress(row.startsAt, row.endsAt);
  return (
    <div className="flex h-[61px] w-full min-w-0 flex-col justify-center pl-24">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              role="progressbar"
              aria-label="Term progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              className="my-1 h-6 w-full bg-primary/20"
              style={{ maskImage: BLOCKS, WebkitMaskImage: BLOCKS }}
            >
              <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
            </div>
          </TooltipTrigger>
          <TooltipContent>{termDaysText(row.startsAt, row.endsAt)}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <div className="flex justify-between gap-3 text-lg leading-7 text-muted-foreground">
        <span className="shrink-0">{formatShort(row.startsAt)}</span>
        <span className="sr-only">to</span>
        {row.changedByName && <span className="min-w-0 truncate">{`by ${row.changedByName}`}</span>}
        <span className="shrink-0">{row.endsAt ? formatShort(row.endsAt) : 'Now'}</span>
      </div>
    </div>
  );
};
